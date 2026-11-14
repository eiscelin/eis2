// Signed-in app: Home feed, Friends, Messages and Profile
var Pages = window.Pages || {};

// A member whose first profile picture or video waits for an admin can log in,
// but posting, commenting and messaging stay locked until it is approved
function fbPendingApproval(member) {
  if (!member || member.role === 'admin') return false;
  if (member.avatar_url) return false; // a picture is already approved
  return member.avatar_review_status === 'pending' || member.cover_review_status === 'pending';
}

Pages.app = async function (el, startTab) {
  const user = Auth.currentUser;
  if (!user) {
    location.hash = '#/Login';
    return;
  }

  // A suspended, deleted or promoted account takes effect on the next app load
  let member = null;
  if (sb) {
    try {
      const { data } = await sb.from('users')
        .select('status, deleted_at, role, avatar_url, cover_url, avatar_review_status, cover_review_status')
        .eq('id', user.id)
        .single();
      if (data) {
        if (data.deleted_at || data.status === 'deleted' || data.status === 'suspended') {
          showToast('Your account is not available. Contact an admin.', 'error', 6000);
          Auth.logout();
          return;
        }
        if (data.role && data.role !== user.role) {
          user.role = data.role;
          Auth.currentUser.role = data.role;
          localStorage.setItem('chookee_user', JSON.stringify(Auth.currentUser));
        }
        member = data;
      }
    } catch { /* accounts table not ready yet — keep the stored session */ }
  }

  // A first profile picture or video waiting for an admin leaves the app readable,
  // with every write action locked until the media is approved
  window.fbApprovalPending = fbPendingApproval(member);

  const navItems = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'friends', icon: '👥', label: 'Friends' },
    { id: 'profile', icon: '👤', label: 'Profile' }
  ];

  if (user.role === 'admin') {
    navItems.push({ id: 'admin', icon: '🛡️', label: 'Admin' });
  }

  appShell(el, user, navItems, (main, tab) => {
    if (tab === 'home') Pages.feedTab(main, user);
    else if (tab === 'friends') Pages.peopleTab(main, user);
    else if (tab === 'messages') Pages.messagesTab(main, user);
    else if (tab === 'admin') location.hash = '#/Admin';
    else Pages.profileTab(main, user);
  }, startTab);
};

window.Pages = Pages;
