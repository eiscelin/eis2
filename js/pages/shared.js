// Shared helpers for dashboard pages
var Pages = window.Pages || {};

function dashLayout(el, user, navItems, renderContent) {
  let activeTab = navItems[0].id;
  el.innerHTML = `
    <div class="dashboard">
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="logo">CI</div> Chookee Inasal
        </div>
        <nav class="sidebar-nav" id="sidebarNav"></nav>
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="name">${user.full_name || user.username}</div>
            <div>${user.role}</div>
          </div>
          <button class="btn-logout" id="btnLogout">Logout</button>
        </div>
      </aside>
      <main class="main-content" id="dashMain"></main>
    </div>
  `;
  const nav = el.querySelector('#sidebarNav');
  navItems.forEach(item => {
    const a = document.createElement('a');
    a.dataset.tab = item.id;
    a.innerHTML = `${item.icon} ${item.label}`;
    if (item.id === activeTab) a.classList.add('active');
    a.addEventListener('click', () => {
      if (item.navigate) { Router.navigate(item.navigate); return; }
      activeTab = item.id;
      nav.querySelectorAll('a').forEach(x => x.classList.remove('active'));
      a.classList.add('active');
      renderContent(el.querySelector('#dashMain'), item.id);
    });
    nav.appendChild(a);
  });
  el.querySelector('#btnLogout').addEventListener('click', () => Auth.logout());
  renderContent(el.querySelector('#dashMain'), activeTab);
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
