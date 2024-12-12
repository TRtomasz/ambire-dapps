const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');

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

// Fetch data from the API
https.get('https://api.llama.fi/protocols', (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const rawArray = JSON.parse(data);
      const jsonArray = Array.isArray(rawArray) ? rawArray : [];

      // Filter, deduplicate, and merge data
      const processedData = {};

      jsonArray
        .filter((item, index) => {
          try {
            // Ensure the item has the necessary structure and TVL conditions
            if (!item || !Array.isArray(item.chains) || item.tvl == null || item.tvl < 10000000 || excludedCategories.includes(item.category)) {
              throw new Error(`Item '${item?.name || 'unknown'}' at index ${index} does not meet criteria`);
            }
            return item.chains.some(chain => !notAllowedChains.includes(chain));
          } catch (error) {
            console.warn(`Skipping item '${item?.name || 'unknown'}' at index ${index}:`, error.message);
            return false;
          }
        })
        .sort((a, b) => b.tvl - a.tvl) // Sort by TVL in descending order
        .forEach((item) => {
          const baseUrl = new URL(item.url).origin; // Extract base URL
          if (!processedData[baseUrl]) {
            processedData[baseUrl] = {
              ...item,
              category: [item.category],
            };
          } else {
            const existingItem = processedData[baseUrl];
            existingItem.category = Array.from(new Set([...existingItem.category, item.category]));
          }
        });

      // Transform data for output
      const outputData = Object.values(processedData).map(item => ({
        url: new URL(item.url).origin,
        name: item.name,
        category: item.category,
        icon: item.logo,
        description: item.description
      }));

      // Group objects by category
      const categorizedData = {};

      outputData.forEach((item) => {
        item.category.forEach((category) => {
          if (!categorizedData[category]) {
            categorizedData[category] = [];
          }
          categorizedData[category].push(item);
        });
      });

      // Write each category to a separate file
      Object.entries(categorizedData).forEach(([category, items]) => {
        const fileName = `${category.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        const filePath = path.join(outputDir, fileName);

        fs.writeFile(filePath, JSON.stringify(items, null, 2), (err) => {
          if (err) {
            console.error(`Error writing file for category ${category}:`, err);
          } else {
            console.log(`File written: ${filePath}`);
          }
        });
      });
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
    }
  });

}).on('error', (err) => {
  console.error('Error fetching data from API:', err);
});
