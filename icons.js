/* Ghost Haunt item icons: tiny inline SVGs drawn on a 24×24 grid, coloured with currentColor. */
window.GhostIcons = (() => {
  const S = (body, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${body}</svg>`;
  const F = 'fill="currentColor"';
  const L = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const icons = {
    // ---------- weapons ----------
    wisp: S(`<circle cx="15" cy="9" r="5" ${F}/><path d="M11 12c-3 2-6 3-9 3 2-1 4-3 5-5M12 14c-2 3-4 5-7 6 1-2 2-4 2-6" ${L}/>`),
    aura: S(`<circle cx="12" cy="12" r="3.5" ${F}/><circle cx="12" cy="12" r="7" ${L} stroke-dasharray="3 3"/><circle cx="12" cy="12" r="10.5" ${L} opacity=".55"/>`),
    candles: S(`<rect x="9.5" y="11" width="5" height="10" rx="1" ${F}/><path d="M12 3c2 2.5 2.5 4 2.5 5a2.5 2.5 0 0 1-5 0c0-1 .5-2.5 2.5-5z" ${F}/><path d="M3 15a9 9 0 0 1 3-7M21 15a9 9 0 0 0-3-7" ${L}/>`),
    lightning: S(`<path d="M13 2 5 13h6l-2 9 9-12h-6l1-8z" ${F}/>`),
    scythe: S(`<path d="M4 21 15 6" ${L}/><path d="M13 8c-1-4 2-6 9-5-3 1-5 3-6 6-.8-.6-2-1-3-1z" ${F}/>`),
    flask: S(`<path d="M9 2h6M10 2v6l-5 9a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V2" ${L}/><path d="M7 16h10l1.2 2.2A1.5 1.5 0 0 1 16.9 20H7.1a1.5 1.5 0 0 1-1.3-1.8z" ${F}/>`),
    wail: S(`<path d="M3 12c4-6 10-8 18-8M3 12c4 6 10 8 18 8" ${L}/><path d="M3 12c5-3 10-4 15-4M3 12c5 3 10 4 15 4" ${L} opacity=".6"/>`),
    moon: S(`<path d="M15 3a8 8 0 1 0 6 13A9 9 0 0 1 15 3z" ${F}/><path d="M7 2v4M5 4h4" ${L}/>`),
    // ---------- passives ----------
    might: S(`<circle cx="12" cy="14" r="6" ${L}/><path d="M9 7l3-5 3 5z" ${F}/>`),
    haste: S(`<circle cx="12" cy="13" r="8" ${L}/><path d="M12 9v4l3 2M9 2h6" ${L}/>`),
    duration: S(`<path d="M6 2h12M6 22h12M7 2c0 6 10 6 10 10S7 16 7 22M17 2c0 6-10 6-10 10s10 4 10 10" ${L}/>`),
    amount: S(`<rect x="4" y="11" width="5" height="10" rx="1" ${F}/><rect x="15" y="11" width="5" height="10" rx="1" ${F}/><path d="M6.5 4c1.5 2 2 3 2 4a2 2 0 0 1-4 0c0-1 .5-2 2-4zM17.5 4c1.5 2 2 3 2 4a2 2 0 0 1-4 0c0-1 .5-2 2-4z" ${F}/>`),
    maxhp: S(`<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z" ${F}/>`),
    speed: S(`<path d="M20 4C10 4 5 10 4 20c3-4 6-6 10-7l-4-1c3-1 6-3 7-5l-4 .5C15 6 17 5 20 4z" ${F}/>`),
    magnet: S(`<path d="M6 3v8a6 6 0 0 0 12 0V3" ${L} stroke-width="3"/><path d="M4 3h4M16 3h4" ${L} stroke-width="3" opacity=".6"/>`),
    luck: S(`<circle cx="8.5" cy="8.5" r="4" ${F}/><circle cx="15.5" cy="8.5" r="4" ${F}/><circle cx="8.5" cy="15.5" r="4" ${F}/><circle cx="15.5" cy="15.5" r="4" ${F}/><path d="M12 12l5 10" ${L}/>`),
    armor: S(`<path d="M9 2h6l3 5-2 15H8L6 7z" ${L}/><path d="M12 8v8M9 11h6" ${L}/>`),
    regen: S(`<circle cx="9" cy="14" r="5" ${F}/><circle cx="16" cy="15" r="4" ${F}/><path d="M11 9c0-3 2-5 5-6" ${L}/>`),
    growth: S(`<path d="M4 4h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v15h-6a2 2 0 0 0-2 2 2 2 0 0 0-2-2H4z" ${L}/><path d="M12 5v16" ${L}/>`),
    area: S(`<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4z" ${F}/><circle cx="12" cy="21" r="1.6" ${F}/><path d="M2 8a10 10 0 0 1 3-4M22 8a10 10 0 0 0-3-4" ${L}/>`),
    // ---------- misc ----------
    gold: S(`<circle cx="12" cy="12" r="8" ${F}/><path d="M12 8v8M9.5 10h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" fill="none" stroke="#1a1426" stroke-width="1.6" stroke-linecap="round"/>`),
    heal: S(`<path d="M8 8l8 8M5 5l3 3-3 1-2-2zM19 19l-3-3 3-1 2 2z" ${F}/><circle cx="12" cy="12" r="4.5" ${F}/>`),
    skull: S(`<path d="M12 3a8 8 0 0 0-8 8c0 3 1.5 4.5 3 5.5V20h10v-3.5c1.5-1 3-2.5 3-5.5a8 8 0 0 0-8-8z" ${F}/><circle cx="8.8" cy="11.5" r="2" fill="#1a1426"/><circle cx="15.2" cy="11.5" r="2" fill="#1a1426"/><path d="M10 20v-2M14 20v-2" stroke="#1a1426" stroke-width="1.4"/>`),
    chest: S(`<path d="M3 10a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v1H3z" ${F}/><rect x="3" y="12" width="18" height="8" rx="1" ${F}/><rect x="10.5" y="10" width="3" height="4" rx=".6" fill="#1a1426"/>`),
    reroll: S(`<path d="M20 11a8 8 0 0 0-14.5-4.5M4 13a8 8 0 0 0 14.5 4.5" ${L}/><path d="M5 3v4h4M19 21v-4h-4" ${L}/>`),
    skip: S(`<path d="M5 5l9 7-9 7zM17 5v14" ${L}/>`),
    trophy: S(`<path d="M7 3h10v5a5 5 0 0 1-10 0z" ${F}/><path d="M7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6" ${L}/>`),
  };
  const EVO_BASE = { soulstorm: 'wisp', dread: 'aura', hellfire: 'candles', coven: 'lightning', harvest: 'scythe', marsh: 'flask', shriek: 'wail', bloodmoon: 'moon' };
  return { get: id => icons[id] || icons[EVO_BASE[id]] || icons.skull };
})();
