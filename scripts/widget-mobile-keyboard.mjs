// Mobile keyboard/scroll test: 390x844 iPhone-like viewport. Opening the keyboard is simulated by shrinking the
// viewport (visualViewport) to 390x480 and window.openai.maxHeight to 480. For every field on every step of every
// product, focus it and check it is fully visible above the keyboard, then check the card scrolls back to the top.
// Also checks the consent-screen what-to-have-ready checkboxes toggle, persist across a remount, and cause no redraw.
// Usage: MCP_URL=... node scripts/widget-mobile-keyboard.mjs [product ...]
import { setTimeout as sleep } from "node:timers/promises";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
const MCP = process.env.MCP_URL || "https://mcp.asshield.com/mcp";
const OUT = process.env.OUT_DIR || "/workspace/harness-out";
const KB = 336, OVERLAY = 110, KB_H = 844 - KB;
const ONLY = process.argv.slice(2);
let id = 1;
async function rpc(method, params) {
  const r = await fetch(MCP, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: id++, method, params }) });
  const raw = await r.text();
  for (const l of raw.split("\n")) if (l.startsWith("data:")) return JSON.parse(l.slice(5));
  return JSON.parse(raw);
}
await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "grokbot-mobile-test", version: "1" } });
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { executablePath: "/usr/bin/google-chrome" });
const PRODUCTS = [["home","KY","40509"],["auto","KY","40509"],["auto_home","OH","43215"],["renters","TN","37203"],["commercial_auto","TX","75201"],["commercial_gl","FL","32548"],["workers_comp","GA","30303"],["boat","FL","32548"],["golf_cart","SC","29577"],["motorcycle","IN","46204"],["trucking","PA","17101"]].filter(p => !ONLY.length || ONLY.includes(p[0]));

async function mount(uri, toolOutput, rec) {
  const html = (await rpc("resources/read", { uri })).result.contents[0].text;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("pageerror", e => rec.pageErrors.push(String(e)));
  await page.exposeFunction("__callTool", async (name, args) => {
    const x = await rpc("tools/call", { name, arguments: args });
    if (x.error) throw new Error(x.error.message);
    if (x.result?.isError) throw new Error(String(x.result.content?.[0]?.text).slice(0, 200));
    return x.result;
  });
  await page.addInitScript((j) => {
    window.__fs = 0;
    window.openai = {
      get toolOutput() { return JSON.parse(j); }, theme: (new URLSearchParams(location.search).get("theme") || "light"), maxHeight: 844,
      get displayMode() { return sessionStorage.getItem("dm") || "inline"; }, safeArea: { insets: { top: 110, bottom: 0, left: 0, right: 0 } },
      userAgent: { device: { type: "mobile" } },
      get widgetState() { try { return JSON.parse(sessionStorage.getItem("ws") || "null"); } catch (_) { return null; } },
      setWidgetState(s) { sessionStorage.setItem("ws", JSON.stringify(s)); },
      notifyIntrinsicHeight(h) { window.__h = h; },
      requestDisplayMode(m) { window.__fs++; sessionStorage.setItem("dm", m.mode); setTimeout(() => window.dispatchEvent(new CustomEvent("openai:set_globals", { detail: { globals: { displayMode: m.mode } } })), 0); return Promise.resolve(m); },
      callTool: (n, a) => window.__callTool(n, a), sendFollowUpMessage(p) { window.__follow = p; }
    };
  }, JSON.stringify(toolOutput));
  await page.route("http://widget.test/**", r => r.fulfill({ status: 200, contentType: "text/html", body: html }));
  await page.goto("http://widget.test/card.html" + (process.env.THEME ? "?theme=" + process.env.THEME : ""));
  return { page, ctx };
}
async function keyboard(page, open) {
  await page.setViewportSize({ width: 390, height: open ? KB_H : 844 });
  await page.evaluate((h) => { window.openai.maxHeight = h; window.dispatchEvent(new CustomEvent("openai:set_globals", { detail: { globals: { maxHeight: h } } })); }, open ? KB_H : 844);
  await sleep(150);
}
async function checkFields(page, stepName, results) {
  if (await page.$("#ask-toggle") && await page.$eval("#ask-panel", e => e.classList.contains("is-hidden"))) await page.click("#ask-toggle");
  const sels = await page.evaluate(() => [...document.querySelectorAll("#panels input, #panels select, #panels textarea, #ask-input, body > .card input, body > .card select, body > .card textarea")]
    .filter(el => { const t = (el.type || "").toLowerCase(); return !["checkbox", "radio", "hidden", "button"].includes(t) && el.offsetParent !== null && el.id; })
    .map(el => "#" + el.id).filter((v, i, a) => a.indexOf(v) === i));
  await keyboard(page, true);
  for (const sel of sels) {
    await page.tap(sel).catch(async () => { await page.focus(sel); });
    await sleep(700);
    const r = await page.evaluate((s) => {
      const el = document.querySelector(s); const b = el.getBoundingClientRect();
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      return { sy: Math.round(document.scrollingElement.scrollTop), dh: document.scrollingElement.scrollHeight, top: Math.round(b.top), bottom: Math.round(b.bottom), vh: Math.round(vh), focused: document.activeElement === el, fontPx: parseFloat(getComputedStyle(el).fontSize) };
    }, sel);
    const fs = await page.evaluate(() => window.openai.displayMode === "fullscreen");
    const visible = fs ? (r.top >= OVERLAY && r.bottom <= r.vh) : (r.top >= 0 && r.bottom <= r.vh);
    results.push({ step: stepName, field: sel, pass: visible && r.focused && r.fontPx >= 16, detail: visible ? "" : `rect ${r.top}-${r.bottom} vs ${r.vh} scrollY=${r.sy} docH=${r.dh} focused=${r.focused}`, fontPx: r.fontPx });
  }
  // scroll back to top with a real touch-style wheel gesture and confirm the card header is reachable
  await page.mouse.move(195, 300);
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, -600); await sleep(40); }
  await sleep(300);
  const topOk = await page.evaluate((ov) => { const fs = window.openai.displayMode === "fullscreen"; const h = document.querySelector(".hero") || document.querySelector(".card"); const b = h.getBoundingClientRect(); return fs ? (b.top >= ov - 2 && b.top < ov + 80) : (b.top >= -1 && b.top < 60); }, OVERLAY);
  const dbg = topOk ? "" : await page.evaluate(() => { const h = document.querySelector(".hero") || document.querySelector(".card"); return `hero.top=${Math.round(h.getBoundingClientRect().top)} body.scrollTop=${document.body.scrollTop} doc.scrollTop=${document.scrollingElement.scrollTop}`; });
  results.push({ step: stepName, field: "(scroll back to top)", pass: topOk, detail: topOk ? "" : "header not reachable " + dbg });
  await page.evaluate(() => document.activeElement?.blur?.());
  await keyboard(page, false);
}
async function stepId(page) {
  return page.evaluate(() => {
    const has = (s) => !!document.querySelector(s);
    if (has("#btn-submit")) return "review"; if (has("#first_name")) return "contact"; if (has("#d_first")) return "drivers";
    if (has("#v_year")) return "vehicles"; if (has("#business_name")) return "business"; if (has("#auth_ok")) return "consent";
    if (has("#cov-pref")) return "prefs"; if (has("#carrier")) return "policy";
    if (has("#boat_year")||has("#cart_year")||has("#annual_payroll_estimate")||has("#operations_description")||has("#property_notes")) return "details";
    if (has("#btn-begin")) return "consent_intro"; return "unknown";
  });
}
async function clickWait(page, sel) {
  await page.evaluate(() => { document.getElementById("status").textContent = "__"; });
  await page.click(sel);
  await page.waitForFunction(() => { const t = document.getElementById("status").textContent; return t !== "__" && !/…$/.test(t); }, null, { timeout: 30000 }).catch(() => {});
  await sleep(300);
}
const all = { products: [], otherCards: {} };
for (const [product, state, zip] of PRODUCTS) {
  const rec = { product, quote_id: null, fields: [], checks: {}, pageErrors: [] };
  all.products.push(rec);
  try {
    const sc = (await rpc("tools/call", { name: "start_quote", arguments: { product, state, zip } })).result.structuredContent;
    rec.quote_id = sc.quote?.id || sc.quote_id;
    let { page, ctx } = await mount("ui://widget/asshield-quote-card/v1.html", sc, rec);
    await sleep(600);
    rec.checks.inline_no_scroll_trap = await page.evaluate(() => {
      const b = getComputedStyle(document.body), h = getComputedStyle(document.documentElement);
      const trap = ["auto", "scroll"].includes(b.overflowY) || ["auto", "scroll"].includes(h.overflowY) || b.touchAction === "none" || h.touchAction === "none";
      return !trap && !document.documentElement.classList.contains("is-fullscreen") ? "pass" : `FAIL body=${b.overflowY} html=${h.overflowY} touch=${b.touchAction}`;
    });
    const beginBottom = await page.$eval("#btn-begin", e => Math.round(e.getBoundingClientRect().bottom + window.scrollY));
    rec.checks.consent_continue_offset_px = beginBottom <= 780 ? `pass (${beginBottom}px from card top)` : `FAIL ${beginBottom}px`;
    await page.screenshot({ path: `${OUT}/mobile-${product}-consent${process.env.THEME ? "-" + process.env.THEME : ""}.png` }).catch(() => {});
    // consent checklist checkboxes
    const n = await page.$$eval("#ready-list input[type=checkbox]", l => l.length);
    const startUnchecked = await page.$$eval("#ready-list input[type=checkbox]", l => l.every(c => !c.checked));
    await page.evaluate(() => { window.__mut = 0; new MutationObserver(m => window.__mut += m.length).observe(document.getElementById("panels"), { childList: true, subtree: true }); });
    await page.evaluate(() => { window.__touch = 0; document.addEventListener("touchstart", () => window.__touch++, { passive: true }); });
    const labels = await page.$$("#ready-list .ready-item span");
    if (labels[0]) await labels[0].tap(); if (labels[2]) await labels[2].tap();
    await sleep(300);
    if (labels[2]) await labels[2].tap(); // uncheck again
    await sleep(300);
    const after = await page.$$eval("#ready-list input[type=checkbox]", l => l.map(c => c.checked));
    const strike = await page.$$eval("#ready-list .ready-item span", l => l.some(e => getComputedStyle(e).textDecorationLine.includes("line-through")));
    const target = await page.$eval("#ready-list .ready-item", e => e.getBoundingClientRect().height);
    const redraws = await page.evaluate(() => window.__mut);
    rec.checks.real_touch_events = (await page.evaluate(() => window.__touch)) >= 2 ? "pass" : "FAIL no touchstart";
    rec.checks.ready_checkboxes = n > 0 && startUnchecked && after[0] === true && (after.length < 3 || after[2] === false) && !strike && target >= 44 && redraws === 0
      ? `pass (${n} items, tap target ${Math.round(target)}px)` : `FAIL n=${n} startUnchecked=${startUnchecked} after=${after} strike=${strike} target=${target} redraws=${redraws}`;
    await page.reload(); await sleep(800);
    const persisted = await page.$$eval("#ready-list input[type=checkbox]", l => l.map(c => c.checked));
    rec.checks.ready_persist_after_remount = persisted[0] === true && (persisted.length < 3 || persisted[2] === false) ? "pass" : "FAIL " + persisted;
    await checkFields(page, "consent_intro", rec.fields);
    await page.click("#btn-begin"); await sleep(800);
    rec.checks.fullscreen_requested = (await page.evaluate(() => window.__fs)) >= 1 ? "pass" : "FAIL";
    for (let guard = 0; guard < 14; guard++) {
      const sid = await stepId(page);
      await checkFields(page, sid, rec.fields);
      if (sid === "review") break;
      if (sid === "contact") {
        await page.fill("#first_name", "TEST"); await page.fill("#last_name", "Grok Bot"); await page.fill("#email", "quote@asshield.com");
        await page.fill("#street", "1 Test St automated test ignore"); await page.fill("#city", "Testville"); await page.fill("#address_state", state); await page.fill("#address_zip", zip);
        await page.click('#residence button[data-v="own"]');
      }
      if (sid === "drivers") { await page.fill("#d_first", "TEST"); await page.fill("#d_last", "Grok Bot"); await page.fill("#d_dob", "1990-01-01"); await clickWait(page, "#btn-add-driver"); }
      if (sid === "vehicles") { await page.selectOption("#v_year", "2020"); await page.fill("#v_make", "Toyota"); await page.fill("#v_model", "TEST Camry"); await clickWait(page, "#btn-add-vehicle"); }
      if (sid === "business") { await page.fill("#business_name", "TEST Grok Bot LLC automated test ignore"); await page.fill("#business_type_or_description", "Test only");
        if (await page.$("#cargo_type")) { await page.tap('#radius button[data-v="local"]'); await page.fill("#cargo_type", "TEST freight"); await page.fill("#power_unit_count", "2"); } }
      if (sid === "details") {
        if (await page.$("#boat_year")) { await page.selectOption("#boat_year", "2018"); await page.fill("#boat_make", "TEST Bayliner"); }
        if (await page.$("#cart_year")) { await page.selectOption("#cart_year", "2021"); await page.fill("#cart_make", "TEST Club Car"); }
        if (await page.$("#annual_payroll_estimate")) { await page.fill("#annual_payroll_estimate", "100000"); await page.fill("#employees_by_job_type", "2 office, test only"); }
        if (await page.$("#operations_description")) await page.fill("#operations_description", "Test only");
        if (await page.$("#property_notes")) await page.fill("#property_notes", "automated test, ignore");
      }
      if (sid === "policy") { await page.fill("#carrier", "TEST Carrier"); await page.fill("#current_premium", "1200"); }
      if (sid === "consent") {
        await page.tap("label[for=auth_ok]"); await sleep(200);
        rec.checks.consent_checkbox_tappable = (await page.$eval("#auth_ok", c => c.checked)) && (await page.$eval("label[for=auth_ok]", e => e.getBoundingClientRect().height)) >= 44 ? "pass" : "FAIL";
      }
      await clickWait(page, "#btn-next");
      if ((await stepId(page)) === sid) { rec.checks.stuck = "FAIL stuck at " + sid; break; }
    }
    rec.checks.reached_review = (await stepId(page)) === "review" ? "pass" : "FAIL";
    await page.evaluate(() => scrollTo(0, 0)); await sleep(200);
    await page.screenshot({ path: `${OUT}/mobile-${product}-review${process.env.THEME ? "-" + process.env.THEME : ""}.png` });
    await ctx.close();
  } catch (e) { rec.error = String(e).slice(0, 300); }
  const bad = rec.fields.filter(f => !f.pass);
  rec.checks.fields_visible_with_keyboard = bad.length ? `FAIL ${bad.length}/${rec.fields.length}: ` + bad.map(b => `${b.step}${b.field} ${b.detail}`).join("; ") : `pass (${rec.fields.length} field checks)`;
  writeFileSync(`${OUT}/mobile-results.json`, JSON.stringify(all, null, 1));
  console.log(product, rec.quote_id, JSON.stringify(rec.checks), rec.error || "", rec.pageErrors.join("|"));
}
for (const [tool, args, uri] of [["show_insurance_options", {}, "ui://widget/asshield-options-card/v1.html"], ["explain_coverage", { product: "auto" }, "ui://widget/asshield-coverage-card/v1.html"], ["get_agent_contact", {}, "ui://widget/asshield-agent-card/v1.html"]]) {
  const rec = { pageErrors: [], fields: [] };
  const r = await rpc("tools/call", { name: tool, arguments: args });
  const { page, ctx } = await mount(uri, r.result.structuredContent, rec); await sleep(600);
  await checkFields(page, tool, rec.fields);
  const bad = rec.fields.filter(f => !f.pass);
  all.otherCards[tool] = bad.length ? "FAIL " + bad.map(b => b.field + " " + b.detail).join("; ") : `pass (${rec.fields.map(f => f.field).join(", ")})`;
  await ctx.close();
}
writeFileSync(`${OUT}/mobile-results.json`, JSON.stringify(all, null, 1));
console.log("otherCards", JSON.stringify(all.otherCards));
await browser.close();
