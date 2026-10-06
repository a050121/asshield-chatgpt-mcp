import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = "/workspace/asshield-submission/screens/v4";
mkdirSync(outDir, { recursive: true });

const logo = readFileSync(join(root, "chatgpt-plugin/asshield-insurance/assets/icon.png"));
const logoUri = `data:image/png;base64,${logo.toString("base64")}`;
const theme = readFileSync(join(root, "public", "asshield-widget-theme.css"), "utf8");
const icons = readFileSync(join(root, "public", "asshield-line-icons.js"), "utf8");

function load(name) {
  return readFileSync(join(root, "public", name), "utf8")
    .replaceAll("LOGO_SRC", logoUri)
    .replace("/*__ASSHIELD_THEME__*/", theme)
    .replace("/*__ASSHIELD_ICONS__*/", icons);
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
  { file: "options-card.html", mock: "selected", name: "options-light", colorScheme: "light", width: 420 },
  { file: "options-card.html", mock: "selected", name: "options-dark", colorScheme: "dark", width: 420 },
  { file: "options-card.html", mock: "selected", name: "options-wide-light", colorScheme: "light", width: 760 },
  { file: "coverage-card.html", mock: "open", name: "coverage-auto-light", colorScheme: "light", width: 420 },
  { file: "coverage-card.html", mock: "open", name: "coverage-auto-dark", colorScheme: "dark", width: 420 },
  { file: "quote-card.html", mock: "consent", name: "quote-consent-light", colorScheme: "light", width: 420 },
  { file: "quote-card.html", mock: "consent", name: "quote-consent-dark", colorScheme: "dark", width: 420 },
  { file: "quote-card.html", mock: "contact", name: "quote-step-contact-light", colorScheme: "light", width: 420 },
  { file: "quote-card.html", mock: "drivers", name: "quote-step-drivers-light", colorScheme: "light", width: 420 },
  { file: "quote-card.html", mock: "vehicles", name: "quote-step-vehicles-light", colorScheme: "light", width: 420 },
  { file: "quote-card.html", mock: "prefs", name: "quote-prefs-light", colorScheme: "light", width: 420 },
  { file: "quote-card.html", mock: "review", name: "quote-review-light", colorScheme: "light", width: 420 },
  { file: "quote-card.html", mock: "confirmation", name: "quote-confirmation-light", colorScheme: "light", width: 420 },
  { file: "quote-card.html", mock: "confirmation", name: "quote-confirmation-dark", colorScheme: "dark", width: 420 },
  { file: "agent-card.html", mock: "callback", name: "agent-card-light", colorScheme: "light", width: 420 },
  { file: "agent-card.html", mock: "callback", name: "agent-card-dark", colorScheme: "dark", width: 420 }
];

for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: s.width, height: 1100 }, colorScheme: s.colorScheme });
  await page.addInitScript((theme) => {
    window.openai = { theme, toolOutput: null, widgetState: {}, callTool: async () => ({ ok: true }), setWidgetState: (s) => { window.openai.widgetState = { ...window.openai.widgetState, ...s }; } };
  }, s.colorScheme);
  await page.goto(`${base}/${s.file}?mock=${encodeURIComponent(s.mock)}`, { waitUntil: "networkidle" });
  await page.evaluate((theme) => {
    document.documentElement.classList.remove("theme-dark", "theme-light");
    document.documentElement.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
  }, s.colorScheme);
  await page.waitForTimeout(300);
  const path = join(outDir, `${s.name}.png`);
  await page.locator(".card").first().screenshot({ path });
  console.log("wrote", path);
  await page.close();
}
await browser.close();
server.close();
writeFileSync(join(outDir, "README.md"), `# Asshield widget screenshots v4\n\nNational-carrier aesthetic + interactive CX.\n`);
console.log("done");
