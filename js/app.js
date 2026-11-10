// Main app entry — registers all routes and boots the router
Auth.init();
Router.register('/', Pages.landing);
Router.register('/Login', Pages.login);
Router.register('/Register', Pages.register);
Router.register('/App', Pages.app);
Router.register('/404', (el) => {
  el.innerHTML = '<div style="text-align:center;padding:4rem;"><h1>404</h1><p>Page not found</p><a href="#/" style="color:#1877f2;">Go home</a></div>';
});
Router.init();
