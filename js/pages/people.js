// Friends + Messages tabs — the people directory
var Pages = window.Pages || {};

function personMedia(p) {
  const name = p.full_name || p.username || 'Member';
  return window.Friends
    ? Friends.media(p)
    : fbEscape((name.trim()[0] || '?').toUpperCase());
}

function peopleRows(people, withFriendButton) {
  return people.map(p => {
    const name = p.full_name || p.username || 'Member';
    const link = '#/u/' + encodeURIComponent(p.username || '');
    const state = window.Friends ? Friends.statusWith(p.id) : 'none';
    const friendBtn = (withFriendButton && window.Friends)
      ? `<button class="fb-btn ${state === 'none' ? 'fb-btn-primary' : 'fb-btn-secondary'}" type="button" data-friend="${fbEscape(p.id)}"${Friends.isLocked(state) ? ' disabled' : ''}>${fbEscape(Friends.label(state))}</button>`
      : '';
    return `<div class="fb-person-row">
      <a class="fb-person-pic" href="${link}" title="Open ${fbEscape(name)}'s profile">${personMedia(p)}</a>
      <a class="fb-person-info" href="${link}">
        <div class="name">${fbEscape(name)}</div>
        <div class="meta">@${fbEscape(p.username || '')}</div>
      </a>
      ${friendBtn}
      <button class="fb-btn fb-btn-secondary" type="button" data-uid="${fbEscape(p.id)}">Message</button>
    </div>`;
  }).join('');
}

function loadPeople(main, user, heading, emptyMsg, options) {
  const opts = options || {};
  main.innerHTML = `
    <div class="fb-feed">
      <section class="fb-card">
        <div class="fb-card-head"><h3>${heading}</h3></div>
        ${opts.search ? `<div class="fb-people-search">
          <input id="peopleSearch" type="search" placeholder="Search people by username"
            aria-label="Search people by username" autocomplete="off">
        </div>` : ''}
        <div id="peopleList"><div class="loading">Loading…</div></div>
      </section>
    </div>
  `;

  const list = main.querySelector('#peopleList');
  const search = main.querySelector('#peopleSearch');
  let people = [];
  let query = '';

  function renderPeople(nextQuery) {
    if (nextQuery !== undefined) query = String(nextQuery || '');
    const q = query.trim().toLowerCase();
    const shown = people.filter(p => !q
      || String(p.username || '').toLowerCase().includes(q)
      || String(p.full_name || '').toLowerCase().includes(q));
    list.innerHTML = shown.length
      ? peopleRows(shown, !!opts.addFriend)
      : emptyState('👥', q ? 'No one matches your search.' : emptyMsg);
    list.querySelectorAll('[data-uid]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.ChatWidget && window.ChatWidget.openWith) window.ChatWidget.openWith(btn.dataset.uid);
        else showToast('Messaging is unavailable right now', 'error');
      });
    });
  }

  // Add Friend sends a request; Confirm accepts the one they sent you
  list.addEventListener('click', async e => {
    const btn = e.target.closest('[data-friend]');
    if (!btn || btn.disabled || !window.Friends) return;
    const person = people.find(p => String(p.id) === String(btn.dataset.friend));
    const name = person ? (person.full_name || person.username || 'Member') : 'Member';
    btn.disabled = true;
    try {
      const result = await Friends.act(btn.dataset.friend);
      if (result === 'sent') showToast('Friend request sent to ' + name, 'success');
      if (result === 'accepted') showToast('You are now friends with ' + name, 'success');
    } catch (err) {
      showToast(err.message, 'error', 6000);
    }
    renderPeople();
  });

  // A request answered in the notification bell updates these labels too
  if (opts.addFriend) {
    document.addEventListener('friends:changed', () => {
      if (list.isConnected) renderPeople();
    });
  }

  if (search) {
    search.addEventListener('input', () => renderPeople(search.value));
  }

  async function load() {
    if (!sb) { people = []; renderPeople(); return; }
    try {
      const [{ data }] = await Promise.all([
        sb.from('users').select('*').order('username', { ascending: true }),
        (opts.addFriend && window.Friends) ? Friends.load(user) : Promise.resolve()
      ]);
      people = (data || []).filter(u =>
        String(u.id) !== String(user.id) &&
        u.role !== 'admin' &&
        !u.deleted_at &&
        u.status !== 'deleted' &&
        u.status !== 'suspended'
      );
    } catch {
      people = [];
    }
    renderPeople();
  }

  // The top bar search filters this directory too
  window.__appSearchHandler = (q) => {
    if (search) search.value = q || '';
    renderPeople(q);
  };
  load();
}

// The Friends view shows who you are friends with, then the requests you have
// sent and are waiting on. Nobody else is suggested here.
Pages.peopleTab = function (main, user) {
  main.innerHTML = `
    <div class="fb-feed">
      <section class="fb-card">
        <div class="fb-card-head"><h3>Friends</h3></div>
        <div class="fb-people-search">
          <input id="peopleSearch" type="search" placeholder="Search your friends by username"
            aria-label="Search your friends by username" autocomplete="off">
        </div>
        <div id="friendsList"><div class="loading">Loading…</div></div>
      </section>
      <section class="fb-card">
        <div class="fb-card-head"><h3>Sent friend requests</h3></div>
        <div id="sentList"><div class="loading">Loading…</div></div>
      </section>
    </div>`;

  const search = main.querySelector('#peopleSearch');
  const friendsList = main.querySelector('#friendsList');
  const sentList = main.querySelector('#sentList');
  let people = [];
  let query = '';

  function wireMessages(container) {
    container.querySelectorAll('[data-uid]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.ChatWidget && window.ChatWidget.openWith) window.ChatWidget.openWith(btn.dataset.uid);
        else showToast('Messaging is unavailable right now', 'error');
      });
    });
  }

  function render() {
    const q = query.trim().toLowerCase();
    const match = id => {
      const person = people.find(p => String(p.id) === String(id));
      if (!person) return null;
      if (!q) return person;
      return String(person.username || '').toLowerCase().includes(q)
        || String(person.full_name || '').toLowerCase().includes(q) ? person : null;
    };
    const friends = (window.Friends ? Friends.friendIds() : []).map(match).filter(Boolean);
    const sent = (window.Friends ? Friends.sentIds() : []).map(match).filter(Boolean);

    friendsList.innerHTML = friends.length
      ? peopleRows(friends, false)
      : emptyState('👥', q ? 'No friends match your search.' : 'No friends yet — open a post or a profile and add someone.');
    sentList.innerHTML = sent.length
      ? peopleRows(sent, true)
      : emptyState('📨', q ? 'No sent requests match your search.' : 'You have not sent any friend requests.');

    wireMessages(friendsList);
    wireMessages(sentList);
  }

  if (search) search.addEventListener('input', () => { query = search.value; render(); });

  // A request answered elsewhere updates these two lists too
  document.addEventListener('friends:changed', () => { if (friendsList.isConnected) render(); });

  window.__appSearchHandler = (q) => {
    if (search) search.value = q || '';
    query = q || '';
    render();
  };

  (async () => {
    if (!sb) { people = []; render(); return; }
    try {
      const [{ data }] = await Promise.all([
        sb.from('users').select('*').order('username', { ascending: true }),
        (window.Friends ? Friends.load(user) : Promise.resolve())
      ]);
      people = (data || []).filter(u =>
        String(u.id) !== String(user.id) &&
        u.role !== 'admin' &&
        !u.deleted_at &&
        u.status !== 'deleted' &&
        u.status !== 'suspended'
      );
    } catch {
      people = [];
    }
    render();
  })();
};

Pages.messagesTab = function (main, user) {
  loadPeople(main, user, 'Messages', 'No conversations yet. Invite a friend to join.');
};

window.Pages = Pages;
