// Shared helpers + the Facebook-style app shell used by every signed-in page
var Pages = window.Pages || {};

function fbEscape(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function fbAvatar(name, cls) {
  const initial = ((name || '?').trim()[0] || '?').toUpperCase();
  return `<span class="fb-avatar ${cls || ''}">${initial}</span>`;
}

function fbBrand() {
  return window.BRAND || { name: 'MetMuk', initial: 'M', tagline: '' };
}

// App logo — the 3D blue "m" mark, used wherever the app signs its own name
const BRAND_LOGO_SRC = '/assets/logo.svg';

function fbBrandMark() {
  return `<img class="brand-logo" src="${BRAND_LOGO_SRC}" alt="">`;
}

function fbBrandAvatar(cls) {
  return `<span class="fb-avatar brand-avatar ${cls || ''}" aria-hidden="true">${fbBrandMark()}</span>`;
}

function showToast(msg, type = '') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function emptyState(icon, msg) {
  return `<div class="empty-state"><div class="icon">${icon}</div><p>${msg}</p></div>`;
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

// App shell: top bar, left rail (desktop), bottom tab bar (mobile)
function appShell(el, user, navItems, renderContent) {
  const brand = fbBrand();
  const displayName = user.full_name || user.username;
  const mobileItems = navItems.slice(0, 4);
  const overflowItems = navItems.slice(4);

  el.innerHTML = `
    <div class="fb-shell">
      <header class="fb-topbar">
        <div class="fb-topbar-left">
          <button class="fb-logo" id="fbLogo" type="button" title="${brand.name}" aria-label="${brand.name}">${fbBrandMark()}</button>
          <label class="fb-search">
            <span aria-hidden="true">🔍</span>
            <input id="fbSearch" type="search" placeholder="Search ${brand.name}" aria-label="Search ${brand.name}">
          </label>
        </div>
        <nav class="fb-topbar-center" id="fbTopNav" aria-label="Sections"></nav>
        <div class="fb-topbar-right">
          <button class="fb-icon-btn" id="fbMessages" type="button" title="Messages" aria-label="Messages">💬</button>
          <button class="fb-user-btn" id="fbUserBtn" type="button" title="My profile" aria-label="My profile">${fbAvatar(displayName, 'fb-avatar-sm')}</button>
        </div>
      </header>
      <div class="fb-body">
        <aside class="fb-rail">
          <div class="fb-rail-user">
            ${fbAvatar(displayName)}
            <div>
              <div class="name">${displayName}</div>
              <div class="meta">@${user.username}</div>
            </div>
          </div>
          <nav id="sidebarNav"></nav>
          <button class="fb-rail-item" id="railLogout" type="button">
            <span class="fb-rail-icon" aria-hidden="true">⏻</span><span>Log out</span>
          </button>
        </aside>
        <main class="fb-main" id="dashMain"></main>
      </div>
      <nav class="fb-bottom-nav" id="fbBottomNav" aria-label="Sections"></nav>
    </div>
  `;

  const nav = el.querySelector('#sidebarNav');
  const topNav = el.querySelector('#fbTopNav');
  const bottomNav = el.querySelector('#fbBottomNav');
  const main = el.querySelector('#dashMain');
  let menuBtn = null;

  function select(id) {
    if (!navItems.some(t => t.id === id)) return;
    el.querySelectorAll('.fb-rail-item[data-tab], .fb-tab[data-tab], .fb-bottom-item[data-tab]')
      .forEach(x => x.classList.toggle('active', x.dataset.tab === id));
    if (menuBtn) menuBtn.classList.toggle('active', overflowItems.some(i => i.id === id));
    main.classList.toggle('fb-main--flush', id === 'profile');
    window.__appSearchHandler = null;
    renderContent(main, id);
    if (window.innerWidth <= 900) window.scrollTo({ top: 0 });
  }

  navItems.forEach(item => {
    const a = document.createElement('button');
    a.type = 'button';
    a.dataset.tab = item.id;
    a.className = 'fb-rail-item';
    a.innerHTML = `<span class="fb-rail-icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span>`;
    a.addEventListener('click', () => select(item.id));
    nav.appendChild(a);
  });

  navItems.slice(0, 4).forEach(item => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.tab = item.id;
    b.className = 'fb-tab';
    b.title = item.label;
    b.setAttribute('aria-label', item.label);
    b.innerHTML = item.icon;
    b.addEventListener('click', () => select(item.id));
    topNav.appendChild(b);
  });

  mobileItems.forEach(item => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.tab = item.id;
    b.className = 'fb-bottom-item';
    b.innerHTML = `<span class="ico" aria-hidden="true">${item.icon}</span><span>${item.label}</span>`;
    b.addEventListener('click', () => select(item.id));
    bottomNav.appendChild(b);
  });

  // Mobile "Menu" holds overflow sections and log out
  const sheet = document.createElement('div');
  sheet.className = 'fb-more-sheet';
  sheet.innerHTML = `
    ${overflowItems.map(item => `<button type="button" class="fb-rail-item" data-tab="${item.id}">
      <span class="fb-rail-icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span></button>`).join('')}
    <button type="button" class="fb-rail-item" id="sheetLogout">
      <span class="fb-rail-icon" aria-hidden="true">⏻</span><span>Log out</span>
    </button>`;
  el.querySelector('.fb-shell').appendChild(sheet);
  sheet.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => { sheet.classList.remove('open'); select(btn.dataset.tab); });
  });
  sheet.querySelector('#sheetLogout').addEventListener('click', () => Auth.logout());

  const menu = document.createElement('button');
  menu.type = 'button';
  menu.className = 'fb-bottom-item';
  menu.innerHTML = '<span class="ico" aria-hidden="true">☰</span><span>Menu</span>';
  menu.addEventListener('click', () => sheet.classList.toggle('open'));
  bottomNav.appendChild(menu);
  menuBtn = menu;

  el.addEventListener('click', (e) => {
    if (!sheet.contains(e.target) && !menu.contains(e.target)) sheet.classList.remove('open');
  });

  const search = el.querySelector('#fbSearch');
  if (search) {
    search.addEventListener('input', () => {
      if (window.__appSearchHandler) window.__appSearchHandler(search.value.trim().toLowerCase());
    });
  }

  el.querySelector('#fbLogo').addEventListener('click', () => select(navItems[0].id));
  el.querySelector('#fbUserBtn').addEventListener('click', () => select('profile'));
  el.querySelector('#fbMessages').addEventListener('click', () => {
    if (window.ChatWidget && window.ChatWidget.open) window.ChatWidget.open();
    else select('messages');
  });
  el.querySelector('#railLogout').addEventListener('click', () => Auth.logout());

  select(navItems[0].id);

  // Mount the Messenger-style chat widget once
  if (!document.getElementById('chatWidget')) {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'chatWidget';
    document.body.appendChild(chatContainer);
    if (window.ChatWidget) {
      window.ChatWidget(chatContainer, user);
      if (window.ChatWidget.openWith) window.fbChat = window.ChatWidget;
    }
  }
}

window.Pages = Pages;
