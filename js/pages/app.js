// Signed-in app: Home feed, Friends, Messages and Profile
var Pages = window.Pages || {};

// A member whose first profile picture or video waits for an admin can log in,
// but posting, commenting and messaging stay locked until it is approved
function fbPendingApproval(member) {
  if (!member || member.role === 'admin') return false;
  if (member.avatar_url) return false; // a picture is already approved
  return member.avatar_review_status === 'pending' || member.cover_review_status === 'pending';
}

function fbApprovalLock(el, user) {
  const brand = fbBrand();
  const name = user.full_name || user.username || 'there';
  el.innerHTML = `
    <div class="fb-public">
      <div class="fb-public-bar">
        <span class="fb-logo" aria-label="${fbEscape(brand.name)}">${fbEscape(brand.initial)}</span>
        <button class="fb-btn fb-btn-secondary" id="lockLogout" type="button">Log out</button>
      </div>
      <section class="fb-card" style="margin:1rem;padding:2rem;text-align:center;">
        <div style="font-size:2.5rem;" aria-hidden="true">🕓</div>
        <h2>Waiting for admin approval</h2>
        <p style="margin-top:0.5rem;color:var(--fb-muted);">
          ${fbEscape(name)}, your first profile picture or video is waiting for an admin.
          Posting, commenting and sending messages unlock as soon as it is approved.
        </p>
        <button class="fb-btn fb-btn-primary" id="lockRefresh" type="button" style="margin-top:1rem;">Check again</button>
      </section>
    </div>`;
  el.querySelector('#lockLogout').addEventListener('click', () => Auth.logout());
  el.querySelector('#lockRefresh').addEventListener('click', () => Pages.app(el));
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

  // A first profile picture or video waiting for an admin locks the account
  if (fbPendingApproval(member)) {
    fbApprovalLock(el, user);
    return;
  }

  const navItems = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'friends', icon: '👥', label: 'Friends' },
    { id: 'messages', icon: '💬', label: 'Messages' },
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
