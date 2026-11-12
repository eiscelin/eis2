// Light / dark mode. The menu's "Dark mode" switch calls Theme.set(false)
// for light mode; the choice is remembered across visits.
var Theme = (function () {
  const KEY = 'chookee_theme';

  function isLight() {
    return document.documentElement.getAttribute('data-theme') === 'light';
  }

  function set(light) {
    if (light) document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem(KEY, light ? 'light' : 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', light ? '#f0f2f5' : '#242526');
    document.dispatchEvent(new CustomEvent('themechange', { detail: { light } }));
  }

  function toggle() {
    set(!isLight());
    return isLight();
  }

  if (localStorage.getItem(KEY) === 'light') set(true);

  return { isLight, set, toggle };
})();
