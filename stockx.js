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
        wait: 5000,
      },
      timeout: 60000,
    });

    const html = response.data;

    console.log("[StockX] HTML length:", html.length);
    console.log("[StockX] Has lowestAsk:", html.includes("lowestAsk"));
    console.log("[StockX] Has styleId:", html.includes('"styleId"'));

    return null;
  } catch (err) {
    console.error(`[StockX] Error fetching price for "${styleCode}": ${err.message}`);
    return null;
  }
}

module.exports = { getLowestAsk };
