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

// Attempt to read from input.json
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

// Fetch data from the API
https.get('https://api.llama.fi/protocols', (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const apiArray = JSON.parse(data);
      const combinedData = Array.isArray(apiArray) ? apiArray : [];

      // Combine the API data with the manual entries
      const allData = [...combinedData, ...manualEntries];

      // Filter, deduplicate, and merge data
      const processedData = {};

      allData
        .filter((item, index) => {
          // Validate item structure
          if (!item || !Array.isArray(item.chains) || item.tvl == null || item.tvl < 10000000) {
            return false;
          }
          // Exclude if category is in excludedCategories
          if (excludedCategories.includes(item.category)) {
            return false;
          }
          // Exclude if all chains are in notAllowedChains
          const hasAllowedChain = item.chains.some(chain => !notAllowedChains.includes(chain));
          return hasAllowedChain;
        })
        .sort((a, b) => b.tvl - a.tvl) // Sort by TVL descending
        .forEach((item) => {
          try {
            const baseURL = new URL(item.url).origin;
            if (!processedData[baseURL]) {
              processedData[baseURL] = {
                ...item,
                category: [item.category],
              };
            } else {
              // If an entry exists for this base URL, merge categories
              const existingItem = processedData[baseURL];
              existingItem.category = Array.from(new Set([...existingItem.category, item.category]));
            }
          } catch (error) {
            // If there's an issue with item.url, skip it
            // console.warn(`Skipping item with invalid URL: ${item?.url}`, error);
          }
        });

      // Convert processed data to the output format
      const outputData = Object.values(processedData).map(item => ({
        url: new URL(item.url).origin,
        name: item.name,
        category: item.category,
        icon: item.logo,
        description: item.description
      }));

      // 1) Write one combined file
      const combinedFilePath = path.join(outputDir, 'combined.json');
      fs.writeFileSync(combinedFilePath, JSON.stringify(outputData, null, 2));
      console.log(`Created combined file at: ${combinedFilePath}`);

      // 2) Create separate files by category
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
