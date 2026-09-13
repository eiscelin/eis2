// Main app entry — registers all routes and boots the router
Auth.init();
Router.register('/', Pages.landing);
Router.register('/MemberLogin', Pages.memberLogin);
Router.register('/Register', Pages.register);
Router.register('/ProductionLogin', Pages.productionLogin);
Router.register('/ProductionRegister', Pages.productionRegister);
// Admin routes
Router.register('/AdminDashboard', Pages.adminDashboard);
Router.register('/FranchiseManagement', Pages.adminDashboard);
Router.register('/Orders', Pages.adminDashboard);
Router.register('/Products', Pages.adminDashboard);
Router.register('/Reports', Pages.adminDashboard);
Router.register('/ActivityLogs', Pages.adminDashboard);
Router.register('/Settings', Pages.adminDashboard);
Router.register('/Announcements', Pages.adminDashboard);
// Franchise routes
Router.register('/FranchiseDashboard', Pages.franchiseDashboard);
Router.register('/MyOrders', Pages.franchiseDashboard);
Router.register('/CreateOrder', Pages.franchiseDashboard);
Router.register('/Inventory', Pages.franchiseDashboard);
// Production routes
Router.register('/ProductionDashboard', Pages.productionDashboard);
Router.register('/ProductionQueue', Pages.productionDashboard);
Router.register('/ProductionIssues', Pages.productionDashboard);
// Dispatch routes
Router.register('/DispatchDashboard', Pages.dispatchDashboard);
Router.register('/ReadyForDispatch', Pages.dispatchDashboard);
Router.register('/ScheduledDeliveries', Pages.dispatchDashboard);
Router.register('/InTransit', Pages.dispatchDashboard);
Router.register('/Delivered', Pages.dispatchDashboard);
Router.register('/DeliveryIssues', Pages.dispatchDashboard);
// Profile (shared)
Router.register('/Profile', function(el) {
  if (Auth.isAdmin()) Pages.adminDashboard(el);
  else if (Auth.isFranchisee()) Pages.franchiseDashboard(el);
  else if (Auth.isProduction()) Pages.productionDashboard(el);
  else if (Auth.isDispatch()) Pages.dispatchDashboard(el);
  else Router.navigate('/MemberLogin');
});
// Legacy
Router.register('/Dashboard', Pages.franchiseDashboard);
Router.register('/OnlineOrder', Pages.franchiseDashboard);
Router.register('/404', (el) => {
  el.innerHTML = '<div style="text-align:center;padding:4rem;"><h1>404</h1><p>Page not found</p><a href="#/" style="color:#F58220;">Go home</a></div>';
});
Router.init();
