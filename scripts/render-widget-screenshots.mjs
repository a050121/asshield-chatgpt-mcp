/**
 * Headless render of Asshield widget HTML states with a mock window.openai.
 * Saves PNGs under /workspace/asshield-submission/screens/
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = "/workspace/asshield-submission/screens";
mkdirSync(outDir, { recursive: true });

const logo = readFileSync(join(root, "chatgpt-plugin/asshield-insurance/assets/icon.png"));
const logoUri = `data:image/png;base64,${logo.toString("base64")}`;

function load(name) {
  return readFileSync(join(root, "public", name), "utf8").replaceAll("LOGO_SRC", logoUri);
}

const files = {
  "quote-card.html": load("quote-card.html"),
  "agent-card.html": load("agent-card.html")
};

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const name = url.pathname.replace(/^\//, "") || "quote-card.html";
  if (!files[name]) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(files[name]);
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({ headless: true });

const shots = [
  { file: "quote-card.html", mock: "consent", name: "quote-consent-light", colorScheme: "light" },
  { file: "quote-card.html", mock: "consent", name: "quote-consent-dark", colorScheme: "dark" },
  { file: "quote-card.html", mock: "progress", name: "quote-progress-light", colorScheme: "light" },
  { file: "quote-card.html", mock: "confirmation", name: "quote-confirmation-light", colorScheme: "light" },
  { file: "quote-card.html", mock: "confirmation", name: "quote-confirmation-dark", colorScheme: "dark" },
  { file: "agent-card.html", mock: "1", name: "agent-card-light", colorScheme: "light" },
  { file: "agent-card.html", mock: "1", name: "agent-card-dark", colorScheme: "dark" }
];

for (const s of shots) {
  const page = await browser.newPage({
    viewport: { width: 480, height: 720 },
    colorScheme: s.colorScheme
  });
  await page.addInitScript((theme) => {
    window.openai = {
      theme,
      toolOutput: null,
      callTool: async () => ({ ok: true }),
      setWidgetState: () => {}
    };
  }, s.colorScheme);
  await page.goto(`${base}/${s.file}?mock=${encodeURIComponent(s.mock)}`, {
    waitUntil: "networkidle"
  });
  // Force theme class for deterministic dark/light regardless of OS
  await page.evaluate((theme) => {
    document.documentElement.classList.remove("theme-dark", "theme-light");
    document.documentElement.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
  }, s.colorScheme);
  await page.waitForTimeout(200);
  const path = join(outDir, `${s.name}.png`);
  await page.locator(".card").first().screenshot({ path });
  console.log("wrote", path);
  await page.close();
}

await browser.close();
server.close();
writeFileSync(join(outDir, "README.md"), `# Asshield widget screenshots

Generated headlessly with Playwright + mock \`window.openai\`.

- quote-consent-light.png / quote-consent-dark.png
- quote-progress-light.png
- quote-confirmation-light.png / quote-confirmation-dark.png
- agent-card-light.png / agent-card-dark.png

Use these if the OpenAI Plugins portal requests screenshots of custom UI.
`);
console.log("done");
