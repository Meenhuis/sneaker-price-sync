const axios = require("axios");

const DELAY_MS = 500;
const SCRAPERAPI_KEY = process.env.SCRAPERAPI_KEY;

function normaliseStyleCode(styleCode) {
  return styleCode.replace(/\s+/g, "-");
}

function delay() {
  return new Promise((resolve) => setTimeout(resolve, DELAY_MS));
}

async function getLowestAsk(styleCode) {
  await delay();

  const query = normaliseStyleCode(styleCode);

  try {
    const targetUrl = `https://stockx.com/search?s=${encodeURIComponent(query)}`;

    const response = await axios.get("https://api.scraperapi.com", {
      params: {
        api_key: SCRAPERAPI_KEY,
        url: targetUrl,
        render: true,
      },
      timeout: 60000,
    });

    const html = response.data;

    // Extract the Next.js embedded JSON data
    const jsonMatch = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
    );

    if (!jsonMatch) {
      console.warn(`[StockX] Could not find __NEXT_DATA__ for: ${styleCode}`);
      return null;
    }

    const nextData = JSON.parse(jsonMatch[1]);
    const products =
      nextData?.props?.pageProps?.searchResults?.edges?.map((e) => e.node) || [];

    if (!products.length) {
      console.warn(`[StockX] No results for style code: ${styleCode}`);
      return null;
    }

    const normalised = styleCode.replace(/[\s-]/g, "").toLowerCase();
    let match = products.find((p) => {
      const id = (p.styleId || "").replace(/[\s-]/g, "").toLowerCase();
      return id === normalised;
    });

    if (!match) {
      match = products[0];
      console.warn(
        `[StockX] Exact match not found for "${styleCode}", using first result: "${match.title}" (${match.styleId})`
      );
    }

    const lowestAsk = match.market?.lowestAsk ?? null;

    if (lowestAsk === null) {
      console.warn(`[StockX] No lowestAsk for: ${styleCode}`);
      return null;
    }

    return Number(lowestAsk);
  } catch (err) {
    console.error(`[StockX] Error fetching price for "${styleCode}": ${err.message}`);
    return null;
  }
}

module.exports = { getLowestAsk };
