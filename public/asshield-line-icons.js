window.ASSHIELD_ICONS = (function () {
  const o = 'fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"';
  function svg(paths) {
    return `<svg viewBox="0 0 48 48" ${o} aria-hidden="true">${paths}</svg>`;
  }
  return {
    auto: svg('<path d="M8 28h32l-2.4-8.2A5 5 0 0 0 32.8 16H15.2a5 5 0 0 0-4.8 3.8L8 28z"/><path d="M13 28v5M35 28v5M14 22h4M30 22h4"/><circle cx="15" cy="34" r="3"/><circle cx="33" cy="34" r="3"/>'),
    home: svg('<path d="M8 22 24 10l16 12"/><path d="M12 20.5V38h24V20.5"/><path d="M20 38V28h8v10"/>'),
    auto_home: svg('<path d="M6 22l10-8 10 8"/><path d="M9 20v16h14V20"/><path d="M28 30h12l-1.5-5a3 3 0 0 0-2.8-2H29"/><circle cx="31" cy="34" r="2.2"/><circle cx="37.5" cy="34" r="2.2"/>'),
    renters: svg('<circle cx="18" cy="20" r="6.5"/><path d="M24.5 20H40v6.5"/><path d="M33 26.5V20M37.5 26.5V20"/>'),
    motorcycle: svg('<circle cx="13" cy="33" r="5"/><circle cx="35" cy="33" r="5"/><path d="M18 33h9L32 22h5"/><path d="M23 23 18 33"/><path d="M24 18h6"/>'),
    commercial_auto: svg('<path d="M6 30h26V16H17L12 22H6v8z"/><path d="M32 22h6l4 5v3H32"/><circle cx="14" cy="34" r="3"/><circle cx="34" cy="34" r="3"/>'),
    commercial_gl: svg('<path d="M10 40V12l14-6 14 6v28"/><path d="M18 40v-10h12v10"/><path d="M18 18h.01M24 18h.01M30 18h.01M18 24h.01M24 24h.01M30 24h.01"/>'),
    workers_comp: svg('<path d="M16 19a8 8 0 1 0 16 0"/><path d="M12 19h24"/><path d="M17 27c1.5 4 4 6.5 7 6.5s5.5-2.5 7-6.5"/><path d="M14 40h20"/>'),
    trucking: svg('<path d="M4 31h22V14H15L10 20H4v11z"/><path d="M26 21h8l5 5.5V31H26"/><circle cx="12" cy="35" r="3.2"/><circle cx="34" cy="35" r="3.2"/>'),
    boat: svg('<path d="M24 8v20"/><path d="M24 10l14 16H24"/><path d="M10 36c3 2.2 7 3.2 14 3.2s11-1 14-3.2"/><path d="M8 32h32"/>'),
    golf_cart: svg('<path d="M8 28h22l4 6h6"/><path d="M12 28V18h14v10"/><path d="M16 18v-4h8"/><circle cx="16" cy="36" r="3"/><circle cx="33" cy="36" r="3"/>')
  };
})();
window.asshieldIcon = function (id) {
  return (window.ASSHIELD_ICONS && window.ASSHIELD_ICONS[id]) || window.ASSHIELD_ICONS.auto;
};

/* Compact ZIP3 → state for Asshield licensed states only */
window.ASSHIELD_ZIP_LOOKUP = function (zip) {
  const z = String(zip || "").replace(/\D/g, "");
  if (z.length < 3) return null;
  const p = parseInt(z.slice(0, 3), 10);
  const ranges = [
    ["FL", 320, 349], ["GA", 300, 319], ["GA", 398, 399],
    ["AL", 350, 369], ["TN", 370, 385], ["MS", 386, 397],
    ["KY", 400, 427], ["OH", 430, 459], ["IN", 460, 479],
    ["SC", 290, 299], ["NC", 270, 289],
    ["PA", 150, 196], ["AR", 716, 729],
    ["TX", 733, 733], ["TX", 750, 799], ["TX", 885, 885]
  ];
  for (const [st, a, b] of ranges) {
    if (p >= a && p <= b) return st;
  }
  return null;
};
window.ASSHIELD_LICENSED = ["AL","AR","FL","GA","IN","KY","NC","OH","PA","SC","TN","TX"];
