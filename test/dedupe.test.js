const assert = require('assert');
const { deduplicateEntries } = require('../fetchData');

const sampleData = [
  { url: 'https://app.aave.com', name: 'Aave', category: 'Lending', logo: 'icon1' },
  { url: 'https://mirror.aave.com', name: 'Aave Mirror', category: 'DeFi', logo: 'icon2' },
  { url: 'https://app.uniswap.org', name: 'Uniswap', category: 'DEX', logo: 'icon3' }
];

const result = deduplicateEntries(sampleData);

assert.strictEqual(result.length, 2, 'Entries should be deduplicated by domain');

const aave = result.find(r => r.url.includes('aave.com'));
assert.deepStrictEqual(aave.category.sort(), ['DeFi', 'Lending'].sort(), 'Categories should merge for same domain');

const uniswap = result.find(r => r.url.includes('uniswap.org'));
assert.strictEqual(uniswap.url, 'https://uniswap.org');

console.log('All tests passed!');

