// Signed-in app: Home feed, Friends, Messages and Profile
var Pages = window.Pages || {};

Pages.app = function (el, startTab) {
  const user = Auth.currentUser;
  const navItems = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'friends', icon: '👥', label: 'Friends' },
    { id: 'messages', icon: '💬', label: 'Messages' },
    { id: 'profile', icon: '👤', label: 'Profile' }
  ];

  appShell(el, user, navItems, (main, tab) => {
    if (tab === 'home') Pages.feedTab(main, user);
    else if (tab === 'friends') Pages.peopleTab(main, user);
    else if (tab === 'messages') Pages.messagesTab(main, user);
    else Pages.profileTab(main, user);
  }, startTab);
};

window.Pages = Pages;
