const { fetchAllVariants, updateVariantPrice } = require("./shopify");
const { getLowestAsk } = require("./stockx");

const MARKUP = parseFloat(process.env.MARKUP || "40");

/**
 * Groups an array of variant objects by their styleCode.
 * Returns a Map<styleCode, variant[]>.
 * @param {Array} variants
 * @returns {Map<string, Array>}
 */
function groupByStyleCode(variants) {
  const map = new Map();
  for (const variant of variants) {
    const { styleCode } = variant;
    if (!styleCode) continue;
    if (!map.has(styleCode)) {
      map.set(styleCode, []);
    }
    map.get(styleCode).push(variant);
  }
  return map;
}

/**
 * Main sync function:
 *  1. Fetch all Shopify variants.
 *  2. Deduplicate by style code.
 *  3. For each unique style code, fetch StockX lowest ask.
 *  4. Apply markup and update all matching Shopify variants.
 */
async function runSync() {
  const startTime = Date.now();
  console.log(`\n[Sync] Starting price sync at ${new Date().toISOString()}`);
  console.log(`[Sync] Markup: €${MARKUP}`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Step 1: Fetch all variants from Shopify
  let variants;
  try {
    variants = await fetchAllVariants();
  } catch (err) {
    console.error("[Sync] Fatal: could not fetch Shopify variants. Aborting sync.", err.message);
    return;
  }

  if (!variants.length) {
    console.warn("[Sync] No variants found. Nothing to sync.");
    return;
  }

  // Step 2: Group variants by style code (deduplication)
  const grouped = groupByStyleCode(variants);
  const uniqueStyleCodes = Array.from(grouped.keys());
  console.log(
    `[Sync] ${variants.length} variants across ${uniqueStyleCodes.length} unique style codes.`
  );

  // Step 3 & 4: For each unique style code, fetch price and update all variants
  for (const styleCode of uniqueStyleCodes) {
    const matchingVariants = grouped.get(styleCode);

    let lowestAsk;
    try {
      lowestAsk = await getLowestAsk(styleCode);
    } catch (err) {
      console.error(`[Sync] Unexpected error fetching StockX price for "${styleCode}": ${err.message}`);
      errorCount++;
      skippedCount += matchingVariants.length;
      continue;
    }

    if (lowestAsk === null) {
      console.log(`[Sync] Skipping "${styleCode}" — no StockX price available.`);
      skippedCount += matchingVariants.length;
      continue;
    }

    const finalPrice = (lowestAsk + MARKUP).toFixed(2);
    console.log(
      `[Sync] "${styleCode}" → StockX: €${lowestAsk} + markup €${MARKUP} = €${finalPrice} ` +
        `(${matchingVariants.length} variant${matchingVariants.length !== 1 ? "s" : ""})`
    );

    // Update every Shopify variant that shares this style code
    for (const variant of matchingVariants) {
      try {
        await updateVariantPrice(variant.id, finalPrice);
        updatedCount++;
      } catch (err) {
        console.error(
          `[Sync] Error updating variant ${variant.id} (SKU: ${variant.sku}, style: "${styleCode}"): ${err.message}`
        );
        errorCount++;
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `\n[Sync] Finished in ${elapsed}s — ` +
      `Updated: ${updatedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`
  );
}

module.exports = { runSync };
