/* Asshield Ask a question control. Mounts once into #ask-slot, outside any re-rendered panel,
   so typing here never resets card state and card redraws never clear the question. */
(function () {
  function looksSensitive(t) {
    const digits = t.replace(/[^0-9]/g, "");
    return /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/.test(t) || /\b(?:\d[ -]?){13,19}\b/.test(t) || digits.length >= 13;
  }
  function mount() {
    const slot = document.getElementById("ask-slot");
    if (!slot || slot.dataset.ready) return;
    slot.dataset.ready = "1";
    slot.innerHTML =
      '<button type="button" class="ask-toggle" id="ask-toggle" aria-expanded="false" aria-controls="ask-panel">' +
      '<span class="ask-ico" aria-hidden="true">?</span>Ask a question</button>' +
      '<div class="ask-panel is-hidden" id="ask-panel">' +
      '<label class="sr-only" for="ask-input">Your question</label>' +
      '<div class="ask-row"><input id="ask-input" type="text" maxlength="400" autocomplete="off" placeholder="Ask about this step" />' +
      '<button type="button" class="ask-send" id="ask-send">Send</button></div>' +
      '<p class="ask-hint" id="ask-hint">Please don\u2019t include Social Security, license, or payment numbers.</p></div>';
    const toggle = document.getElementById("ask-toggle");
    const panel = document.getElementById("ask-panel");
    const input = document.getElementById("ask-input");
    const hint = document.getElementById("ask-hint");
    const HINT = hint.textContent;
    toggle.onclick = function () {
      const open = panel.classList.toggle("is-hidden") === false;
      toggle.setAttribute("aria-expanded", String(open));
      if (open) { try { input.focus(); } catch (_) {} }
    };
    async function send() {
      const q = input.value.trim();
      if (!q) { hint.textContent = "Type a question first."; return; }
      if (looksSensitive(q)) { hint.textContent = "That looks like an ID or card number. Please remove it; we never need it here."; return; }
      let prefix = "Question for Asshield Insurance: ";
      try { if (typeof window.asshieldAskContext === "function") prefix = window.asshieldAskContext() || prefix; } catch (_) {}
      if (!window.openai || typeof window.openai.sendFollowUpMessage !== "function") {
        hint.textContent = "Type your question in the chat below.";
        return;
      }
      const btn = document.getElementById("ask-send");
      btn.disabled = true;
      try {
        await window.openai.sendFollowUpMessage({ prompt: prefix + q });
        input.value = "";
        hint.textContent = "Sent. ChatGPT will answer in the chat.";
        setTimeout(function () { hint.textContent = HINT; }, 6000);
      } catch (_) {
        hint.textContent = "Type your question in the chat below.";
      } finally { btn.disabled = false; }
    }
    document.getElementById("ask-send").onclick = send;
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); send(); } });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
