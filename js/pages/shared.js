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

// Shareable link to a member's profile page
function fbProfileLink(username) {
  return location.origin + location.pathname + '#/u/' + encodeURIComponent(username || '');
}

// Opens the device share sheet, or copies the link
async function fbShareLink(link, title) {
  try {
    if (navigator.share) {
      await navigator.share({ title: title || document.title, url: link });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(link);
      showToast('Profile link copied', 'success');
      return;
    }
  } catch (e) { /* fall through to showing the link */ }
  showToast('Profile link: ' + link, '', 6000);
}

function fbBrand() {
  return window.BRAND || { name: 'MeDay', initial: 'M', logo: '/img/meday-logo.svg', tagline: '' };
}

// Brand mark: the logo image, or the initial as a fallback
function fbBrandMark() {
  const brand = fbBrand();
  if (brand.logo) {
    return `<img class="brand-mark" src="${fbEscape(brand.logo)}" alt="" aria-hidden="true">`;
  }
  return fbEscape(brand.initial);
}

function showToast(msg, type = '', ms = 3000) {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

function emptyState(icon, msg) {
  return `<div class="empty-state"><div class="icon">${icon}</div><p>${msg}</p></div>`;
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

// Shrink a photo in the browser before uploading it (longest side capped)
function shrinkImage(file, maxSide = 1400) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('that file is not an image'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('that file is not an image'));
    };
    img.src = objectUrl;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('could not read that image'));
    reader.readAsDataURL(blob);
  });
}

// App shell: top bar, left rail (desktop), bottom tab bar (mobile)
function appShell(el, user, navItems, renderContent, startTab) {
  const brand = fbBrand();
  const displayName = user.full_name || user.username;
  const mobileItems = navItems.slice(0, 4);
  const overflowItems = navItems.slice(4);

  el.innerHTML = `
    <div class="fb-shell">
      <header class="fb-topbar">
        <div class="fb-topbar-left">
          <button class="fb-logo" id="fbLogo" type="button" title="${brand.name}" aria-label="${brand.name}">${brand.initial}</button>
          <button class="fb-search" id="fbSearch" type="button" title="Search" aria-label="Search ${brand.name}">
            <span aria-hidden="true">🔍</span>
            <span class="fb-search-hint">Search ${brand.name}</span>
          </button>
        </div>
        <nav class="fb-topbar-center" id="fbTopNav" aria-label="Sections"></nav>
        <div class="fb-topbar-right">
          <button class="fb-icon-btn fb-notif-btn" id="fbFriendsBtn" type="button" title="Friend requests" aria-label="Friend requests" aria-expanded="false">🔔<span class="fb-notif-badge" id="fbFriendsBadge" hidden>0</span></button>
          <button class="fb-icon-btn" id="fbMessages" type="button" title="Messages" aria-label="Messages">💬</button>
          <button class="fb-user-btn" id="fbUserBtn" type="button" title="My profile" aria-label="My profile">${fbAvatar(displayName, 'fb-avatar-sm')}</button>
          <button class="fb-icon-btn fb-burger" id="fbBurger" type="button" title="Menu" aria-label="Menu">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
              <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
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
    // Bouncy transition on every tab swap
    main.classList.remove('fb-tab-enter');
    void main.offsetWidth; // restart the animation
    main.classList.add('fb-tab-enter');
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

  // The top bar search opens the Facebook-style search panel
  if (window.AppSearch) window.AppSearch.mount(el.querySelector('.fb-shell'), user);

  el.querySelector('#fbLogo').addEventListener('click', () => select(navItems[0].id));
  el.querySelector('#fbUserBtn').addEventListener('click', () => select('profile'));
  el.querySelector('#fbMessages').addEventListener('click', () => {
    if (window.ChatWidget && window.ChatWidget.open) window.ChatWidget.open();
    else select('messages');
  });
  el.querySelector('#fbBurger').addEventListener('click', () => {
    if (window.openAppMenu) window.openAppMenu({ user, onSelect: select });
  });
  el.querySelector('#railLogout').addEventListener('click', () => Auth.logout());

  select(navItems.some(i => i.id === startTab) ? startTab : navItems[0].id);

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

  // Friend requests arrive in the bell of the top bar
  if (window.Friends) window.Friends.mountBell(el.querySelector('.fb-shell'), user);
}

window.Pages = Pages;
