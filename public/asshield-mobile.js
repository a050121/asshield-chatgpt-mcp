/* Asshield mobile keyboard + scroll helper (all cards).
   Inline (in the chat): no internal scroll container and no touch handlers, so swipes scroll the
   ChatGPT conversation. The card keeps its natural height and reports it via notifyIntrinsicHeight.
   Fullscreen: the body becomes a touch scroller with top padding that clears ChatGPT's overlay
   buttons, and a focused field is placed in the visible band between that overlay and the keyboard.
   Never re-renders card content, so it cannot cause redraw loops or reset form state. */
(function () {
  var root = document.documentElement;
  var lastReported = 0, fsAsked = false, blurTimer = null, vvTimer = null, focusTimer = null;
  var TOP_OVERLAY = 120, KB_GAP = 16;
  function oa() { return window.openai || {}; }
  function isField(el) {
    if (!el || !el.tagName) return false;
    var t = el.tagName;
    if (t === "TEXTAREA" || t === "SELECT") return true;
    if (t !== "INPUT") return false;
    var ty = (el.type || "text").toLowerCase();
    return ["checkbox", "radio", "button", "submit", "hidden"].indexOf(ty) < 0;
  }
  function isMobile() {
    try { var d = oa().userAgent && oa().userAgent.device; if (d && d.type) return d.type !== "desktop"; } catch (_) {}
    return (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || window.innerWidth < 600;
  }
  function isFullscreen() { return oa().displayMode === "fullscreen"; }
  function safeTop() {
    var s = 0;
    try { var sa = oa().safeArea; var ins = sa && (sa.insets || sa); if (ins && Number(ins.top) > 0) s = Number(ins.top); } catch (_) {}
    var envTop = parseFloat(getComputedStyle(root).getPropertyValue("--asshield-env-top")) || 0;
    return Math.max(TOP_OVERLAY, s + 12, envTop + TOP_OVERLAY);
  }
  function applyMode() {
    var fs = isFullscreen();
    root.classList.toggle("is-fullscreen", fs);
    if (fs) {
      var vv = window.visualViewport;
      var h = vv ? vv.height : window.innerHeight;
      var mh = Number(oa().maxHeight) || 0;
      if (mh > 0) h = Math.min(h, mh);
      root.style.setProperty("--asshield-avail-h", Math.floor(h) + "px");
      root.style.setProperty("--asshield-top-pad", Math.round(safeTop()) + "px");
    }
  }
  function report() {
    applyMode();
    try {
      if (typeof oa().notifyIntrinsicHeight !== "function") return;
      var card = document.querySelector(".card");
      var h = Math.ceil((card ? card.getBoundingClientRect().height : document.body.scrollHeight) + 12);
      if (Math.abs(h - lastReported) < 4) return;
      lastReported = h;
      oa().notifyIntrinsicHeight(h);
    } catch (_) {}
  }
  function askFullscreen() {
    if (fsAsked || !isMobile()) return;
    fsAsked = true;
    try {
      if (isFullscreen()) return;
      if (typeof oa().requestDisplayMode === "function") {
        var p = oa().requestDisplayMode({ mode: "fullscreen" });
        if (p && p.then) p.then(function () { setTimeout(applyMode, 50); }, function () {});
      }
    } catch (_) {}
  }
  function scroller() { return document.scrollingElement || root; }
  // Put the field (and its label) inside the band between the top overlay and the keyboard; skip if already comfortable.
  function keepVisible(el) {
    if (!el || !el.isConnected || document.activeElement !== el) return;
    var vv = window.visualViewport;
    var vTop = vv ? vv.offsetTop : 0;
    var vH = vv ? vv.height : window.innerHeight;
    var bandTop = vTop + (isFullscreen() ? safeTop() : 12);
    var bandBottom = vTop + vH - KB_GAP;
    if (bandBottom - bandTop < 60) return;
    var r = el.getBoundingClientRect();
    var label = el.id ? document.querySelector('label[for="' + el.id + '"]') : null;
    var top = r.top;
    if (label) { var lr = label.getBoundingClientRect(); if (lr.bottom <= r.top + 2 && r.top - lr.top < 48) top = lr.top; }
    if (top >= bandTop && r.bottom <= bandBottom) return;
    var h = r.bottom - top;
    var desiredTop = h >= bandBottom - bandTop ? bandTop : bandTop + (bandBottom - bandTop - h) / 2;
    var delta = top - desiredTop;
    var sc = scroller();
    try { sc.scrollBy({ top: delta, behavior: "auto" }); } catch (_) { sc.scrollTop += delta; }
  }
  document.addEventListener("focusin", function (e) {
    if (!isField(e.target)) return;
    clearTimeout(blurTimer);
    root.classList.add("kb-open");
    applyMode();
    var el = e.target;
    clearTimeout(focusTimer);
    focusTimer = setTimeout(function () { keepVisible(el); focusTimer = setTimeout(function () { keepVisible(el); }, 400); }, 380); // after iOS's own focus scroll + keyboard animation, then one settle re-check (no-op when already visible)
  });
  document.addEventListener("focusout", function () {
    clearTimeout(blurTimer);
    blurTimer = setTimeout(function () {
      if (!isField(document.activeElement)) { root.classList.remove("kb-open"); applyMode(); }
    }, 250);
  });
  function onViewport() {
    clearTimeout(vvTimer);
    vvTimer = setTimeout(function () {
      applyMode();
      var el = document.activeElement;
      if (isField(el)) keepVisible(el);
    }, 200);
  }
  if (window.visualViewport) window.visualViewport.addEventListener("resize", onViewport, { passive: true });
  window.addEventListener("resize", onViewport, { passive: true });
  window.addEventListener("openai:set_globals", function (e) {
    var g = e && e.detail && e.detail.globals;
    if (g && (g.maxHeight !== undefined || g.displayMode !== undefined || g.safeArea !== undefined)) onViewport();
  }, { passive: true });
  function start() {
    var card = document.querySelector(".card");
    if (card && window.ResizeObserver) new ResizeObserver(function () { report(); }).observe(card);
    report();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.asshieldMobile = { report: report, askFullscreen: askFullscreen, keepVisible: keepVisible };
})();
