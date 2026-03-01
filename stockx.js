const axios = require("axios");

const DELAY_MS = 500;
const SCRAPERAPI_KEY = process.env.SCRAPERAPI_KEY;

function normaliseStyleCode(styleCode) {
  return styleCode.replace(/\s+/g, "-");
}

function delay() {
  return new Promise((resolve) => setTimeout(resolve, DELAY_MS));
}

/**
 * Fetches the lowest ask price (EUR) for a given style code from StockX.
 * Routes through ScraperAPI to bypass bot detection.
 *
 * @param {string} styleCode — e.g. "DO9392 200"
 * @returns {Promise<number|null>} lowest ask in EUR, or null
 */
async function getLowestAsk(styleCode) {
  await delay();

  const query = normaliseStyleCode(styleCode);

  try {
    const targetUrl = `https://stockx.com/api/browse?_search=${encodeURIComponent(query)}&dataType=product&market=EUR&currency=EUR`;

    const response = await axios.get("https://api.scraperapi.com", {
      params: {
        api_key: SCRAPERAPI_KEY,
        url: targetUrl,
        render: false,
      },
      timeout: 30000,
    });

    const edges = response.data?.Products || [];

    if (!edges.length) {
      console.warn(`[StockX] No results for style code: ${styleCode}`);
      return null;
    }

    const normalised = styleCode.replace(/\s+/g, "").toLowerCase();
    let match = edges.find((p) => {
      const id = (p.styleId || "").replace(/[\s-]/g, "").toLowerCase();
      return id === normalised;
    });

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
      console.error(`[StockX] Forbidden (403) for style code: ${styleCode}. Bot detection triggered.`);
    } else {
      console.error(`[StockX] Error fetching price for "${styleCode}": ${err.message}`);
    }
    return null;
  }
}

module.exports = { getLowestAsk };
