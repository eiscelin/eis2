// Facebook-style "Menu" page, opened by the burger button in the top bar
var openAppMenu = (function () {
  const shortcuts = [
    { label: 'Messages', icon: '💬', tab: 'messages' },
    { label: 'Friends', icon: '👥', tab: 'friends' },
    { label: 'Marketplace', icon: '🛍️' },
    { label: 'Saved', icon: '🔖' },
    { label: 'Birthdays', icon: '🎂' },
    { label: 'Games', icon: '🎮' },
    { label: 'Feeds', icon: '📰', tab: 'home' },
    { label: 'Groups', icon: '👨‍👩‍👧‍👦' },
    { label: 'Reels', icon: '🎬' },
    { label: 'Pages', icon: '🚩' },
    { label: 'Memories', icon: '🕘' },
    { label: 'Events', icon: '📅' },
    { label: 'Ads Manager', icon: '📊' }
  ];

  const settings = [
    { label: 'Settings', icon: '⚙️' },
    { label: 'Orders and payments', icon: '💳' },
    { label: 'Dark mode', icon: '🌙', toggle: true },
    { label: 'Language', icon: '🌐', meta: 'English' }
  ];

  function closeAppMenu() {
    const open = document.querySelector('.fb-menu');
    if (!open) return;
    document.removeEventListener('keydown', open.__keys);
    open.remove();
    document.body.style.overflow = '';
  }

  return function openAppMenu(opts) {
    closeAppMenu();
    const options = opts || {};
    const user = options.user || {};
    const name = user.full_name || user.username || 'You';

    const el = document.createElement('div');
    el.className = 'fb-menu';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Menu');
    el.innerHTML = `
      <div class="fb-menu-panel">
        <header class="fb-menu-head">
          <button class="fb-menu-icon-btn fb-menu-back" id="menuBack" type="button" aria-label="Close menu">‹</button>
          <h2 class="fb-menu-title">Menu</h2>
          <button class="fb-menu-icon-btn" id="menuSearchBtn" type="button" aria-label="Search menu" aria-expanded="false">🔍</button>
        </header>
        <div class="fb-menu-search" id="menuSearch" hidden>
          <input id="menuFilter" type="search" placeholder="Search menu" aria-label="Search menu">
        </div>
        <div class="fb-menu-scroll">
          <button class="fb-menu-profile" id="menuProfile" type="button">
            ${fbAvatar(name)}
            <span class="fb-menu-profile-text">
              <span class="fb-menu-profile-name">${fbEscape(name)}</span>
              <span class="fb-menu-profile-sub">View your profile</span>
            </span>
            <span class="fb-menu-caret" aria-hidden="true">›</span>
          </button>
          <div class="fb-menu-grid">
            ${shortcuts.map(s => `
              <button class="fb-menu-card" type="button" data-label="${fbEscape(s.label)}"${s.tab ? ` data-tab="${s.tab}"` : ''}>
                <span class="fb-menu-card-icon" aria-hidden="true">${s.icon}</span>
                <span class="fb-menu-card-label">${fbEscape(s.label)}</span>
              </button>`).join('')}
          </div>
          <section class="fb-menu-section">
            <button class="fb-menu-section-head" id="menuSettingsHead" type="button" aria-expanded="true" aria-controls="menuSettingsBody">
              <span class="fb-menu-section-icon" aria-hidden="true">⚙️</span>
              <span class="fb-menu-section-title">Settings &amp; privacy</span>
              <span class="fb-menu-caret" aria-hidden="true">⌃</span>
            </button>
            <div class="fb-menu-rows" id="menuSettingsBody">
              ${settings.map(row => `
                <button class="fb-menu-row" type="button" data-label="${fbEscape(row.label)}">
                  <span class="fb-menu-row-icon" aria-hidden="true">${row.icon}</span>
                  <span class="fb-menu-row-label">${fbEscape(row.label)}</span>
                  ${row.toggle
                    ? '<span class="fb-menu-switch" role="switch" aria-checked="true"><i></i></span>'
                    : row.meta ? `<span class="fb-menu-row-meta">${fbEscape(row.meta)}</span>` : ''}
                </button>`).join('')}
            </div>
          </section>
        </div>
      </div>`;
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';

    const searchRow = el.querySelector('#menuSearch');
    const filterInput = el.querySelector('#menuFilter');
    const settingsHead = el.querySelector('#menuSettingsHead');

    function setSettingsOpen(open) {
      el.querySelector('#menuSettingsBody').hidden = !open;
      settingsHead.classList.toggle('collapsed', !open);
      settingsHead.setAttribute('aria-expanded', String(open));
    }

    el.querySelector('#menuBack').addEventListener('click', closeAppMenu);
    el.querySelector('#menuProfile').addEventListener('click', () => {
      closeAppMenu();
      if (options.onSelect) options.onSelect('profile');
    });

    el.querySelector('#menuSearchBtn').addEventListener('click', (e) => {
      const show = searchRow.hidden;
      searchRow.hidden = !show;
      e.currentTarget.setAttribute('aria-expanded', String(show));
      if (show) filterInput.focus();
      else { filterInput.value = ''; filterInput.dispatchEvent(new Event('input')); }
    });

    filterInput.addEventListener('input', () => {
      const q = filterInput.value.trim().toLowerCase();
      el.querySelectorAll('[data-label]').forEach(item => {
        item.classList.toggle('is-hidden', !!q && !item.dataset.label.toLowerCase().includes(q));
      });
      if (q) setSettingsOpen(true);
    });

    el.querySelectorAll('.fb-menu-card').forEach(card => {
      card.addEventListener('click', () => {
        if (card.dataset.tab && options.onSelect) {
          closeAppMenu();
          options.onSelect(card.dataset.tab);
          return;
        }
        showToast(card.dataset.label + ' isn\'t available yet');
      });
    });

    el.querySelectorAll('.fb-menu-row').forEach(row => {
      row.addEventListener('click', () => {
        showToast(row.querySelector('.fb-menu-switch')
          ? 'Dark mode is always on for now'
          : row.dataset.label + ' isn\'t available yet');
      });
    });

    settingsHead.addEventListener('click', () => setSettingsOpen(settingsHead.getAttribute('aria-expanded') !== 'true'));

    el.addEventListener('click', (e) => { if (e.target === el) closeAppMenu(); });
    document.addEventListener('keydown', el.__keys = (e) => { if (e.key === 'Escape') closeAppMenu(); });
  };
})();
