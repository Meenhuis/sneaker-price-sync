require("dotenv").config();

const cron = require("node-cron");
const { runSync } = require("./sync");

// Validate required environment variables before starting
const required = ["SHOPIFY_STORE", "SHOPIFY_ACCESS_TOKEN"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`[Startup] Missing required environment variables: ${missing.join(", ")}`);
  console.error("[Startup] Copy .env.example to .env and fill in the values.");
  process.exit(1);
}

console.log("[Startup] Sneaker price sync starting...");
console.log(`[Startup] Store: ${process.env.SHOPIFY_STORE}`);
console.log(`[Startup] Markup: €${process.env.MARKUP || 40}`);
console.log("[Startup] Cron schedule: every hour (0 * * * *)");

// Run once immediately on startup
runSync().catch((err) => {
  console.error("[Startup] Initial sync failed:", err.message);
});

// Schedule hourly sync — "0 * * * *" = top of every hour
cron.schedule("0 * * * *", () => {
  console.log("[Cron] Hourly sync triggered.");
  runSync().catch((err) => {
    console.error("[Cron] Sync failed:", err.message);
  });
});

console.log("[Startup] Cron job registered. Process will stay alive and sync every hour.");
