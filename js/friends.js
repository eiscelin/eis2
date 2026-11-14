// Friends: friend requests between members ("People you may know")
// A request is one row in friend_requests; accepted = friends.
window.Friends = (function () {
  let meId = null;
  let rows = [];      // every friend request involving the signed-in member
  let people = {};    // id -> user, for the members who sent me a request
  let missing = false; // the friend_requests table has not been created yet
  let outsideWired = false;

  const asId = value => String(value == null ? '' : value);
  const isVideo = url => /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(String(url || ''));
  const nameOf = person => (person && (person.full_name || person.username)) || 'Member';

  const LABELS = {
    none: 'Add Friend',
    outgoing: 'Request sent',
    incoming: 'Confirm',
    friends: 'Friends ✓'
  };

  // The picture (photo or short video) that stands for a member, or their letter
  function media(person) {
    const name = nameOf(person);
    const url = (person && person.avatar_url) || '';
    if (!url) return fbEscape((name.trim()[0] || '?').toUpperCase());
    return isVideo(url)
      ? `<video src="${fbEscape(url)}" autoplay muted loop playsinline></video>`
      : `<img src="${fbEscape(url)}" alt="${fbEscape(name)}">`;
  }

  function label(state) { return LABELS[state] || LABELS.none; }
  function isLocked(state) { return state === 'outgoing' || state === 'friends'; }

  // ---------- Reading the requests ----------

  function between(otherId) {
    return rows.filter(r =>
      (asId(r.sender_id) === asId(meId) && asId(r.receiver_id) === asId(otherId)) ||
      (asId(r.receiver_id) === asId(meId) && asId(r.sender_id) === asId(otherId))
    );
  }

  function statusWith(otherId) {
    const matches = between(otherId);
    const pending = matches.find(r => r.status === 'pending');
    if (pending) return asId(pending.sender_id) === asId(meId) ? 'outgoing' : 'incoming';
    return matches.some(r => r.status === 'accepted') ? 'friends' : 'none';
  }

  // The pending request the other member sent me
  function requestFrom(otherId) {
    return between(otherId).find(r => r.status === 'pending' && asId(r.receiver_id) === asId(meId)) || null;
  }

  function incoming() {
    return rows.filter(r => r.status === 'pending' && asId(r.receiver_id) === asId(meId));
  }

  function emit() {
    try { document.dispatchEvent(new CustomEvent('friends:changed')); } catch { /* no listeners */ }
  }

  function friendsError(error) {
    const message = String((error && error.message) || error || '');
    return /friend_requests/.test(message)
      ? new Error('Run 011_add_friend_requests.sql in Supabase, then try again')
      : new Error(message);
  }

  // Pictures and names of the members who sent me a request
  async function loadSenders() {
    const ids = incoming().map(r => asId(r.sender_id)).filter(id => id && !people[id]);
    if (!ids.length || !sb) return;
    const { data } = await sb.from('users')
      .select('id, username, full_name, avatar_url, role')
      .in('id', ids);
    (data || []).forEach(u => { people[asId(u.id)] = u; });
  }

  async function load(user) {
    if (user && user.id != null) meId = user.id;
    if (!sb || meId == null) { rows = []; emit(); return; }
    const { data, error } = await sb.from('friend_requests')
      .select('*')
      .or(`sender_id.eq.${meId},receiver_id.eq.${meId}`)
      .order('id', { ascending: false });
    if (error) { rows = []; missing = /friend_requests/.test(error.message); emit(); return; }
    missing = false;
    rows = data || [];
    await loadSenders();
    emit();
  }

  // Followers: a member's friends are their followers, so the count is simply
  // how many accepted friend requests involve them. Nobody can follow without
  // being a friend, and there is no follow button.
  async function countFollowers(userId) {
    if (!sb || userId == null) return 0;
    const { data, error } = await sb.from('friend_requests')
      .select('id')
      .eq('status', 'accepted')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    if (error) return 0;
    return (data || []).length;
  }

  // ---------- Sending and answering ----------

  async function send(targetId) {
    if (!sb || meId == null) throw new Error('Log in to add friends');
    if (ReadOnlyMode.block('Adding friends')) return statusWith(targetId);
    const state = statusWith(targetId);
    if (state === 'outgoing' || state === 'friends') return state;
    const { data, error } = await sb.from('friend_requests')
      .insert([{ sender_id: meId, receiver_id: targetId, status: 'pending' }])
      .select()
      .single();
    if (error) throw friendsError(error);
    rows.unshift(data);
    emit();
    return 'outgoing';
  }

  async function respond(requestId, accept) {
    if (!sb) throw new Error('the database is not connected');
    if (ReadOnlyMode.block('Answering friend requests')) return;
    if (accept) {
      const { error } = await sb.from('friend_requests')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', requestId);
      if (error) throw friendsError(error);
      const row = rows.find(r => asId(r.id) === asId(requestId));
      if (row) { row.status = 'accepted'; row.responded_at = new Date().toISOString(); }
    } else {
      // Declining removes the request, so it can be sent again later
      const { error } = await sb.from('friend_requests').delete().eq('id', requestId);
      if (error) throw friendsError(error);
      rows = rows.filter(row => asId(row.id) !== asId(requestId));
    }
    emit();
  }

  // One click on a member: send a request, or confirm the one they sent me
  async function act(otherId) {
    const state = statusWith(otherId);
    if (state === 'incoming') {
      const request = requestFrom(otherId);
      if (!request) return state;
      await respond(request.id, true);
      return 'accepted';
    }
    if (state === 'none') {
      await send(otherId);
      return 'sent';
    }
    return state;
  }

  // ---------- The notification bell in the top bar ----------

  function requestRowsHTML() {
    if (missing) {
      return '<p class="fb-notif-empty">Friend requests are not set up yet.<br>Run 011_add_friend_requests.sql in Supabase.</p>';
    }
    const list = incoming();
    if (!list.length) return '<p class="fb-notif-empty">No friend requests right now.</p>';
    return list.map(row => {
      const person = people[asId(row.sender_id)] || { id: row.sender_id };
      return `<div class="fb-request">
        <a class="fb-request-pic" href="#/u/${encodeURIComponent(person.username || '')}" title="Open ${fbEscape(nameOf(person))}'s profile">${media(person)}</a>
        <div class="fb-request-body">
          <div class="fb-request-name">${fbEscape(nameOf(person))}</div>
          <div class="fb-request-meta">sent you a friend request</div>
          <div class="fb-request-actions">
            <button class="fb-btn fb-btn-primary" type="button" data-accept="${fbEscape(row.id)}">Confirm</button>
            <button class="fb-btn fb-btn-secondary" type="button" data-decline="${fbEscape(row.id)}">Delete</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function mountBell(shell, user) {
    const btn = shell.querySelector('#fbFriendsBtn');
    if (!btn) return;
    const badge = shell.querySelector('#fbFriendsBadge');

    const panel = document.createElement('div');
    panel.className = 'fb-notif-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Friend requests');
    panel.innerHTML = `
      <div class="fb-notif-head">
        <h3>Friend requests</h3>
        <button class="fb-notif-close" type="button" aria-label="Close friend requests">✕</button>
      </div>
      <div class="fb-notif-body"></div>`;
    shell.appendChild(panel);

    const head = panel.querySelector('.fb-notif-head h3');
    const body = panel.querySelector('.fb-notif-body');

    // The badge counts the friend requests plus the unread replies to my comments
    function paint() {
      const count = incoming().length;
      const total = count + (window.CommentNotif ? window.CommentNotif.unread() : 0);
      badge.textContent = total > 99 ? '99+' : String(total);
      badge.hidden = !total;
      head.textContent = count ? `Friend requests (${count})` : 'Friend requests';
      body.innerHTML = requestRowsHTML();
    }

    document.addEventListener('friends:changed', paint);
    document.addEventListener('comment-notif:changed', paint);
    badge.hidden = true;
    body.innerHTML = requestRowsHTML();

    if (window.Friends && user) load(user).catch(() => {});

    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const opening = panel.hidden;
      panel.hidden = !opening;
      btn.setAttribute('aria-expanded', String(opening));
      if (opening) {
        try { await load(user); } catch { /* keep what is already shown */ }
        paint();
      }
    });

    panel.querySelector('.fb-notif-close').addEventListener('click', () => { panel.hidden = true; });

    panel.addEventListener('click', async e => {
      const acceptBtn = e.target.closest('[data-accept]');
      const declineBtn = e.target.closest('[data-decline]');
      if (!acceptBtn && !declineBtn) return;
      const button = acceptBtn || declineBtn;
      const id = button.dataset[acceptBtn ? 'accept' : 'decline'];
      button.disabled = true;
      const row = rows.find(r => asId(r.id) === asId(id));
      const person = row ? people[asId(row.sender_id)] : null;
      try {
        await respond(id, !!acceptBtn);
        showToast(acceptBtn ? 'You are now friends with ' + nameOf(person) : 'Friend request deleted', acceptBtn ? 'success' : '');
      } catch (err) {
        button.disabled = false;
        showToast(err.message, 'error', 6000);
      }
    });

    if (!outsideWired) {
      outsideWired = true;
      document.addEventListener('click', e => {
        document.querySelectorAll('.fb-notif-panel').forEach(open => {
          if (open.hidden) return;
          if (open.contains(e.target) || e.target.closest('#fbFriendsBtn')) return;
          open.hidden = true;
        });
      });
    }
  }

  return {
    load,
    send,
    respond,
    act,
    incoming,
    statusWith,
    countFollowers,
    label,
    isLocked,
    media,
    mountBell
  };
})();
