// Shared layout and navigation for all dashboards
var Pages = window.Pages || {};

function dashLayout(el, user, navItems, renderContent) {
  let activeTab = navItems[0].id;
  el.innerHTML = `
    <div class="dashboard">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div class="logo">CI</div>
          <div><div>Chookee Inasal</div><div style="font-size:.7rem;color:#999;font-weight:400">Central System</div></div>
        </div>
        <nav class="sidebar-nav" id="sidebarNav"></nav>
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="sidebar-avatar">${(user.full_name || user.username || '?')[0].toUpperCase()}</div>
            <div>
              <div class="name">${user.full_name || user.username}</div>
              <div style="text-transform:capitalize">${user.role}</div>
            </div>
          </div>
          <button class="btn-logout" id="btnLogout">Logout</button>
        </div>
      </aside>
      <div class="mobile-menu-toggle" id="mobileMenuToggle">☰</div>
      <main class="main-content" id="dashMain"></main>
    </div>`;

  const nav = el.querySelector('#sidebarNav');
  navItems.forEach(item => {
    const a = document.createElement('a');
    a.dataset.tab = item.id;
    a.innerHTML = `${item.icon} <span>${item.label}</span>`;
    if (item.id === activeTab) a.classList.add('active');
    a.addEventListener('click', () => {
      if (item.navigate) { Router.navigate(item.navigate); return; }
      activeTab = item.id;
      nav.querySelectorAll('a').forEach(x => x.classList.remove('active'));
      a.classList.add('active');
      renderContent(el.querySelector('#dashMain'), item.id);
      // Close mobile sidebar
      el.querySelector('#sidebar').classList.remove('open');
    });
    nav.appendChild(a);
  });

  // Mobile menu toggle
  el.querySelector('#mobileMenuToggle').addEventListener('click', () => {
    el.querySelector('#sidebar').classList.toggle('open');
  });

  el.querySelector('#btnLogout').addEventListener('click', () => Auth.logout());
  renderContent(el.querySelector('#dashMain'), activeTab);
}

// Legacy compatibility
function statCards(stats) { return UI.statRow(stats); }
function tableCard(title, headers, rows, extra) { return UI.table(headers, rows, { title, extra }); }
function statusBadge(status) { return UI.badge(status); }
function fmtPeso(n) { return UI.fmtPeso(n); }
function fmtDate(d) { return UI.fmtDate(d); }
function showToast(msg, type) { UI.toast(msg, type); }
function emptyState(icon, msg) { return UI.empty(icon, msg); }
function mainHeader(title, subtitle) { return UI.header(title, subtitle); }

window.Pages = Pages;
