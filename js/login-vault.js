// Login vault — the ONLY place that remembers the log-ins used on this device.
// The login form is pre-filled from here (nothing is retyped), every saved
// credential is written here, and nothing outside this file reads or writes the
// saved log-ins. Keep log-in behaviour in this module + Pages.login so edits and
// merges on other branches cannot fork it.
window.LoginVault = (function () {
  const KEY = 'meday_logins'; // [{ username, password, usedAt }], newest used first
  const MAX = 10;

  function read() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(list)
        ? list.filter(e => e && typeof e.username === 'string' && e.username)
        : [];
    } catch { return []; }
  }

  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch { /* storage is optional */ }
  }

  function same(a, b) { return a.toLowerCase() === b.toLowerCase(); }

  function list() { return read(); }
  function last() { return read()[0] || null; }

  function find(username) {
    const name = String(username || '').trim();
    if (!name) return null;
    return read().find(e => same(e.username, name)) || null;
  }

  // Records a log-in that worked; it becomes the one filled in next time
  function remember(username, password) {
    const name = String(username || '').trim();
    if (!name) return;
    write([
      { username: name, password: String(password || ''), usedAt: Date.now() },
      ...read().filter(e => !same(e.username, name))
    ]);
  }

  // A changed password replaces the saved one instead of leaving a stale copy
  function updatePassword(username, password) {
    const name = String(username || '').trim();
    if (!name) return;
    const saved = read();
    if (!saved.some(e => same(e.username, name))) return;
    write(saved.map(e => same(e.username, name)
      ? { username: e.username, password: String(password || ''), usedAt: Date.now() }
      : e));
  }

  function forget(username) {
    const name = String(username || '').trim();
    if (!name) return;
    write(read().filter(e => !same(e.username, name)));
  }

  // Fills the login form: the last used log-in in both boxes, the other saved
  // usernames offered in the username field, and the password kept visible.
  function attachTo(root) {
    const form = root.querySelector('#authForm');
    if (!form) return;
    const userInput = form.querySelector('input[name=username]');
    const passInput = form.querySelector('input[name=password]');
    if (!userInput || !passInput) return;

    const saved = read();
    if (saved.length) {
      userInput.value = saved[0].username;
      passInput.value = saved[0].password || '';
      passInput.type = 'text';
    }

    if (saved.length > 1) {
      const options = document.createElement('datalist');
      options.id = 'loginVaultAccounts';
      saved.forEach(entry => {
        const option = document.createElement('option');
        option.value = entry.username;
        options.appendChild(option);
      });
      root.appendChild(options);
      userInput.setAttribute('list', 'loginVaultAccounts');
    }

    const fillFromSaved = () => {
      const hit = find(userInput.value);
      if (!hit) return;
      passInput.value = hit.password || '';
      passInput.type = 'text';
    };
    userInput.addEventListener('input', fillFromSaved);
    userInput.addEventListener('change', fillFromSaved);
  }

  return { list, last, find, remember, updatePassword, forget, attachTo };
})();
