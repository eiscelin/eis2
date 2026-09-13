// Enhanced router with role-based protection
const Router = {
  routes: {},
  beforeRender: null,

  register(path, handler) { this.routes[path] = handler; },

  init() {
    window.addEventListener('hashchange', () => this.handle());
    this.handle();
  },

  get path() {
    const hash = location.hash.replace(/^#/, '');
    if (hash) return hash;
    if (location.pathname === '/admin') return '/AdminDashboard';
    return '/';
  },

  async handle() {
    const path = this.path;
    const app = document.getElementById('app');

    // Protected routes
    const allProtected = [
      '/AdminDashboard','/FranchiseManagement','/Orders','/Products','/ProductionDashboard',
      '/DispatchDashboard','/FranchiseDashboard','/MyOrders','/CreateOrder','/Inventory',
      '/ProductionQueue','/ProductionIssues','/ReadyForDispatch','/ScheduledDeliveries',
      '/InTransit','/Delivered','/DeliveryIssues','/Announcements','/Reports',
      '/ActivityLogs','/Profile','/Settings'
    ];

    if (allProtected.includes(path)) {
      if (!Auth.isLoggedIn()) {
        location.hash = '#/MemberLogin';
        return;
      }
      if (!Auth.canAccess(path)) {
        app.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;">
          <div style="font-size:3rem;">🔒</div>
          <h2>Access Denied</h2>
          <p style="color:#999;">You do not have permission to access this page.</p>
          <button class="btn-save" onclick="Router.navigate('${Auth.redirectByRole()}')" style="margin-top:1rem;">Go to My Dashboard</button>
        </div>`;
        return;
      }
    }

    const handler = this.routes[path] || this.routes['/404'];
    if (handler) {
      app.innerHTML = '';
      if (this.beforeRender) this.beforeRender();
      handler(app);
    }
  },

  navigate(path) { location.hash = '#' + path; }
};
