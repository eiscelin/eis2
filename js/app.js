// Main app entry — registers all routes and boots the router
Auth.init();
// Every page starts from the signed-in member's own background picture; an
// account page then swaps in the picture of the account it shows.
// The Customer Service button floats on top of every page.
Router.afterRender = () => {
  fbPaintPageBackground(Auth.currentUser && Auth.currentUser.background_url);
  if (window.SupportWidget) window.SupportWidget.mount(Auth.currentUser);
};
Router.register('/', Pages.landing);
Router.register('/Login', Pages.login);
Router.register('/Register', Pages.register);
Router.register('/App', Pages.app);
// Own profile link opens the profile tab straight away
Router.register('/App/Profile', (el) => Pages.app(el, 'profile'));
// Admin panel — guarded inside Pages.admin
Router.register('/Admin', Pages.admin);
// Shared profile link: #/u/<username>
Router.registerFallback(path => {
  const match = path.match(/^\/u\/([^/?#]+)$/);
  if (!match) return null;
  return (el) => Pages.userProfile(el, decodeURIComponent(match[1]));
});
Router.register('/404', (el) => {
  el.innerHTML = '<div style="text-align:center;padding:4rem;"><h1>404</h1><p>Page not found</p><a href="#/" style="color:#1877f2;">Go home</a></div>';
});
Router.init();
