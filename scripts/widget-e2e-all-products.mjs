import { setTimeout as sleep } from "node:timers/promises";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
const MCP = process.env.MCP_URL || "https://mcp.asshield.com/mcp"; const OUT = "/workspace/harness-out/live";
const ONLY = process.argv.slice(2);
let id = 1;
async function rpc(method, params) {
  const r = await fetch(MCP, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: id++, method, params }) });
  const raw = await r.text();
  for (const l of raw.split("\n")) if (l.startsWith("data:")) return JSON.parse(l.slice(5));
  return JSON.parse(raw);
}
await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "grokbot-live-e2e", version: "1" } });
const tools = (await rpc("tools/list", {})).result.tools.map(t => t.name);
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const PRODUCTS = [["home","KY","40509"],["auto","KY","40509"],["auto_home","OH","43215"],["renters","TN","37203"],["commercial_auto","TX","75201"],["commercial_gl","FL","32548"],["workers_comp","GA","30303"],["boat","FL","32548"],["golf_cart","SC","29577"],["motorcycle","IN","46204"],["trucking","PA","17101"]].filter(p => !ONLY.length || ONLY.includes(p[0]));

async function mount(uri, toolOutput, rec) {
  const html = (await rpc("resources/read", { uri })).result.contents[0].text;
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("pageerror", e => rec.pageErrors.push(String(e)));
  await page.exposeFunction("__callTool", async (name, args) => {
    const x = await rpc("tools/call", { name, arguments: args });
    const sc = x.result?.structuredContent;
    const bad = x.error?.message || (x.result?.isError ? String(x.result.content?.[0]?.text).slice(0, 300) : null) || (sc && sc.ok === false ? sc.message : null);
    rec.calls.push(bad ? `${name}: FAIL ${bad}` : `${name}: ok`);
    if (x.error) throw new Error(x.error.message);
    if (x.result?.isError) throw new Error(String(x.result.content?.[0]?.text).slice(0, 200));
    return x.result;
  });
  await page.addInitScript((j) => {
    let ws = null; window.__setWS = 0;
    window.openai = { get toolOutput() { return JSON.parse(j); }, theme: "light", get widgetState() { return ws; },
      setWidgetState(s) { ws = s; window.__setWS++; setTimeout(() => window.dispatchEvent(new CustomEvent("openai:set_globals", { detail: { globals: { widgetState: s } } })), 0); },
      notifyIntrinsicHeight() {}, callTool: (n, a) => window.__callTool(n, a), sendFollowUpMessage(p) { window.__follow = p; } };
  }, JSON.stringify(toolOutput));
  await page.route("http://widget.test/**", r => r.fulfill({ status: 200, contentType: "text/html", body: html }));
  await page.goto("http://widget.test/card.html");
  await page.evaluate(() => { window.__mut = 0; new MutationObserver(m => { window.__mut += m.filter(x => { const t = x.target.nodeType === 1 ? x.target : x.target.parentElement; return !(t && t.closest && t.closest("#ask-slot")); }).length; }).observe(document.body, { childList: true, subtree: true, characterData: true }); });
  return page;
}
async function idle(page, ms) { await page.evaluate(() => { window.__mut = 0; }); await sleep(ms); return page.evaluate(() => window.__mut); }
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
  return page.$eval("#status", e => e.textContent);
}
async function askCheck(page, q) {
  await page.evaluate(() => { window.__follow = null; });
  if (!(await page.$("#ask-toggle"))) return "FAIL no ask button";
  if (await page.$eval("#ask-panel", e => e.classList.contains("is-hidden"))) await page.click("#ask-toggle");
  await page.fill("#ask-input", q); await page.click("#ask-send"); await sleep(300);
  const pr = await page.evaluate(() => window.__follow?.prompt || null);
  return pr && pr.endsWith(q) ? "pass: " + pr : "FAIL prompt=" + pr;
}
const all = { tools, products: [] };
for (const [product, state, zip] of PRODUCTS) {
  const rec = { product, state, zip, checks: {}, steps: [], calls: [], pageErrors: [] };
  all.products.push(rec);
  try {
    const start = await rpc("tools/call", { name: "start_quote", arguments: { product, state, zip } });
    const sc = start.result.structuredContent; rec.quote_id = sc.quote?.id || sc.quote_id;
    rec.checks.start_quote = rec.quote_id ? "pass" : "FAIL " + JSON.stringify(sc).slice(0, 200);
    rec.checks.plain_text_no_tilde = /~/.test(JSON.stringify(start.result.content)) ? "FAIL tilde" : "pass";
    const page = await mount("ui://widget/asshield-quote-card/v1.html", sc, rec);
    await sleep(500);
    const m = await idle(page, 8000);
    rec.checks.no_redraw_consent_8s = m === 0 ? "pass" : `FAIL ${m} DOM changes`;
    rec.checks.no_strikethrough = (await page.evaluate(() => [...document.querySelectorAll(".checklist .txt")].some(e => getComputedStyle(e).textDecorationLine.includes("line-through")))) ? "FAIL" : "pass";
    await page.screenshot({ path: `${OUT}-${product}-1-consent.png`, fullPage: true });
    {
      const spans = await page.$$("#ready-list .ready-item span");
      if (spans[0]) await spans[0].click(); if (spans[1]) { await spans[1].click(); await spans[1].click(); }
      await sleep(200);
      const st = await page.$$eval("#ready-list input[type=checkbox]", l => l.map(c => c.checked));
      const ws = await page.evaluate(() => window.openai.widgetState?.ready || {});
      const wsOn = Object.values(ws).filter(Boolean).length;
      rec.checks.ready_checkbox_toggle_persist = spans.length && st[0] === true && st[1] === false && wsOn === 1 ? `pass (${spans.length} boxes)` : `FAIL boxes=${spans.length} state=${st} widgetState=${JSON.stringify(ws)}`;
    }
    rec.checks.ask_on_consent = await askCheck(page, "Do I need my declarations page?");
    await page.evaluate(() => { window.__follow = null; }); await page.fill("#ask-input", "my ssn is 123-45-6789"); await page.click("#ask-send"); await sleep(200);
    rec.checks.ask_blocks_ssn = (await page.evaluate(() => window.__follow)) === null ? "pass" : "FAIL sent";
    await page.click("#btn-begin"); await sleep(1500);
    rec.checks.tap_opens_contact = (await stepId(page)) === "contact" ? "pass" : "FAIL on " + await stepId(page);
    await page.fill("#first_name", "TEST"); await page.fill("#last_name", "Grok Bot");
    await page.fill("#email", "quote@asshield.com"); await page.fill("#street", "1 Test St automated test ignore");
    await page.fill("#city", "Testville"); await page.fill("#address_state", state); await page.fill("#address_zip", zip);
    await page.click('#residence button[data-v="own"]');
    const m2 = await idle(page, 5000);
    rec.checks.typed_input_persists = (await page.inputValue("#first_name")) === "TEST" && m2 === 0 ? "pass" : `FAIL value=${await page.inputValue("#first_name")} changes=${m2}`;
    rec.checks.ask_on_contact_keeps_form = (await askCheck(page, "Can I use my work email?")) + ((await page.inputValue("#first_name")) === "TEST" ? "" : " FAIL form reset");
    for (let guard = 0; guard < 14; guard++) {
      const sid = await stepId(page);
      if (sid === "review") break;
      if (sid === "drivers") {
        await page.fill("#d_first", "TEST"); await page.fill("#d_last", "Grok Bot"); await page.fill("#d_dob", "1990-01-01");
        rec.steps.push({ step: "add_driver", status: await clickWait(page, "#btn-add-driver") });
      }
      if (sid === "vehicles") {
        await page.selectOption("#v_year", "2020"); await page.fill("#v_make", "Toyota"); await page.fill("#v_model", "TEST Camry");
        rec.steps.push({ step: "add_vehicle", status: await clickWait(page, "#btn-add-vehicle") });
      }
      if (sid === "business") { await page.fill("#business_name", "TEST Grok Bot LLC automated test ignore"); await page.fill("#business_type_or_description", "Test only"); }
      if (sid === "details") {
        if (await page.$("#boat_year")) { await page.selectOption("#boat_year", "2018"); await page.fill("#boat_make", "TEST Bayliner"); }
        if (await page.$("#cart_year")) { await page.selectOption("#cart_year", "2021"); await page.fill("#cart_make", "TEST Club Car"); }
        if (await page.$("#annual_payroll_estimate")) { await page.fill("#annual_payroll_estimate", "100000"); await page.fill("#employees_by_job_type", "2 office, test only"); }
        if (await page.$("#operations_description")) await page.fill("#operations_description", "Test only, automated test ignore");
        if (await page.$("#property_notes")) await page.fill("#property_notes", "automated test, ignore");
      }
      if (sid === "policy") { await page.fill("#carrier", "TEST Carrier"); await page.fill("#current_premium", "1200"); await page.click('#freq button[data-v="6_month"]'); }
      if (sid === "consent") await page.check("#auth_ok");
      const status = await clickWait(page, "#btn-next");
      const after = await stepId(page);
      rec.steps.push({ step: sid, status, next: after });
      if (after === sid) { rec.stuckAt = sid; break; }
    }
    const fin = await stepId(page);
    rec.checks.reached_review = fin === "review" ? "pass" : "FAIL stuck at " + fin;
    rec.checks.submit_enabled_after_consent = fin === "review" && await page.$eval("#btn-submit", b => !b.disabled) ? "pass" : "FAIL";
    rec.checks.ask_on_review = fin === "review" ? await askCheck(page, "What happens after I submit?") : "n/a";
    rec.checks.no_redraw_review_5s = fin === "review" ? ((await idle(page, 5000)) === 0 ? "pass" : "FAIL") : "n/a";
    rec.checks.widget_tool_calls = rec.calls.some(c => c.includes("FAIL")) ? "FAIL" : "pass";
    await page.screenshot({ path: `${OUT}-${product}-2-end.png`, fullPage: true });
    await page.close();
  } catch (e) { rec.error = String(e).slice(0, 400); }
  writeFileSync("/workspace/harness-out/live-all.json", JSON.stringify(all, null, 1));
  console.log(product, JSON.stringify(rec.checks), rec.error || "");
}
// other cards
all.otherCards = {};
for (const [tool, args, uri] of [["show_insurance_options", {}, "ui://widget/asshield-options-card/v1.html"], ["explain_coverage", { product: "auto" }, "ui://widget/asshield-coverage-card/v1.html"], ["explain_coverage", { product: "commercial_gl" }, "ui://widget/asshield-coverage-card/v1.html"], ["get_agent_contact", {}, "ui://widget/asshield-agent-card/v1.html"]]) {
  const rec = { calls: [], pageErrors: [] };
  const r = await rpc("tools/call", { name: tool, arguments: args });
  const key = tool + (args.product ? ":" + args.product : "");
  if (r.error || r.result?.isError) { all.otherCards[key] = "FAIL tool error"; continue; }
  const p = await mount(uri, r.result.structuredContent, rec); await sleep(500);
  const m = await idle(p, 6000);
  const askRes = await askCheck(p, "Which line fits a home business?");
  let nav = " ask:" + askRes.slice(0, 120);
  const btn = tool === "show_insurance_options" ? null : tool === "explain_coverage" ? "#btn-options" : null;
  if (tool === "show_insurance_options") { await p.fill("#zip", "40509"); await p.dispatchEvent("#zip", "input"); await sleep(300); const tile = await p.$("button.line-tile, .grid button, [data-id]"); if (tile) await tile.click(); await sleep(300); if (await p.$eval("#btn-start", b => !b.disabled).catch(() => false)) { await p.click("#btn-start"); await sleep(800); nav += " startButton->" + JSON.stringify(await p.evaluate(() => window.__follow?.prompt || null)); } else nav += " startButton disabled/untested"; }
  if (btn && await p.$(btn)) { await p.click(btn); await sleep(800); nav += " navButton->" + JSON.stringify(await p.evaluate(() => window.__follow?.prompt || null)); }
  all.otherCards[key] = (m === 0 ? "pass" : `FAIL ${m} DOM changes`) + nav + (rec.pageErrors.length ? " pageErrors:" + rec.pageErrors.join("|") : "");
  await p.screenshot({ path: `${OUT}-card-${key.replace(":", "-")}.png`, fullPage: true }); await p.close();
}
writeFileSync("/workspace/harness-out/live-all.json", JSON.stringify(all, null, 1));
console.log("otherCards", JSON.stringify(all.otherCards));
await browser.close();
