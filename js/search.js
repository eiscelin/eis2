// Facebook-style search: a panel with a back arrow, the search field,
// "Recent" history (clock icons, people pictures) and live member results
window.AppSearch = (function () {
  const MAX_RECENT = 8;

  const CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm1-13h-2v6l4.6 2.7 1-1.7-3.6-2.1V7z"/></svg>';
  const GLASS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2a8 8 0 1 0 4.9 14.3l4.4 4.4 1.4-1.4-4.4-4.4A8 8 0 0 0 10 2zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12z"/></svg>';
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2z"/></svg>';

  const asId = value => String(value == null ? '' : value);
  const nameOf = person => (person && (person.full_name || person.username)) || 'Member';

  let me = null;
  let panel = null;
  let input = null;
  let list = null;
  let editing = false;
  let results = [];
  let timer = null;

  // ---------- Recent searches, kept in this browser per member ----------

  function key() { return 'fb_recent_search_' + (me && me.id != null ? me.id : 'anon'); }

  function readRecent() {
    try { return JSON.parse(localStorage.getItem(key()) || '[]') || []; } catch { return []; }
  }

  function writeRecent(entries) {
    try { localStorage.setItem(key(), JSON.stringify(entries.slice(0, MAX_RECENT))); } catch { /* storage is optional */ }
  }

  function remember(entry) {
    const rest = readRecent().filter(e => !(e.type === entry.type && e.value === entry.value));
    rest.unshift(entry);
    writeRecent(rest);
  }

  // ---------- Markup ----------

  function picture(person) {
    const name = nameOf(person);
    const inner = window.Friends
      ? Friends.media(person)
      : fbEscape((name.trim()[0] || '?').toUpperCase());
    return `<span class="fb-search-pic">${inner}</span>`;
  }

  function queryRow(entry) {
    return `<div class="fb-search-row" data-query="${fbEscape(entry.value)}" role="button" tabindex="0">
      <span class="fb-search-ico">${CLOCK}</span>
      <div class="fb-search-text"><div class="t">${fbEscape(entry.label || entry.value)}</div></div>
      <button class="fb-search-x" type="button" data-forget="${fbEscape(entry.value)}" aria-label="Remove ${fbEscape(entry.label || entry.value)} from recent searches">✕</button>
    </div>`;
  }

  function personRow(entry) {
    const person = { username: entry.value, full_name: entry.label, avatar_url: entry.avatar_url };
    return `<div class="fb-search-row" data-open="${fbEscape(entry.value)}" role="button" tabindex="0">
      ${picture(person)}
      <div class="fb-search-text">
        <div class="t">${fbEscape(entry.label || entry.value)}</div>
        <div class="s">@${fbEscape(entry.value)}</div>
      </div>
      <button class="fb-search-x" type="button" data-forget="${fbEscape(entry.value)}" aria-label="Remove ${fbEscape(entry.label || entry.value)} from recent searches">✕</button>
    </div>`;
  }

  function resultRow(person) {
    const state = window.Friends ? Friends.statusWith(person.id) : 'none';
    const friendBtn = window.Friends
      ? `<button class="fb-btn ${state === 'none' ? 'fb-btn-primary' : 'fb-btn-secondary'}" type="button" data-friend="${fbEscape(person.id)}"${Friends.isLocked(state) ? ' disabled' : ''}>${fbEscape(Friends.label(state))}</button>`
      : '';
    return `<div class="fb-search-row" data-open="${fbEscape(person.username || '')}" role="button" tabindex="0">
      ${picture(person)}
      <div class="fb-search-text">
        <div class="t">${fbEscape(nameOf(person))}</div>
        <div class="s">@${fbEscape(person.username || '')}</div>
      </div>
      ${friendBtn}
    </div>`;
  }

  function paint(heading) {
    const recent = readRecent();
    const parts = [];

    if (results.length) {
      parts.push(`<div class="fb-search-title"><h4>${fbEscape(heading || 'Results')}</h4></div>`);
      parts.push(results.map(resultRow).join(''));
    } else if (heading) {
      parts.push(`<div class="fb-search-title"><h4>${fbEscape(heading)}</h4></div>`);
      parts.push('<p class="fb-search-empty">No one matches your search.</p>');
    }

    // The recent list, like Facebook's search history
    if (recent.length || !results.length) {
      parts.push('<div class="fb-search-title"><h4>Recent</h4>' +
        (recent.length ? `<button class="fb-search-edit" type="button" data-edit>${editing ? 'Done' : 'Edit'}</button>` : '') +
        '</div>');
      if (recent.length) {
        parts.push(recent.map(entry => entry.type === 'user' ? personRow(entry) : queryRow(entry)).join(''));
        if (editing) parts.push('<button class="fb-search-clear" type="button" data-clear>Clear all searches</button>');
      } else {
        parts.push('<p class="fb-search-empty">Searches you make will show up here.</p>');
      }
    }

    list.innerHTML = parts.join('');
  }

  // ---------- Searching the members ----------

  async function find(term) {
    if (!sb) { results = []; paint('Results'); return; }
    try {
      const { data } = await sb.from('users')
        .select('id, username, full_name, avatar_url, role, status, deleted_at')
        .or(`username.ilike.%${term}%,full_name.ilike.%${term}%`)
        .limit(20);
      results = (data || []).filter(u =>
        asId(u.id) !== asId(me && me.id) &&
        !u.deleted_at &&
        u.status !== 'deleted' &&
        u.status !== 'suspended'
      );
    } catch {
      results = [];
    }
    paint('Results');
  }

  function typed() {
    const term = input.value.trim().toLowerCase();
    // Keep filtering the page behind the panel, like the old top-bar search
    if (window.__appSearchHandler) window.__appSearchHandler(term);
    clearTimeout(timer);
    if (!term) { results = []; paint(''); return; }
    timer = setTimeout(() => find(term), 220);
  }

  // ---------- Opening and closing ----------

  function openRecent() {
    editing = false;
    results = [];
    input.value = '';
    paint('');
    panel.hidden = false;
    document.body.classList.add('fb-searching');
    setTimeout(() => input.focus({ preventScroll: true }), 60);
  }

  function close() {
    panel.hidden = true;
    document.body.classList.remove('fb-searching');
    if (input.value && window.__appSearchHandler) window.__appSearchHandler('');
    input.value = '';
    results = [];
  }

  function openProfile(username) {
    if (!username) return;
    close();
    location.hash = '#/u/' + encodeURIComponent(username);
  }

  function personFor(username) {
    return results.find(p => asId(p.username) === asId(username)) || { username: username };
  }

  function mount(shell, user) {
    me = user;
    const brand = fbBrand();

    panel = document.createElement('div');
    panel.className = 'fb-search-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Search');
    panel.innerHTML = `
      <div class="fb-search-head">
        <button class="fb-search-back" type="button" aria-label="Close search">${ARROW}</button>
        <label class="fb-search-field">
          <span class="fb-search-glass" aria-hidden="true">${GLASS}</span>
          <input id="fbSearchInput" type="search" placeholder="Search ${fbEscape(brand.name)}" aria-label="Search ${fbEscape(brand.name)}" autocomplete="off">
        </label>
      </div>
      <div class="fb-search-body"><div class="fb-search-list"></div></div>`;
    shell.appendChild(panel);

    input = panel.querySelector('#fbSearchInput');
    list = panel.querySelector('.fb-search-list');

    panel.querySelector('.fb-search-back').addEventListener('click', close);
    input.addEventListener('input', typed);
    input.addEventListener('keydown', e => {
      const term = input.value.trim();
      if (e.key === 'Enter' && term) remember({ type: 'query', value: term.toLowerCase(), label: term });
    });

    list.addEventListener('click', async e => {
      // Rows re-render on click, so keep the event away from the outside-click closer
      e.stopPropagation();
      const forgetBtn = e.target.closest('[data-forget]');
      if (forgetBtn) {
        writeRecent(readRecent().filter(entry => entry.value !== forgetBtn.dataset.forget));
        paint(results.length ? 'Results' : '');
        return;
      }
      if (e.target.closest('[data-edit]')) {
        editing = !editing;
        paint(results.length ? 'Results' : '');
        return;
      }
      if (e.target.closest('[data-clear]')) {
        writeRecent([]);
        editing = false;
        paint(results.length ? 'Results' : '');
        return;
      }
      const friendBtn = e.target.closest('[data-friend]');
      if (friendBtn && window.Friends) {
        e.stopPropagation();
        const person = results.find(p => asId(p.id) === asId(friendBtn.dataset.friend));
        friendBtn.disabled = true;
        try {
          const result = await Friends.act(friendBtn.dataset.friend);
          if (result === 'sent') showToast('Friend request sent to ' + nameOf(person), 'success');
          if (result === 'accepted') showToast('You are now friends with ' + nameOf(person), 'success');
        } catch (err) {
          showToast(err.message, 'error', 6000);
        }
        paint('Results');
        return;
      }
      const queryRowEl = e.target.closest('[data-query]');
      if (queryRowEl) {
        input.value = queryRowEl.dataset.query;
        typed();
        return;
      }
      const openRow = e.target.closest('[data-open]');
      if (openRow) {
        const person = personFor(openRow.dataset.open);
        remember({
          type: 'user',
          value: person.username || '',
          label: nameOf(person),
          avatar_url: person.avatar_url || ''
        });
        openProfile(person.username);
      }
    });

    const trigger = shell.querySelector('#fbSearch');
    if (trigger) trigger.addEventListener('click', e => { e.stopPropagation(); openRecent(); });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !panel.hidden) close();
    });

    document.addEventListener('click', e => {
      if (panel.hidden) return;
      // A row that re-rendered itself is detached by now, but still inside the panel
      if (!e.target.isConnected || panel.contains(e.target)) return;
      if (e.target.closest && e.target.closest('#fbSearch')) return;
      close();
    });
  }

  return { mount, open: openRecent, close };
})();
