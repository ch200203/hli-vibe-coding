const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");

const CSV_FILES = {
  products_catalog: "products_catalog.csv",
  customer_profiles: "customer_profiles.csv",
  policy_headers: "policy_headers.csv",
  policy_coverages: "policy_coverages.csv",
  loss_ratio_timeseries: "loss_ratio_timeseries.csv",
  investment_products: "investment_products.csv",
  customer_holdings: "customer_holdings.csv",
  nav_timeseries: "nav_timeseries.csv",
  risk_profiles: "risk_profiles.csv",
  market_benchmarks: "market_benchmarks.csv",
  transactions: "transactions.csv",
};

const DATA_DIR = path.join(__dirname, "..", "data");

let cache = null;

async function loadAllDatasets() {
  if (cache) return cache;

  const result = {};

  for (const [key, filename] of Object.entries(CSV_FILES)) {
    const filePath = path.join(DATA_DIR, filename);
    const raw = fs.readFileSync(filePath, "utf-8");
    // BOM 제거
    const content = raw.startsWith("\uFEFF") ? raw.slice(1) : raw;

    const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    result[key] = parsed.data;
    console.log(`[csv-loader] Loaded ${key}: ${parsed.data.length} rows`);
  }

  cache = result;
  return cache;
}

function getDataset(name) {
  if (!cache) throw new Error(`Datasets not loaded yet. Call loadAllDatasets() first.`);
  if (!cache[name]) throw new Error(`Unknown dataset: ${name}`);
  return cache[name];
}

module.exports = { loadAllDatasets, getDataset };
