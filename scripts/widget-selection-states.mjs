// Selection-state test at 390x844 (light + dark): on every step of every product, tap one option in every
// segmented control / option-card group, then check (1) exactly one selected with aria-checked, (2) a visible check mark,
// (3) contrast: selected boundary vs surface, selected vs unselected boundary, text on gold, unselected boundary vs surface,
// (4) no element extends past the card and no horizontal scroll, (5) 44px tap targets, (6) no redraw after tapping.
// Usage: MCP_URL=... THEME=dark|light node scripts/widget-selection-states.mjs [product ...]
import { setTimeout as sleep } from "node:timers/promises";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
const MCP = process.env.MCP_URL || "https://mcp.asshield.com/mcp";
const THEME = process.env.THEME || "dark";
const OUT = (process.env.OUT_DIR || "/workspace/harness-out/sel") + "/" + THEME;
const ONLY = process.argv.slice(2);
let id = 1;
async function rpc(method, params) {
  const r = await fetch(MCP, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: id++, method, params }) });
  const raw = await r.text();
  for (const l of raw.split("\n")) if (l.startsWith("data:")) return JSON.parse(l.slice(5));
  return JSON.parse(raw);
}
await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "grokbot-selection-test", version: "1" } });
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const PRODUCTS = [["home","KY","40509"],["auto","KY","40509"],["auto_home","OH","43215"],["renters","TN","37203"],["commercial_auto","TX","75201"],["commercial_gl","FL","32548"],["workers_comp","GA","30303"],["boat","FL","32548"],["golf_cart","SC","29577"],["motorcycle","IN","46204"],["trucking","PA","17101"]].filter(p => !ONLY.length || ONLY.includes(p[0]));
const { mkdirSync } = await import("node:fs"); mkdirSync(OUT, { recursive: true });

async function mount(uri, toolOutput, rec) {
  const html = (await rpc("resources/read", { uri })).result.contents[0].text;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("pageerror", e => rec.pageErrors.push(String(e)));
  await page.exposeFunction("__callTool", async (name, args) => { const x = await rpc("tools/call", { name, arguments: args }); if (x.error) throw new Error(x.error.message); return x.result; });
  await page.addInitScript(([j, theme]) => {
    let ws = null;
    window.openai = { get toolOutput() { return JSON.parse(j); }, theme, maxHeight: 844, displayMode: "inline", userAgent: { device: { type: "mobile" } },
      get widgetState() { return ws; }, setWidgetState(s) { ws = s; }, notifyIntrinsicHeight() {}, requestDisplayMode(m) { return Promise.resolve(m); },
      callTool: (n, a) => window.__callTool(n, a), sendFollowUpMessage(p) { window.__follow = p; } };
  }, [JSON.stringify(toolOutput), THEME]);
  await page.route("http://widget.test/**", r => r.fulfill({ status: 200, contentType: "text/html", body: html }));
  await page.goto("http://widget.test/card.html");
  return { page, ctx };
}
async function stepId(page) {
  return page.evaluate(() => { const h = s => !!document.querySelector(s);
    if (h("#btn-begin")) return "consent_intro"; if (h("#btn-submit")) return "review"; if (h("#first_name")) return "contact"; if (h("#d_first")) return "drivers";
    if (h("#v_year")) return "vehicles"; if (h("#business_name")) return "business"; if (h("#auth_ok")) return "consent"; if (h("#cov-pref")) return "prefs"; if (h("#carrier")) return "policy";
    if (h("#boat_year") || h("#cart_year") || h("#annual_payroll_estimate") || h("#operations_description") || h("#property_notes")) return "details"; return "?"; });
}
// Runs in the page: measure every selectable group.
const MEASURE = () => {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return [0,0,0,0]; const p = m[1].split(",").map(x => parseFloat(x)); return [p[0],p[1],p[2],p.length > 3 ? p[3] : 1]; };
  const blend = (fg, bg) => [0,1,2].map(i => fg[i]*fg[3] + bg[i]*(1-fg[3])).concat(1);
  const surface = el => { const stack = []; for (let e = el; e; e = e.parentElement) stack.push(parse(getComputedStyle(e).backgroundColor)); let c = [255,255,255,1];
    const htmlDark = document.documentElement.classList.contains("theme-dark"); if (htmlDark) c = [10,18,27,1];
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i][3] > 0) c = blend(stack[i], c); return c; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }; return 0.2126*f(c[0]) + 0.7152*f(c[1]) + 0.0722*f(c[2]); };
  const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
  const card = document.querySelector(".card").getBoundingClientRect();
  const out = { groups: [], overflow: [], hscroll: document.scrollingElement.scrollWidth > document.scrollingElement.clientWidth + 1 };
  const clipped = e => { for (let a = e.parentElement; a && !a.classList.contains("card"); a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === "hidden" || o === "clip") return true; } return false; };
  document.querySelectorAll(".card *").forEach(e => { const r = e.getBoundingClientRect(); if (r.width && !clipped(e) && e.offsetParent !== null && (r.right > card.right + 1 || r.left < card.left - 1)) out.overflow.push((e.id || e.className || e.tagName).toString().slice(0, 40) + ` ${Math.round(r.left)}-${Math.round(r.right)}`); });
  document.querySelectorAll(".seg, .pref-grid, .chips").forEach(g => {
    const items = [...g.children].filter(c => c.matches("button")); if (!items.length) return;
    const sel = items.filter(i => i.classList.contains("on")); const uns = items.filter(i => !i.classList.contains("on"));
    const parentSurf = surface(g);
    const info = { id: g.id || g.className, n: items.length, selected: sel.length, aria_ok: items.every(i => (i.getAttribute("aria-checked") ?? i.getAttribute("aria-pressed")) === String(i.classList.contains("on"))),
      role: items[0].getAttribute("role") || "button", minH: Math.min(...items.map(i => i.getBoundingClientRect().height)) };
    if (sel[0]) { const s = getComputedStyle(sel[0]); const fill = blend(parse(s.backgroundColor), parentSurf); const edge = blend(parse(s.borderTopColor), parentSurf);
      const mark = getComputedStyle(sel[0], g.classList.contains("pref-grid") ? "::after" : "::before");
      info.sel_edge_vs_surface = +cr(edge, parentSurf).toFixed(2); info.sel_text_vs_fill = +cr(parse(s.color), fill).toFixed(2); info.check_icon = mark.content !== "none" && mark.content !== "normal";
      info.sel_border_px = parseFloat(s.borderTopWidth); info.sel_weight = s.fontWeight; }
    if (uns[0]) { const u = getComputedStyle(uns[0]); const ufill = blend(parse(u.backgroundColor), parentSurf); const uedge = blend(parse(u.borderTopColor), parentSurf);
      info.unsel_edge_vs_surface = +cr(uedge, parentSurf).toFixed(2); info.unsel_text_vs_fill = +cr(parse(u.color), ufill).toFixed(2);
      if (sel[0]) { const s = getComputedStyle(sel[0]); info.sel_vs_unsel_fill = +cr(blend(parse(s.backgroundColor), parentSurf), ufill).toFixed(2); info.sel_edge_vs_unsel_edge = +cr(blend(parse(s.borderTopColor), parentSurf), uedge).toFixed(2); } }
    out.groups.push(info);
  });
  return out;
};
function judge(m) {
  const bad = [];
  if (m.hscroll) bad.push("horizontal scroll");
  if (m.overflow.length) bad.push("overflow: " + m.overflow.slice(0, 4).join("; "));
  for (const g of m.groups) {
    const single = g.role === "radio";
    if (single && g.selected !== 1 && g.n > 1) bad.push(`${g.id}: ${g.selected} selected`);
    if (!g.aria_ok) bad.push(`${g.id}: aria out of sync`);
    if (g.minH < 44) bad.push(`${g.id}: tap ${g.minH}px`);
    if (g.selected) {
      if (!g.check_icon) bad.push(`${g.id}: no check icon`);
      if (g.sel_edge_vs_surface < 3) bad.push(`${g.id}: selected edge ${g.sel_edge_vs_surface}:1`);
      if (g.sel_text_vs_fill < 4.5) bad.push(`${g.id}: selected text ${g.sel_text_vs_fill}:1`);
      if (g.sel_edge_vs_unsel_edge != null && Math.max(g.sel_edge_vs_unsel_edge, g.sel_vs_unsel_fill) < 3 && g.sel_border_px < 2) bad.push(`${g.id}: selected vs unselected too close`);
    }
    if (g.unsel_edge_vs_surface != null && g.unsel_edge_vs_surface < 3) bad.push(`${g.id}: unselected edge ${g.unsel_edge_vs_surface}:1`);
    if (g.unsel_text_vs_fill != null && g.unsel_text_vs_fill < 4.5) bad.push(`${g.id}: unselected text ${g.unsel_text_vs_fill}:1`);
  }
  return bad;
}
async function pickAll(page) {
  // tap the LAST option of each single-select group (a non-default choice) with real touch events
  const targets = await page.evaluate(() => [...document.querySelectorAll(".seg, .pref-grid")].map(g => { const b = [...g.querySelectorAll("button")]; const t = b[b.length - 1]; return t ? (g.id ? `#${g.id} > button:last-child` : null) : null; }).filter(Boolean));
  for (const t of targets) { await page.tap(t); await sleep(120); }
  await page.evaluate(() => { window.__mut = 0; new MutationObserver(m => window.__mut += m.filter(x => !(x.target.closest && x.target.closest("#ask-slot"))).length).observe(document.getElementById("panels") || document.body, { childList: true, subtree: true, characterData: true }); });
  for (const t of targets) { await page.tap(t); await sleep(80); }
  await sleep(600);
  return { tapped: targets.length, redraws: await page.evaluate(() => window.__mut) };
}
const all = { theme: THEME, products: {} };
for (const [product, state, zip] of PRODUCTS) {
  const rec = { pageErrors: [], steps: {} };
  all.products[product] = rec;
  try {
    const start = await rpc("tools/call", { name: "start_quote", arguments: { product, state, zip, campaign: "TEST - Grok Bot automated e2e" } });
    const sc = start.result.structuredContent; rec.quote_id = sc.quote?.id || sc.quote_id;
    const { page, ctx } = await mount("ui://widget/asshield-quote-card/v1.html", sc, rec); await sleep(800);
    await page.tap("#btn-begin"); await sleep(1200);
    for (let guard = 0; guard < 14; guard++) {
      const sid = await stepId(page);
      if (sid === "contact") { await page.fill("#first_name", "TEST"); await page.fill("#last_name", "Grok Bot"); await page.fill("#email", "quote@asshield.com"); await page.fill("#street", "1 Test St automated test ignore"); await page.fill("#city", "Testville"); await page.fill("#address_state", state); await page.fill("#address_zip", zip); }
      if (sid === "drivers") { await page.fill("#d_first", "TEST"); await page.fill("#d_last", "Grok Bot"); await page.fill("#d_dob", "1990-01-01"); }
      if (sid === "vehicles") { await page.selectOption("#v_year", "2020"); await page.fill("#v_make", "Toyota"); await page.fill("#v_model", "TEST Camry"); }
      if (sid === "business") { await page.fill("#business_name", "TEST Grok Bot LLC automated test ignore"); await page.fill("#business_type_or_description", "Test only"); if (await page.$("#cargo_type")) { await page.fill("#cargo_type", "TEST freight"); await page.fill("#power_unit_count", "2"); } }
      if (sid === "details") {
        if (await page.$("#boat_year")) { await page.selectOption("#boat_year", "2018"); await page.fill("#boat_make", "TEST Bayliner"); }
        if (await page.$("#cart_year")) { await page.selectOption("#cart_year", "2021"); await page.fill("#cart_make", "TEST Club Car"); }
        if (await page.$("#annual_payroll_estimate")) { await page.fill("#annual_payroll_estimate", "100000"); await page.fill("#employees_by_job_type", "2 office, test only"); }
        if (await page.$("#operations_description")) await page.fill("#operations_description", "Test only");
        if (await page.$("#property_notes")) await page.fill("#property_notes", "automated test, ignore");
      }
      if (sid === "policy") { await page.fill("#carrier", "TEST Carrier"); await page.fill("#current_premium", "1200"); }
      const picks = await pickAll(page);
      if (sid === "contact") await page.tap('#residence button[data-v="own"]');
      await sleep(350); // let border/background transitions finish before measuring
      const m = await page.evaluate(MEASURE);
      const bad = judge(m);
      if (picks.redraws) bad.push(`redraws ${picks.redraws}`);
      rec.steps[sid] = { pass: bad.length === 0, bad, groups: m.groups.length, tapped: picks.tapped, metrics: m.groups };
      if (m.groups.length) {
        const first = await page.$(".seg, .pref-grid");
        await first.scrollIntoViewIfNeeded(); await sleep(100);
        await page.screenshot({ path: `${OUT}/${product}-${sid}.png` });
      }
      if (sid === "review") break;
      if (sid === "consent") await page.tap("label[for=auth_ok]");
      await page.tap("#btn-next"); await sleep(1800);
      if ((await stepId(page)) === sid) { rec.stuck = sid + ": " + await page.$eval("#status", e => e.textContent).catch(() => ""); break; }
    }
    await ctx.close();
  } catch (e) { rec.error = String(e).slice(0, 300); }
  const fails = Object.entries(rec.steps).filter(([, v]) => !v.pass).map(([k, v]) => `${k}: ${v.bad.join(", ")}`);
  console.log(product, THEME, fails.length || rec.stuck || rec.error ? "FAIL " + [fails.join(" | "), rec.stuck, rec.error].filter(Boolean).join(" | ") : `pass (${Object.keys(rec.steps).join(",")})`);
  writeFileSync(`${OUT}/results.json`, JSON.stringify(all, null, 1));
}
// other cards with selectable controls
for (const [tool, args, uri] of [["explain_coverage", { product: "auto" }, "ui://widget/asshield-coverage-card/v1.html"], ["get_agent_contact", {}, "ui://widget/asshield-agent-card/v1.html"]]) {
  const rec = { pageErrors: [] };
  const r = await rpc("tools/call", { name: tool, arguments: args });
  const { page, ctx } = await mount(uri, r.result.structuredContent, rec); await sleep(800);
  const chip = await page.$(".chips .chip"); if (chip) { await chip.tap(); await sleep(100); }
  await pickAll(page);
  const m = await page.evaluate(MEASURE); const bad = judge(m);
  const first = await page.$(".seg, .pref-grid"); if (first) { await first.scrollIntoViewIfNeeded(); await sleep(100); }
  await page.screenshot({ path: `${OUT}/card-${tool}.png` });
  console.log(tool, THEME, bad.length ? "FAIL " + bad.join(", ") : `pass (${m.groups.length} groups)`);
  all[tool] = { bad, metrics: m.groups };
  await ctx.close();
}
writeFileSync(`${OUT}/results.json`, JSON.stringify(all, null, 1));
await browser.close();
