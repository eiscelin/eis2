// Dark / light theme switch. Dark is the default; the choice is remembered.
var Theme = (function () {
  const KEY = 'metmuk-theme';
  const root = document.documentElement;

  function current() {
    try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; }
    catch (e) { return 'dark'; }
  }

  function paint(theme) {
    const dark = theme !== 'light';
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#242526' : '#ffffff');
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
      btn.textContent = dark ? '☀️' : '🌙';
      btn.setAttribute('aria-label', label);
      btn.title = label;
    });
    document.querySelectorAll('[data-theme-switch]').forEach(sw => {
      sw.setAttribute('aria-checked', String(dark));
    });
  }

  function set(theme) {
    const next = theme === 'light' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, next); } catch (e) { /* storage blocked */ }
    paint(next);
    return next;
  }

  function toggle() { return set(current() === 'light' ? 'dark' : 'light'); }

  // Markup for a toggle that already shows the right icon on first paint
  function toggleButtonHTML(cls) {
    const dark = current() !== 'light';
    const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
    return `<button class="${cls || 'fb-icon-btn'}" type="button" data-theme-toggle aria-label="${label}" title="${label}">${dark ? '☀️' : '🌙'}</button>`;
  }

  // One listener covers every header button, including pages rendered later
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    e.preventDefault();
    toggle();
  });

  paint(current());

  return {
    get current() { return current(); },
    set: set,
    toggle: toggle,
    paint: paint,
    toggleButtonHTML: toggleButtonHTML
  };
})();
