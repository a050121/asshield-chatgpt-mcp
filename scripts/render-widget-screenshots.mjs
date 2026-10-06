/**
 * Headless render of Asshield widget HTML states with a mock window.openai.
 * Saves PNGs under /workspace/asshield-submission/screens/v2/
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = "/workspace/asshield-submission/screens/v2";
mkdirSync(outDir, { recursive: true });

const logo = readFileSync(join(root, "chatgpt-plugin/asshield-insurance/assets/icon.png"));
const logoUri = `data:image/png;base64,${logo.toString("base64")}`;

function load(name) {
  return readFileSync(join(root, "public", name), "utf8").replaceAll("LOGO_SRC", logoUri);
}

const files = {
  "quote-card.html": load("quote-card.html"),
  "agent-card.html": load("agent-card.html"),
  "options-card.html": load("options-card.html"),
  "coverage-card.html": load("coverage-card.html")
};

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const name = url.pathname.replace(/^\//, "") || "quote-card.html";
  if (!files[name]) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(files[name]);
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ headless: true });

const shots = [
  { file: "options-card.html", mock: "1", name: "options-light", colorScheme: "light" },
  { file: "options-card.html", mock: "1", name: "options-dark", colorScheme: "dark" },
  { file: "options-card.html", mock: "start", name: "options-start-panel-light", colorScheme: "light" },
  { file: "coverage-card.html", mock: "1", name: "coverage-auto-light", colorScheme: "light" },
  { file: "coverage-card.html", mock: "1", name: "coverage-auto-dark", colorScheme: "dark" },
  { file: "quote-card.html", mock: "consent", name: "quote-consent-light", colorScheme: "light" },
  { file: "quote-card.html", mock: "consent", name: "quote-consent-dark", colorScheme: "dark" },
  { file: "quote-card.html", mock: "contact", name: "quote-step-contact-light", colorScheme: "light" },
  { file: "quote-card.html", mock: "drivers", name: "quote-step-drivers-light", colorScheme: "light" },
  { file: "quote-card.html", mock: "review", name: "quote-review-light", colorScheme: "light" },
  { file: "quote-card.html", mock: "confirmation", name: "quote-confirmation-light", colorScheme: "light" },
  { file: "quote-card.html", mock: "confirmation", name: "quote-confirmation-dark", colorScheme: "dark" },
  { file: "agent-card.html", mock: "1", name: "agent-card-light", colorScheme: "light" },
  { file: "agent-card.html", mock: "1", name: "agent-card-dark", colorScheme: "dark" }
];

for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: 520, height: 900 }, colorScheme: s.colorScheme });
  await page.addInitScript((theme) => {
    window.openai = { theme, toolOutput: null, callTool: async () => ({ ok: true }), setWidgetState: () => {} };
  }, s.colorScheme);
  await page.goto(`${base}/${s.file}?mock=${encodeURIComponent(s.mock)}`, { waitUntil: "networkidle" });
  await page.evaluate((theme) => {
    document.documentElement.classList.remove("theme-dark", "theme-light");
    document.documentElement.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
  }, s.colorScheme);
  await page.waitForTimeout(250);
  const path = join(outDir, `${s.name}.png`);
  await page.locator(".card").first().screenshot({ path });
  console.log("wrote", path);
  await page.close();
}

await browser.close();
server.close();
writeFileSync(join(outDir, "README.md"), `# Asshield widget screenshots v2

Generated headlessly with Playwright + mock window.openai.

- options-light/dark, options-start-panel-light
- coverage-auto-light/dark
- quote-consent-light/dark, quote-step-contact-light, quote-step-drivers-light, quote-review-light
- quote-confirmation-light/dark (timeline + cross-sell)
- agent-card-light/dark (street-only address until OFFICE_CITY_STATE_ZIP is set)
`);
console.log("done");
