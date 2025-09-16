# ambire-dapps

## Usage

Install dependencies and run the data fetcher:

```bash
npm install
node fetchData.js
```

## Configuration

The filtering logic used by `fetchData.js` is stored in `config/filters.json`. Update this file instead of editing the script when you need to adjust filtering rules.

The file accepts three arrays:

- `notAllowedChains`: chains that should be ignored when evaluating protocol data. Protocols are discarded if they only appear on these chains.
- `excludedCategories`: protocol categories that should never appear in the output.
- `categoriesWithoutTVL`: categories that are allowed even when their reported TVL is missing or below the default threshold.

After updating `config/filters.json`, rerun `node fetchData.js` to regenerate the output files with the new filters.
