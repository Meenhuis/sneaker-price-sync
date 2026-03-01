require("dotenv").config();

const cron = require("node-cron");
const { runSync } = require("./sync");

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

runSync().catch((err) => {
  console.error("[Startup] Initial sync failed:", err.message);
});

cron.schedule("0 * * * *", () => {
  console.log("[Cron] Hourly sync triggered.");
  runSync().catch((err) => {
    console.error("[Cron] Sync failed:", err.message);
  });
});

console.log("[Startup] Cron job registered. Process will stay alive and sync every hour.");

const http = require('http');
const url = require('url');

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const { id_token, shop } = parsed.query;

  if (id_token && shop) {
    try {
      const params = new URLSearchParams({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: id_token,
        subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
        requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token'
      });
      const response = await require('axios').post(
        `https://${shop}/admin/oauth/access_token`,
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      const token = response.data.access_token;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<h1>New token:</h1><p style="word-break:break-all;font-size:18px">${token}</p><p>Copy this and update SHOPIFY_ACCESS_TOKEN in Railway</p>`);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<pre>${e.response ? JSON.stringify(e.response.data) : e.message}</pre>`);
    }
  } else {
    res.writeHead(200);
    res.end('ok');
  }
});

server.listen(process.env.PORT || 3000, () => console.log('[Server] Listening'));

