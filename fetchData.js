// This script fetches data from 'https://api.llama.fi/protocols' and merges
// it with manually-provided entries in an 'input.json' file (if present).
// 1. Sort and filter the fetched data first.
// 2. Combine that sorted data with the manual entries.
// 3. Deduplicate by the root domain (ignoring subdomains), merging categories if present.
// 4. Output one combined file and then separate JSON files by category.
// 5. Keep 'https://' in the final result, if it was part of the original.
// 6. Ensure icons from input.json are not lost after merging.

const fs = require('fs');
const path = require('path');
const https = require('https');

// Output directory path
const outputDir = path.join(__dirname, 'output');

// Ensure the output directory exists, and clear it if it exists
if (fs.existsSync(outputDir)) {
  fs.readdirSync(outputDir).forEach((file) => {
    fs.unlinkSync(path.join(outputDir, file));
  });
} else {
  fs.mkdirSync(outputDir);
}

// Chains to filter (not allowed chains)
const notAllowedChains = [
  "Bitcoin",
  "Solana",
  "Doge",
  "Ripple",
  "Tron",
  "Polkadot",
  "Near",
  "Algorand",
  "Aptos",
  "Litecoin",
  "Cosmos",
  "EOS",
  "TEZOS",
  "Zilliqa",
  "Cardano",
  "Thorchain",
  "IoTeX"
];

// Categories to exclude
const excludedCategories = [
  "CEX",
  "AI Agents",
  "Yield Lottery",
  "Decentralized Stablecoin",
  "Anchor BTC",
  "Algo-Stables",
  "Governance Incentives",
  "Privacy",
  "Reserve Currency",
  "SoFi",
  "Staking Pool",
  "Staking",
  "Token Locker",
  "Treasury Manager"
];

const categoriesWithoutTVL = [
  "Services"
]

// Read from input.json if it exists
let manualEntries = [];
const inputFilePath = path.join(__dirname, 'input.json');

if (fs.existsSync(inputFilePath)) {
  try {
    const rawInput = fs.readFileSync(inputFilePath, 'utf-8');
    manualEntries = JSON.parse(rawInput);
  } catch (err) {
    console.error('Error reading/parsing input.json:', err);
  }
} else {
  console.warn('No input.json found; continuing without manual entries.');
}

/**
 * Naive function to extract root domain.
 * For example, https://app.aave.com => aave.com
 * Might fail for .co.uk or similar.
 */
function getRootDomain(parsedUrl) {
  try {
    const hostname = parsedUrl.hostname;
    const parts = hostname.split('.');
    if (parts.length <= 2) {
      return hostname;
    }
    return parts.slice(-2).join('.');
  } catch {
    return null;
  }
}

// Fetch data from the API
https.get('https://api.llama.fi/protocols', (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const apiArray = JSON.parse(data);
      const fetchedData = Array.isArray(apiArray) ? apiArray : [];

      // 1) Filter and sort fetched data by TVL.
      const filteredSortedApiData = fetchedData
        .filter((item) => {
          if (!item || !Array.isArray(item.chains)) {
            return false;
          }
          if (!categoriesWithoutTVL.includes(item.category)) {
            if (item.tvl == null || item.tvl < 10000000) {
              return false;
            }
          }
          if (excludedCategories.includes(item.category)) {
            return false;
          }
          // Exclude if all chains are in notAllowedChains
          return item.chains.some(chain => !notAllowedChains.includes(chain));
        })
        .sort((a, b) => b.tvl - a.tvl);


      const allData = [...manualEntries, ...filteredSortedApiData];

      // 3) Deduplicate by root domain. Keep https in final.
      const processedData = {};

      allData.forEach((item) => {
        try {
          const parsedUrl = new URL(item.url);
          const rootDomain = getRootDomain(parsedUrl);
          if (!rootDomain) {
            return;
          }

          // Convert category to array if needed.
          const catArray = Array.isArray(item.category)
            ? item.category
            : item.category
              ? [item.category]
              : [];

          // The final domain will keep the protocol from the original.
          const finalUrl = `${parsedUrl.protocol}//${rootDomain}`;

          if (!processedData[rootDomain]) {
            processedData[rootDomain] = {
              ...item,
              url: finalUrl,  // Overwrite with the protocol + root domain
              category: catArray
            };
          } else {
            // Merge categories.
            processedData[rootDomain].category = Array.from(
              new Set([...processedData[rootDomain].category, ...catArray])
            );

            // If the new item has an icon, use it.

            // Optionally merge other fields if needed, e.g. TVL.
            // processedData[rootDomain].tvl = Math.max(
            //   processedData[rootDomain].tvl,
            //   item.tvl
            // );
          }
        } catch {
          // skip if invalid URL
        }
      });

      // 4) Transform final data. We already overwrote item.url, so we can just pass it along.
      const outputData = Object.values(processedData).map((item) => {
        const finalCategories = Array.isArray(item.category) ? item.category : [];
        return {
          url: item.url,
          name: item.name,
          category: finalCategories,
          icon: item.logo,
          description: item.description
        };
      });

      // 5) Write one combined file.
      const combinedFilePath = path.join(outputDir, 'combined.json');
      fs.writeFileSync(combinedFilePath, JSON.stringify(outputData, null, 2));
      console.log(`Created combined file at: ${combinedFilePath}`);

      // 6) Create separate files by category.
      const categoryMap = {};
      for (const entry of outputData) {
        for (const cat of entry.category) {
          if (!categoryMap[cat]) {
            categoryMap[cat] = [];
          }
          categoryMap[cat].push(entry);
        }
      }

      for (const [category, items] of Object.entries(categoryMap)) {
        const safeCategory = category.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filePath = path.join(outputDir, `${safeCategory}.json`);
        fs.writeFileSync(filePath, JSON.stringify(items, null, 2));
        console.log(`Created file for category '${category}' at: ${filePath}`);
      }

    } catch (err) {
      console.error('Error processing API data:', err);
    }
  });

}).on('error', (err) => {
  console.error('Error fetching data from API:', err);
});
