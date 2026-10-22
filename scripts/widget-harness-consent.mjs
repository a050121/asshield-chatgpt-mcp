// Simulates ChatGPT's window.openai bridge around the quote card to catch re-render loops and stuck buttons.
// Usage: node scripts/widget-harness-consent.mjs [outDir]
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";
const out = process.argv[2] || "/tmp";
const port = 8799 + Math.floor(Math.random() * 100);
const env = { ...process.env, PORT: String(port) }; delete env.SUPABASE_URL; delete env.SUPABASE_SERVICE_ROLE_KEY;
const child = spawn("node", ["./node_modules/tsx/dist/cli.mjs", "src/server.ts"], { env, stdio: ["ignore", "pipe", "pipe"] });
await sleep(2500);
let id = 1;
async function rpc(method, params) {
  const res = await fetch(`http://127.0.0.1:${port}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: id++, method, params }) });
  const raw = await res.text();
  for (const l of raw.split("\n")) if (l.startsWith("data:")) return JSON.parse(l.slice(5));
  return JSON.parse(raw);
}
try {
  await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "h", version: "0" } });
  const r = await rpc("tools/call", { name: "start_quote", arguments: { product: "home", state: "KY", zip: "40509" } });
  console.log("content[0]:", r.result.content[0].text.slice(0, 200));
  const sc = r.result.structuredContent;
  const html = (await rpc("resources/read", { uri: "ui://widget/asshield-quote-card/v1.html" })).result.contents[0].text;
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.exposeFunction("__callTool", async (name, args) => (await rpc("tools/call", { name, arguments: args })).result);
  await page.addInitScript((scJson) => {
    let ws = null; window.__setWS = 0; window.__heights = [];
    window.openai = {
      get toolOutput() { return JSON.parse(scJson); },
      theme: "light",
      get widgetState() { return ws; },
      setWidgetState(s) { ws = s; window.__setWS++; setTimeout(() => window.dispatchEvent(new CustomEvent("openai:set_globals", { detail: { globals: { widgetState: s } } })), 0); },
      notifyIntrinsicHeight(h) { window.__heights.push(h); },
      callTool: (n, a) => window.__callTool(n, a),
      sendFollowUpMessage(p) { window.__follow = p; }
    };
  }, JSON.stringify(sc));
  await page.route("http://widget.test/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: html }));
  await page.goto("http://widget.test/card.html");
  await page.evaluate(() => { window.__mut = 0; new MutationObserver(() => window.__mut++).observe(document.getElementById("panels"), { childList: true }); });
  await sleep(5000);
  console.log("idle 5s on consent:", JSON.stringify(await page.evaluate(() => ({ panelRebuilds: window.__mut, setWidgetStateCalls: window.__setWS, badge: document.getElementById("phase-badge").textContent, textDecoration: [...document.querySelectorAll(".checklist .txt")].map(e => getComputedStyle(e).textDecorationLine), checkedItems: document.querySelectorAll(".checklist li.done").length }))));
  await page.screenshot({ path: `${out}/consent.png`, fullPage: true });
  await page.click("#btn-begin");
  await sleep(4000);
  console.log("4s after tap:", JSON.stringify(await page.evaluate(() => ({ badge: document.getElementById("phase-badge").textContent, contactFormShown: !!document.getElementById("first_name"), status: document.getElementById("status").textContent }))));
  if (await page.$("#first_name")) {
    await page.fill("#first_name", "Jordan"); await sleep(3500);
    console.log("typed value kept after 3.5s:", await page.inputValue("#first_name"));
  }
  await page.screenshot({ path: `${out}/after-tap.png`, fullPage: true });
  await browser.close();
} catch (e) { console.error("FAIL", e); process.exitCode = 1; } finally { child.kill(); }
