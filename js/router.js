// Simple hash-based router
const Router = {
  routes: {},
  beforeRender: null,

  fallbacks: [],

  register(path, handler) { this.routes[path] = handler; },

  // Routes with a variable part (e.g. /u/<username>) resolve here
  registerFallback(resolver) { this.fallbacks.push(resolver); },

  resolve(path) {
    if (this.routes[path]) return this.routes[path];
    for (const resolver of this.fallbacks) {
      const handler = resolver(path);
      if (handler) return handler;
    }
    return this.routes['/404'];
  },

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
    if ((path === '/App' || path.indexOf('/App/') === 0) && !Auth.isLoggedIn()) {
      location.hash = '#/Login';
      return;
    }

    const handler = this.resolve(path);
    if (handler) {
      app.innerHTML = '';
      if (this.beforeRender) this.beforeRender();
      handler(app);
    }
  },

  navigate(path) { location.hash = '#' + path; }
};
