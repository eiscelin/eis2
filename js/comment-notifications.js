// Replies to a member's own comments arrive in the top bar bell, right under
// the friend requests, and the unread ones add to the bell's badge.
var CommentNotif = window.CommentNotif || (function () {
  const SEEN_PREFIX = 'fbCommentSeen:';
  const LIMIT = 20;
  let user = null;
  let rows = [];                 // replies to my comments, newest first
  let people = new Map();        // who wrote each reply
  let parents = new Map();       // the comment of mine each reply answers

  function seenKey() { return SEEN_PREFIX + String(user && user.id); }

  function seenAt() {
    try { return localStorage.getItem(seenKey()) || ''; } catch { return ''; }
  }

  function markSeen() {
    try { localStorage.setItem(seenKey(), new Date().toISOString()); } catch { /* private mode */ }
  }

  // Replies that arrived after the bell was last opened
  function unread() {
    if (!user) return 0;
    const since = seenAt();
    return rows.filter(r => !since || String(r.created_at) > since).length;
  }

  function announce() { document.dispatchEvent(new Event('comment-notif:changed')); }

  async function load(account) {
    user = account || user;
    rows = [];
    people = new Map();
    parents = new Map();
    if (!sb || !user) return announce();
    // A reply has to answer one of my own comments to belong here
    const { data: mine } = await sb.from('post_comments').select('id')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(200);
    const ids = (mine || []).map(c => c.id);
    if (!ids.length) return announce();
    const { data } = await sb.from('post_comments').select('*')
      .in('parent_id', ids).neq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(LIMIT);
    rows = data || [];
    if (!rows.length) return announce();
    const writerIds = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)));
    const parentIds = Array.from(new Set(rows.map(r => r.parent_id).filter(Boolean)));
    const [peopleRes, parentRes] = await Promise.all([
      sb.from('users').select('id, username, full_name, avatar_url').in('id', writerIds),
      sb.from('post_comments').select('id, body').in('id', parentIds)
    ]);
    (peopleRes.data || []).forEach(p => people.set(String(p.id), p));
    (parentRes.data || []).forEach(p => parents.set(String(p.id), p));
    announce();
  }

  function rowsHtml() {
    if (!rows.length) return '<p class="fb-notif-empty">No replies to your comments yet.</p>';
    return rows.map(row => {
      const person = people.get(String(row.user_id)) || { id: row.user_id };
      const name = person.full_name || person.username || row.user_name || 'Member';
      const parent = parents.get(String(row.parent_id));
      return `<a class="fb-reply-notif" href="${postProfileHref(person.username)}">
        ${postAvatar(person, name, 'fb-avatar-xs')}
        <span class="fb-reply-notif-body">
          <span class="fb-reply-notif-name">${fbEscape(name)}</span>
          <span class="fb-reply-notif-meta">replied to your comment · ${fbEscape(postTimeAgo(row.created_at))}</span>
          <span class="fb-reply-notif-text">${fbEscape(row.body)}</span>
          ${parent ? `<span class="fb-reply-notif-parent">Your comment: ${fbEscape(parent.body)}</span>` : ''}
        </span>
      </a>`;
    }).join('');
  }

  // Adds the replies section to the bell panel the friend requests already built
  function mount(shell, account) {
    const panel = shell.querySelector('.fb-notif-panel');
    if (!panel || !account) return;
    user = account;
    const section = document.createElement('div');
    section.className = 'fb-notif-replies';
    section.innerHTML = `<div class="fb-notif-subhead">Replies to your comments</div>
      <div class="fb-notif-replies-body"></div>`;
    panel.appendChild(section);
    const body = section.querySelector('.fb-notif-replies-body');
    const paint = () => { body.innerHTML = rowsHtml(); };

    paint();
    load(account).then(paint);

    const btn = shell.querySelector('#fbFriendsBtn');
    if (btn) {
      btn.addEventListener('click', async () => {
        if (panel.hidden) return; // the bell was just closed
        markSeen();
        announce();
        await load(account);
        paint();
      });
    }
  }

  return { load, mount, unread };
})();
