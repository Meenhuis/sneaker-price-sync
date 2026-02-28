const axios = require("axios");

const DELAY_MS = 500; // Delay between StockX requests to avoid rate limiting

const stockxClient = axios.create({
  baseURL: "https://stockx.com/api/p/e",
  timeout: 15000,
  headers: {
    // Mimic a browser request to avoid bot detection
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Referer: "https://stockx.com/",
    Origin: "https://stockx.com",
  },
});

/**
 * Normalises a style code for use in a StockX search query.
 * Shopify SKU uses spaces (e.g. "DO9392 200"), StockX search prefers hyphens.
 * @param {string} styleCode
 * @returns {string}
 */
function normaliseStyleCode(styleCode) {
  return styleCode.replace(/\s+/g, "-");
}

/**
 * Pauses execution for the configured delay to respect rate limits.
 */
function delay() {
  return new Promise((resolve) => setTimeout(resolve, DELAY_MS));
}

/**
 * Fetches the lowest ask price (EUR) for a given style code from StockX.
 *
 * Strategy:
 *  1. Query the StockX search/browse API for the style code.
 *  2. Find the first result whose styleId or urlKey matches the code.
 *  3. Return the lowestAsk value in EUR.
 *
 * Returns null if the product is not found or an error occurs.
 *
 * @param {string} styleCode — e.g. "DO9392 200"
 * @returns {Promise<number|null>} lowest ask in EUR, or null
 */
async function getLowestAsk(styleCode) {
  await delay();

  const query = normaliseStyleCode(styleCode);

  try {
    // StockX browse API — searches by keyword and returns product list with pricing
    const response = await axios.get("https://stockx.com/api/browse", {
      params: {
        _search: query,
        dataType: "product",
        market: "EUR",
        currency: "EUR",
      },
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: `https://stockx.com/search?s=${encodeURIComponent(query)}`,
      },
    });

    const edges = response.data?.Products || [];

    if (!edges.length) {
      console.warn(`[StockX] No results for style code: ${styleCode}`);
      return null;
    }

    // Try to find the best matching product by styleId (exact match preferred)
    const normalised = styleCode.replace(/\s+/g, "").toLowerCase();
    let match = edges.find((p) => {
      const id = (p.styleId || "").replace(/[\s-]/g, "").toLowerCase();
      return id === normalised;
    });

    // Fall back to first result if no exact match found
    if (!match) {
      match = edges[0];
      console.warn(
        `[StockX] Exact match not found for "${styleCode}", using first result: "${match.title}" (${match.styleId})`
      );
    }

    const lowestAsk = match.market?.lowestAsk ?? match.lowestAsk ?? null;

    if (lowestAsk === null || lowestAsk === undefined) {
      console.warn(`[StockX] No lowestAsk found for style code: ${styleCode}`);
      return null;
    }

    return Number(lowestAsk);
  } catch (err) {
    if (err.response?.status === 429) {
      console.error(`[StockX] Rate limited (429) for style code: ${styleCode}. Skipping.`);
    } else if (err.response?.status === 403) {
      console.error(`[StockX] Forbidden (403) for style code: ${styleCode}. Bot detection may have triggered.`);
    } else {
      console.error(`[StockX] Error fetching price for "${styleCode}": ${err.message}`);
    }
    return null;
  }
}

module.exports = { getLowestAsk };
