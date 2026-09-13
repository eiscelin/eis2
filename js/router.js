// Simple hash-based router
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
    // Map path-based routes (e.g. /admin → /AdminDashboard)
    if (location.pathname === '/admin') return '/AdminDashboard';
    return '/';
  },

  async handle() {
    const path = this.path;
    const app = document.getElementById('app');

    // Auth guard for dashboard routes
    const protectedRoutes = ['/Dashboard', '/ProductionDashboard', '/DispatchDashboard', '/AdminDashboard'];
    if (protectedRoutes.includes(path)) {
      if (!Auth.isLoggedIn()) {
        location.hash = '#/MemberLogin';
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
