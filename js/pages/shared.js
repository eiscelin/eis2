// Shared helpers for dashboard pages
var Pages = window.Pages || {};

function fbAvatar(name, cls) {
  const initial = ((name || '?').trim()[0] || '?').toUpperCase();
  return `<span class="fb-avatar ${cls || ''}">${initial}</span>`;
}

// Short label for the mobile tab bar ("Available Supplies" → "Supplies")
function fbShortLabel(label) {
  const parts = String(label || '').split(' ');
  if (parts.length === 1) return label;
  if (/^(available|all|my)$/i.test(parts[0])) return parts.slice(1).join(' ');
  return parts[0];
}

function dashLayout(el, user, navItems, renderContent) {
  const tabs = navItems.filter(item => !item.navigate);
  const activeTab = tabs[0].id;
  const displayName = user.full_name || user.username;

  el.innerHTML = `
    <div class="fb-shell">
      <header class="fb-topbar">
        <div class="fb-topbar-left">
          <button class="fb-logo" id="fbLogo" title="Chookee Inasal" aria-label="Chookee Inasal">f</button>
          <label class="fb-search">
            <span aria-hidden="true">🔍</span>
            <input id="fbSearch" type="search" placeholder="Search Chookee" aria-label="Search Chookee">
          </label>
        </div>
        <nav class="fb-topbar-center" id="fbTopNav" aria-label="Sections"></nav>
        <div class="fb-topbar-right">
          <button class="fb-icon-btn" id="btnLogout" title="Log out" aria-label="Log out">⏻</button>
          <button class="fb-user-btn" id="fbUserBtn" title="My profile" aria-label="My profile">${fbAvatar(displayName, 'fb-avatar-sm')}</button>
        </div>
      </header>
      <div class="fb-body">
        <aside class="fb-rail">
          <div class="fb-rail-user">
            ${fbAvatar(displayName)}
            <div>
              <div class="name">${displayName}</div>
              <div class="meta">${user.role}</div>
            </div>
          </div>
          <nav id="sidebarNav"></nav>
        </aside>
        <main class="fb-main" id="dashMain"></main>
      </div>
      <nav class="fb-bottom-nav" id="fbBottomNav" aria-label="Mobile sections"></nav>
    </div>
  `;

  const nav = el.querySelector('#sidebarNav');
  const topNav = el.querySelector('#fbTopNav');
  const bottomNav = el.querySelector('#fbBottomNav');
  const main = el.querySelector('#dashMain');

  let moreBtn = null;
  let overflowIds = [];

  function select(id) {
    if (!tabs.some(t => t.id === id)) return;
    el.querySelectorAll('.fb-rail-item[data-tab], .fb-tab[data-tab], .fb-bottom-item[data-tab]')
      .forEach(x => x.classList.toggle('active', x.dataset.tab === id));
    if (moreBtn) moreBtn.classList.toggle('active', overflowIds.includes(id));
    main.classList.toggle('fb-main--flush', id === 'profile');
    renderContent(main, id);
    if (window.innerWidth <= 900) window.scrollTo({ top: 0 });
  }

  navItems.forEach(item => {
    const a = document.createElement('button');
    a.type = 'button';
    a.dataset.tab = item.id;
    a.className = 'fb-rail-item';
    a.innerHTML = `<span class="fb-rail-icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span>`;
    a.addEventListener('click', () => {
      if (item.navigate) { Router.navigate(item.navigate); return; }
      select(item.id);
    });
    nav.appendChild(a);
  });

  // Top bar tabs (desktop) and bottom tabs (mobile) mirror the available sections
  tabs.slice(0, 4).forEach(item => {
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

  const mobileTabs = tabs.slice(0, 4);
  const profileTab = tabs.find(t => t.id === 'profile');
  if (profileTab && !mobileTabs.includes(profileTab)) mobileTabs.push(profileTab);
  mobileTabs.forEach(item => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.tab = item.id;
    b.className = 'fb-bottom-item';
    b.innerHTML = `<span class="ico" aria-hidden="true">${item.icon}</span><span>${fbShortLabel(item.label)}</span>`;
    b.addEventListener('click', () => select(item.id));
    bottomNav.appendChild(b);
  });

  // Anything that doesn't fit in the mobile tab bar stays reachable in a "More" sheet
  const overflowItems = [
    ...tabs.filter(t => !mobileTabs.includes(t)),
    ...navItems.filter(item => item.navigate)
  ];
  if (overflowItems.length) {
    const sheet = document.createElement('div');
    sheet.className = 'fb-more-sheet';
    sheet.innerHTML = overflowItems.map(item => `
      <button type="button" class="fb-rail-item" data-tab="${item.id}" data-navigate="${item.navigate || ''}">
        <span class="fb-rail-icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span>
      </button>`).join('');
    el.querySelector('.fb-shell').appendChild(sheet);

    const moreBtnEl = document.createElement('button');
    moreBtnEl.type = 'button';
    moreBtnEl.className = 'fb-bottom-item';
    moreBtnEl.dataset.more = '1';
    moreBtnEl.innerHTML = '<span class="ico" aria-hidden="true">⋯</span><span>More</span>';
    moreBtnEl.addEventListener('click', () => sheet.classList.toggle('open'));
    bottomNav.appendChild(moreBtnEl);
    moreBtn = moreBtnEl;
    overflowIds = overflowItems.map(i => i.id);

    sheet.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        sheet.classList.remove('open');
        if (btn.dataset.navigate) { Router.navigate(btn.dataset.navigate); return; }
        select(btn.dataset.tab);
      });
    });
    el.addEventListener('click', (e) => {
      if (!sheet.contains(e.target) && !moreBtn.contains(e.target)) sheet.classList.remove('open');
    });
  }

  // Top bar search filters the left rail links
  const search = el.querySelector('#fbSearch');
  if (search) {
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      nav.querySelectorAll('.fb-rail-item').forEach(item => {
        const label = item.textContent.toLowerCase();
        item.style.display = !q || label.includes(q) ? '' : 'none';
      });
    });
  }

  el.querySelector('#fbLogo').addEventListener('click', () => select(activeTab));
  el.querySelector('#fbUserBtn').addEventListener('click', () => {
    if (tabs.some(t => t.id === 'profile')) select('profile');
  });
  el.querySelector('#btnLogout').addEventListener('click', () => Auth.logout());

  select(activeTab);

  // Add chat widget (only once, on body)
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

function statCards(stats) {
  return `<div class="dash-stats">${stats.map(s => `
    <div class="dash-stat-card">
      <div class="label">${s.label}</div>
      <div class="value ${s.accent ? 'accent' : ''}">${s.value}</div>
      ${s.trend ? `<div class="trend">${s.trend}</div>` : ''}
    </div>`).join('')}</div>`;
}

function tableCard(title, headers, rows, extra = '') {
  return `
    <div class="table-card">
      <div class="table-card-header"><h3>${title}</h3>${extra}</div>
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" style="text-align:center;color:#999;padding:2rem;">No data available</td></tr>`}</tbody>
      </table>
    </div>`;
}

function statusBadge(status) {
  const map = {
    pending: 'badge-yellow', processing: 'badge-blue',
    ready: 'badge-blue', dispatched: 'badge-purple',
    in_transit: 'badge-blue', delivered: 'badge-green',
    cancelled: 'badge-red',
    paid: 'badge-green', unpaid: 'badge-red', active: 'badge-green',
    inactive: 'badge-gray', expired: 'badge-red', pending_approval: 'badge-yellow'
  };
  return `<span class="badge ${map[status] || 'badge-gray'}">${status}</span>`;
}

function fmtPeso(n) { return '₱' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }

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

function mainHeader(title, subtitle) {
  return `<div class="main-header"><div><h1>${title}</h1><div class="subtitle">${subtitle || ''}</div></div></div>`;
}

window.Pages = Pages;
