// Main app entry — registers all routes and boots the router
Auth.init();
Router.register('/', Pages.landing);
Router.register('/MemberLogin', Pages.memberLogin);
Router.register('/Register', Pages.register);
Router.register('/ProductionLogin', Pages.productionLogin);
Router.register('/ProductionRegister', Pages.productionRegister);
Router.register('/dashboard', Pages.franchiseeDashboard);
Router.register('/production-dashboard', Pages.productionDashboard);
Router.register('/admin-dashboard', Pages.adminDashboard);
Router.register('/404', (el) => {
  el.innerHTML = '<div style="text-align:center;padding:4rem;"><h1>404</h1><p>Page not found</p><a href="#/" style="color:#F58220;">Go home</a></div>';
});
Router.init();
