// Searchable member picker used by the admin My Profile tab.
// A white dropdown: click it, type a name or username, pick a member.
(function () {
  function nameOf(u) {
    return (u && (u.full_name || u.username)) || 'Member';
  }

  function labelOf(u) {
    const handle = u && u.username ? `(@${u.username})` : '';
    return `${nameOf(u)} ${handle}`.trim();
  }

  function render(container, options) {
    const opts = options || {};
    const users = opts.users || [];
    let selectedId = opts.selectedId == null ? '' : String(opts.selectedId);

    container.classList.add('mp-picker');
    container.innerHTML = `
      <button class="mp-trigger" id="mpTrigger" type="button" aria-haspopup="listbox" aria-expanded="false">
        <span class="mp-trigger-text">Choose a member...</span>
        <span class="mp-chevron" aria-hidden="true">⌄</span>
      </button>
      <div class="mp-panel" id="mpPanel" hidden>
        <label class="mp-search">
          <span aria-hidden="true">🔍</span>
          <input id="mpSearch" type="search" placeholder="Search members by name or username..." aria-label="Search members" autocomplete="off">
        </label>
        <div class="mp-list" id="mpList" role="listbox" aria-label="Members"></div>
      </div>`;

    const trigger = container.querySelector('#mpTrigger');
    const triggerText = trigger.querySelector('.mp-trigger-text');
    const panel = container.querySelector('#mpPanel');
    const search = container.querySelector('#mpSearch');
    const list = container.querySelector('#mpList');

    function current() {
      return users.find(u => String(u.id) === selectedId) || null;
    }

    function paintTrigger() {
      const user = current();
      triggerText.textContent = user ? labelOf(user) : 'Choose a member...';
      trigger.classList.toggle('has-value', !!user);
    }

    function paintList() {
      const q = search.value.trim().toLowerCase();
      const matches = users.filter(u =>
        !q || `${nameOf(u)} ${u.username || ''}`.toLowerCase().includes(q));

      if (!matches.length) {
        list.innerHTML = `<div class="mp-empty">${users.length ? 'No member matches that search.' : 'No members yet.'}</div>`;
        return;
      }
      list.innerHTML = matches.map(u => `
        <button class="mp-item${String(u.id) === selectedId ? ' is-selected' : ''}" type="button"
          role="option" aria-selected="${String(u.id) === selectedId}" data-id="${String(u.id)}">
          <span class="mp-name">${esc(nameOf(u))}</span>
          <span class="mp-handle">(@${esc(u.username || '')})</span>
        </button>`).join('');

      list.querySelectorAll('.mp-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const user = users.find(u => String(u.id) === btn.dataset.id);
          if (!user) return;
          selectedId = String(user.id);
          close();
          paintTrigger();
          if (opts.onSelect) opts.onSelect(user);
        });
      });
    }

    function esc(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    }

    function open() {
      panel.hidden = false;
      container.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      search.value = '';
      paintList();
      search.focus();
    }

    function close() {
      panel.hidden = true;
      container.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    }

    trigger.addEventListener('click', () => {
      if (panel.hidden) open();
      else close();
    });
    search.addEventListener('input', paintList);
    search.addEventListener('keydown', e => {
      if (e.key === 'Escape') { close(); trigger.focus(); }
    });
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) close();
    });

    paintTrigger();
  }

  window.AdminMemberPicker = { render };
})();
