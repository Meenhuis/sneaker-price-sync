const axios = require("axios");

const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = "2024-01";

const shopifyClient = axios.create({
  baseURL: `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}`,
  headers: {
    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
    "Content-Type": "application/json",
  },
});

/**
 * Fetches all product variants from Shopify using cursor-based pagination.
 * Returns a flat array of variant objects, each augmented with:
 *   - styleCode: the middle segment of the SKU (e.g. "DO9392 200")
 *
 * SKU format: styleID|styleCode|size  (e.g. "064276|DO9392 200|9")
 */
async function fetchAllVariants() {
  const variants = [];
  let pageInfo = null;
  let isFirstPage = true;

  console.log("[Shopify] Fetching all products...");

  while (isFirstPage || pageInfo) {
    const params = { limit: 250 };
    if (pageInfo) {
      params.page_info = pageInfo;
    }

    let response;
    try {
      response = await shopifyClient.get("/products.json", { params });
    } catch (err) {
      console.error("[Shopify] Error fetching products page:", err.message);
      throw err;
    }

    const products = response.data.products || [];

    for (const product of products) {
      for (const variant of product.variants) {
        if (!variant.sku || !variant.sku.includes("|")) {
          continue; // Skip variants without the expected SKU format
        }

        const parts = variant.sku.split("|");
        if (parts.length < 3) continue;

        const styleCode = parts[1].trim();

        variants.push({
          id: variant.id,
          sku: variant.sku,
          styleCode,
          price: variant.price,
          productTitle: product.title,
        });
      }
    }

    // Parse next page_info from Link header
    pageInfo = null;
    const linkHeader = response.headers["link"];
    if (linkHeader) {
      const nextMatch = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
      if (nextMatch) {
        pageInfo = nextMatch[1];
      }
    }

    isFirstPage = false;
  }

  console.log(`[Shopify] Fetched ${variants.length} variants total.`);
  return variants;
}

/**
 * Updates the price of a single Shopify variant.
 * @param {number} variantId
 * @param {string} newPrice — formatted as a string with 2 decimal places, e.g. "149.00"
 */
async function updateVariantPrice(variantId, newPrice) {
  try {
    await shopifyClient.put(`/variants/${variantId}.json`, {
      variant: {
        id: variantId,
        price: newPrice,
      },
    });
  } catch (err) {
    const status = err.response?.status;
    const body = JSON.stringify(err.response?.data);
    throw new Error(`Failed to update variant ${variantId}: HTTP ${status} — ${body}`);
  }
}

module.exports = { fetchAllVariants, updateVariantPrice };
