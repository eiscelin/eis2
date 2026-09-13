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
    return hash || '/';
  },

  async handle() {
    const path = this.path;
    const app = document.getElementById('app');

    // Auth guard for dashboard routes
    if (path.startsWith('/dashboard') || path.startsWith('/production-dashboard') || path.startsWith('/admin-dashboard')) {
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
