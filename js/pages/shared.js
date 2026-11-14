// Shared helpers + the Facebook-style app shell used by every signed-in page
var Pages = window.Pages || {};

function fbEscape(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Followers are the member's friends — an accepted friend request is a follow,
// so there is no follow button and no separate follower list. Under 10,000 the
// exact number stays private and only the range is shown; from 10,000 up the
// count is shown exactly, with thousands separators (10,234 followers).
function fbFollowerLabel(count) {
  const n = Number(count) || 0;
  if (n < 10000) return 'within 10,000 followers';
  return n.toLocaleString('en-US') + ' followers';
}

// The landing page cover, used as the cover of members who have not picked one
var FB_DEFAULT_COVER = '/img/landing-cover.jpg';

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
  return window.BRAND || { name: 'MeDay', initial: 'M', logo: '/img/meday-logo.png', tagline: '' };
}

// Brand mark: the logo image, or the initial as a fallback
function fbBrandMark() {
  const brand = fbBrand();
  if (brand.logo) {
    return `<img class="brand-mark" src="${fbEscape(brand.logo)}" alt="" aria-hidden="true">`;
  }
  return fbEscape(brand.initial);
}

// Account background: the picture the signed-in member chose shows behind every
// page. The layer lives on <body>, so it survives every route change.
function fbPaintPageBackground(url) {
  const picture = String(url || '').trim();
  let layer = document.getElementById('fbPageBg');
  if (!picture) {
    if (layer) layer.remove();
    document.body.classList.remove('has-page-bg');
    return;
  }
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'fbPageBg';
    layer.className = 'page-bg';
    layer.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(layer, document.body.firstChild);
  }
  layer.style.backgroundImage = 'url("' + picture.replace(/"/g, '%22') + '")';
  document.body.classList.add('has-page-bg');
}

// Cloudinary can hand out a smaller copy of the same picture, so a feed on a
// phone downloads a fraction of the bytes and still looks right on screen
function fbImageUrl(url, width) {
  const src = String(url || '');
  if (!width || !/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(src)) return src;
  if (/\/image\/upload\/[^/]*(f_auto|q_auto|w_\d)/.test(src)) return src;
  return src.replace('/image/upload/', '/image/upload/f_auto,q_auto,c_limit,w_' + width + '/');
}

// Loads a page script the first time that page is opened, so members who never
// visit it never download it
const fbLoadedScripts = {};
function fbLoadScript(src) {
  if (!fbLoadedScripts[src]) {
    fbLoadedScripts[src] = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        delete fbLoadedScripts[src];
        reject(new Error('Could not load ' + src));
      };
      document.head.appendChild(script);
    });
  }
  return fbLoadedScripts[src];
}

// The accepted friends of one member, asked for once per page load: the feed,
// the stories row and the posts all need the same list
let fbFriendIdsCache = null;
document.addEventListener('friends:changed', () => { fbFriendIdsCache = null; });
function fbFriendIds(userId) {
  const id = String(userId || '');
  if (!sb || !id) return Promise.resolve(null);
  if (fbFriendIdsCache && fbFriendIdsCache.id === id) return fbFriendIdsCache.promise;
  const promise = sb.from('friend_requests')
    .select('sender_id, receiver_id')
    .eq('status', 'accepted')
    .or(`sender_id.eq.${id},receiver_id.eq.${id}`)
    .then(({ data, error }) => {
      if (error) return null;
      const ids = new Set();
      (data || []).forEach(row => {
        ids.add(String(String(row.sender_id) === id ? row.receiver_id : row.sender_id));
      });
      return ids;
    })
    .catch(() => null);
  fbFriendIdsCache = { id, promise };
  return promise;
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
        <div class="fb-topbar-slot" id="fbSupportSlot"></div>
        <div class="fb-topbar-right">
          <button class="fb-icon-btn fb-notif-btn" id="fbFriendsBtn" type="button" title="Friend requests" aria-label="Friend requests" aria-expanded="false"><svg class="fb-bell" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><defs><linearGradient id="fbBellSilver" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="38%" stop-color="#e7ecf2"/><stop offset="62%" stop-color="#9aa7b4"/><stop offset="82%" stop-color="#d5dde6"/><stop offset="100%" stop-color="#f7fafc"/></linearGradient></defs><path fill="url(#fbBellSilver)" d="M12 2.6a6.1 6.1 0 0 0-6.1 6.1v3.5l-1.35 2.7A1.15 1.15 0 0 0 5.58 16.7h12.84a1.15 1.15 0 0 0 1.03-1.8l-1.35-2.7V8.7A6.1 6.1 0 0 0 12 2.6Z"/><path fill="url(#fbBellSilver)" d="M9.4 18.1h5.2a2.6 2.6 0 0 1-5.2 0Z"/></svg><span class="fb-notif-badge" id="fbFriendsBadge" hidden>0</span></button>
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

  // A member waiting for approval browses in read-only mode; this says why
  if (window.fbApprovalPending) {
    const bar = document.createElement('div');
    bar.className = 'fb-approval-bar';
    bar.innerHTML = `
      <span class="fb-approval-icon" aria-hidden="true">⏳</span>
      <div class="fb-approval-text">
        <strong>Waiting for admin approval</strong>
        <span>Look around all you like — uploading, posting, commenting, reacting and messaging unlock once an admin approves your profile picture or video.</span>
      </div>
      <button class="fb-btn fb-btn-primary" type="button" id="approvalCheck">Check again</button>`;
    el.querySelector('.fb-topbar').insertAdjacentElement('afterend', bar);
    bar.querySelector('#approvalCheck').addEventListener('click', () => Pages.app(el));
  }

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

  // Friend requests and replies to my comments arrive in the bell of the top bar
  if (window.Friends) window.Friends.mountBell(el.querySelector('.fb-shell'), user);
  if (window.CommentNotif) window.CommentNotif.mount(el.querySelector('.fb-shell'), user);
}

window.Pages = Pages;
