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

    // The social app needs an account
    if (path === '/App' && !Auth.isLoggedIn()) {
      location.hash = '#/Login';
      return;
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
