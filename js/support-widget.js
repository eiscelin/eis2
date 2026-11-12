// Customer Service chat — a green help button that floats above every page
(function () {
  const GUEST_NAME_KEY = 'chookee_guest_name';
  const GUEST_PHONE_KEY = 'chookee_guest_phone';
  const SEEN_KEY = 'chookee_support_seen';
  const POLL_MS = 4000;

  let root = null;
  let timer = null;
  let mountedFor = null;
  let audio = null;

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  // Visitors who cannot log in are known by the username they type, so the same
  // person picks up the same conversation on any device they chat from.
  function savedGuestName() {
    return (localStorage.getItem(GUEST_NAME_KEY) || '').trim();
  }

  function savedGuestPhone() {
    return (localStorage.getItem(GUEST_PHONE_KEY) || '').trim();
  }

  function guestIdFor(name) {
    return 'guest:' + name.trim().replace(/^@+/, '').toLowerCase();
  }

  // ---- Read marks: the newest message seen from each person, kept on this device
  function seenKey(meId, peerId) { return meId + '>' + peerId; }

  function readSeen() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch { return {}; }
  }

  function readSeenAt(meId, peerId) {
    return readSeen()[seenKey(meId, peerId)] || '';
  }

  function markSeen(meId, peerId, when) {
    const map = readSeen();
    map[seenKey(meId, peerId)] = when || new Date().toISOString();
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(map)); } catch { /* storage full — badge just re-appears */ }
  }

  // ---- Loud two-tone chime, built on the fly so no sound file is needed
  function playChime() {
    if (!audio) return;
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    const now = audio.currentTime + 0.02;
    [[880, 0], [1320, 0.18]].forEach(([freq, delay]) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + delay);
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.6, now + delay + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.5);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.55);
    });
  }

  // Browsers only allow sound once the visitor has touched the page
  function unlockAudio() {
    if (!audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      try { audio = new Ctx(); } catch { return; }
    }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  }

  function unmount() {
    if (timer) { clearInterval(timer); timer = null; }
    if (root) { root.remove(); root = null; }
    mountedFor = null;
  }

  async function findAgent() {
    try {
      const { data } = await sb.from('users').select('id, username, full_name').eq('role', 'admin').limit(1);
      return (data && data[0]) || null;
    } catch {
      return null;
    }
  }

  function mount(user) {
    if (!sb) return;
    const signedIn = !!user;
    // Signed-in people keep their own view; visitors share one so typing a
    // username does not rebuild the panel under them.
    const mountKey = signedIn ? 'u:' + user.id : 'guest';
    if (root && mountedFor === mountKey && document.body.contains(root)) return;
    unmount();
    mountedFor = mountKey;

    let guest = signedIn ? '' : savedGuestName();
    let phone = signedIn ? '' : savedGuestPhone();
    const me = () => (signedIn ? String(user.id) : (guest ? guestIdFor(guest) : null));
    const isAgent = signedIn && user.role === 'admin';
    const emptyText = signedIn
      ? 'Write your message and our team will answer here.'
      : 'Type the username you log in with and your active mobile number, then write your message.';
    let agent = null;        // the Customer Service account a member writes to first
    let admins = null;       // everyone who answers as Customer Service
    let peer = null;         // admin view: the member being chatted with
    let users = [];          // admin view: everyone a chat can be started with
    let inbox = [];
    let lastFromAgent = null;
    let newestKnown = null;

    const el = document.createElement('div');
    el.className = 'fb-support';
    el.innerHTML = `
      <button class="fb-support-fab" id="supFab" type="button" aria-expanded="false" aria-label="Customer Service">
        <span aria-hidden="true">🎧</span><span>Customer Service</span>
        <span class="fb-support-badge" id="supBadge" hidden>0</span>
      </button>
      <section class="fb-support-panel" id="supPanel" hidden aria-label="Customer Service chat">
        <header class="fb-support-head">
          <div>
            <strong id="supTitle">Customer Service</strong>
            <span id="supSub">${signedIn ? (isAgent ? 'Start a chat with any member' : 'We usually reply within a few minutes') : 'Tell us your username and mobile number'}</span>
          </div>
          <button class="fb-support-close" id="supClose" type="button" aria-label="Close">✕</button>
        </header>
        ${signedIn ? '' : '<label class="fb-support-name">Your username <input id="supName" type="text" maxlength="40" placeholder="The username you use to log in" autocomplete="off" value="' + esc(guest) + '"></label>'
          + '<label class="fb-support-name">Mobile number <input id="supPhone" type="tel" maxlength="20" placeholder="Active number for a call" autocomplete="tel" value="' + esc(phone) + '"></label>'}
        <div class="fb-support-list" id="supList" hidden></div>
        <div class="fb-support-thread" id="supThread">
          <button class="fb-support-back" id="supBack" type="button" hidden>← All chats</button>
          <div class="fb-support-log" id="supLog"><div class="fb-support-empty">${esc(emptyText)}</div></div>
          <form class="fb-support-form" id="supForm">
            <input id="supInput" type="text" placeholder="Write your message…" autocomplete="off" aria-label="Your message">
            <button type="submit">Send</button>
          </form>
        </div>
      </section>`;
    document.body.appendChild(el);
    root = el;

    // Keep the help button clear of the messenger bubble
    setTimeout(() => {
      if (root === el && document.getElementById('chatWidget')) el.classList.add('has-chat');
    }, 0);

    const fab = el.querySelector('#supFab');
    const badge = el.querySelector('#supBadge');
    const panel = el.querySelector('#supPanel');
    const list = el.querySelector('#supList');
    const thread = el.querySelector('#supThread');
    const backBtn = el.querySelector('#supBack');
    const log = el.querySelector('#supLog');
    const form = el.querySelector('#supForm');
    const input = el.querySelector('#supInput');
    const nameInput = el.querySelector('#supName');
    const phoneInput = el.querySelector('#supPhone');
    const title = el.querySelector('#supTitle');
    const sub = el.querySelector('#supSub');

    // ---------- Queries ----------
    async function adminIds() {
      if (admins) return admins;
      try {
        const { data } = await sb.from('users').select('id').eq('role', 'admin');
        admins = (data || []).map(r => String(r.id));
      } catch { admins = []; }
      return admins;
    }

    // Every message between me and the given people, oldest first
    async function threadRows(meId, peers) {
      const ids = (peers || []).map(String).filter(Boolean);
      if (!ids.length) return [];
      const [sent, got] = await Promise.all([
        sb.from('chat_messages').select('*').eq('sender_id', meId).in('receiver_id', ids),
        sb.from('chat_messages').select('*').eq('receiver_id', meId).in('sender_id', ids)
      ]);
      return [...(sent.data || []), ...(got.data || [])]
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    function paint(rows) {
      const id = me();
      if (!rows.length) {
        log.innerHTML = `<div class="fb-support-empty">${esc(isAgent && peer ? 'No messages yet. Say hello 👋' : emptyText)}</div>`;
        return;
      }
      log.innerHTML = rows.map(m => {
        const mine = String(m.sender_id) === id;
        const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `<div class="chat-bubble ${mine ? 'chat-bubble-me' : 'chat-bubble-them'}">
          <div class="chat-bubble-text">${esc(m.message)}</div>
          <div class="chat-bubble-time">${esc(time)}</div>
        </div>`;
      }).join('');
      log.scrollTop = log.scrollHeight;
      // Whatever is on screen has been read
      if (id) {
        rows.forEach(m => {
          if (String(m.receiver_id) === id) markSeen(id, String(m.sender_id), m.created_at);
        });
      }
    }

    async function loadThread() {
      const id = me();
      if (!id) {
        log.innerHTML = '<div class="fb-support-empty">Type the username you use to log in so we know who we are helping.</div>';
        return;
      }
      try {
        if (isAgent && !peer) return;
        if (!isAgent && !agent) return;
        const rows = isAgent
          ? await threadRows(id, [peer.id])
          : await threadRows(id, await adminIds());
        paint(rows);
        // A member answers the person who wrote last, or the Customer Service account
        const inbound = rows.filter(m => String(m.receiver_id) === id);
        lastFromAgent = inbound.length ? String(inbound[inbound.length - 1].sender_id) : null;
      } catch {
        log.innerHTML = '<div class="fb-support-empty">Customer Service chat is not available right now.</div>';
      }
    }

    async function loadUsers() {
      try {
        const { data } = await sb.from('users').select('*').neq('id', user.id).order('username', { ascending: true });
        users = (data || []).filter(u => !u.deleted_at && u.status !== 'deleted' && u.status !== 'suspended');
      } catch { users = []; }
    }

    // Admin inbox: every member, plus guests who wrote in, with the latest message
    async function loadInbox() {
      await loadUsers();
      const ids = await adminIds();
      let got = [], sent = [];
      if (ids.length) {
        try {
          const [a, b] = await Promise.all([
            sb.from('chat_messages').select('*').in('receiver_id', ids).order('created_at', { ascending: false }).limit(300),
            sb.from('chat_messages').select('*').in('sender_id', ids).order('created_at', { ascending: false }).limit(300)
          ]);
          got = a.data || [];
          sent = b.data || [];
        } catch { /* the member list still lets a chat start */ }
      }
      const rows = [];
      const known = new Set();
      users.filter(u => u.role !== 'admin').forEach(u => {
        const id = String(u.id);
        known.add(id);
        rows.push({ id, name: u.full_name || u.username, meta: '@' + u.username });
      });
      got.forEach(m => {
        const id = String(m.sender_id || '');
        if (id.indexOf('guest:') === 0 && !known.has(id)) {
          known.add(id);
          rows.push({ id, name: '@' + id.slice(6), meta: 'Guest' });
        }
      });
      const lastBy = {};
      [...got, ...sent].forEach(m => {
        const peerId = ids.indexOf(String(m.sender_id)) >= 0 ? String(m.receiver_id) : String(m.sender_id);
        if (!known.has(peerId)) return;
        if (!lastBy[peerId] || new Date(m.created_at) > new Date(lastBy[peerId].created_at)) lastBy[peerId] = m;
      });
      rows.forEach(r => { r.last = lastBy[r.id] || null; });
      rows.sort((a, b) => {
        if (a.last && b.last) return new Date(b.last.created_at) - new Date(a.last.created_at);
        if (a.last) return -1;
        if (b.last) return 1;
        return a.name.localeCompare(b.name);
      });
      inbox = rows;
      renderInbox();
    }

    function renderInbox() {
      if (!inbox.length) {
        list.innerHTML = '<div class="fb-support-empty">No members to chat with yet.</div>';
        return;
      }
      list.innerHTML = inbox.map(r => `
        <button class="chat-user-item fb-support-peer" type="button" data-peer="${esc(r.id)}">
          <span class="chat-user-avatar">${esc((r.name || '?')[0].toUpperCase())}</span>
          <span class="chat-user-info">
            <span class="chat-user-name">${esc(r.name)}</span>
            <span class="chat-user-role">${esc(r.last ? (r.last.message || '') : (r.meta || ''))}</span>
          </span>
          <span class="fb-support-count" data-badge-for="${esc(r.id)}" hidden>0</span>
        </button>`).join('');
      list.querySelectorAll('[data-peer]').forEach(btn => {
        btn.addEventListener('click', () => openPeer(btn.dataset.peer));
      });
    }

    function openPeer(peerId) {
      const found = inbox.find(r => String(r.id) === String(peerId));
      peer = { id: String(peerId), name: found ? found.name : 'Member' };
      title.textContent = peer.name;
      sub.textContent = 'Customer Service chat';
      list.hidden = true;
      thread.hidden = false;
      backBtn.hidden = false;
      loadThread();
    }

    function showInbox() {
      peer = null;
      title.textContent = 'Customer Service';
      sub.textContent = 'Start a chat with any member';
      thread.hidden = true;
      backBtn.hidden = true;
      list.hidden = false;
      loadInbox();
    }

    // ---------- Unread badge + sound ----------
    function paintBadge(n) {
      if (n > 0) {
        badge.hidden = false;
        badge.textContent = n > 99 ? '99+' : String(n);
        fab.setAttribute('aria-label', 'Customer Service — ' + n + ' unread message' + (n === 1 ? '' : 's'));
      } else {
        badge.hidden = true;
        fab.setAttribute('aria-label', 'Customer Service');
      }
    }

    function paintPeerBadges(per) {
      list.querySelectorAll('[data-badge-for]').forEach(b => {
        const n = per[b.dataset.badgeFor] || 0;
        b.hidden = !n;
        b.textContent = n > 99 ? '99+' : String(n);
      });
    }

    async function checkIncoming() {
      const id = me();
      if (!id) { paintBadge(0); return; }
      let rows = [];
      try {
        const { data } = await sb.from('chat_messages').select('*')
          .eq('receiver_id', id).order('created_at', { ascending: false }).limit(100);
        rows = data || [];
      } catch { return; }

      // A message that was not there on the previous check rings the chime
      const top = rows.length ? Number(rows[0].id) : 0;
      if (newestKnown === null) newestKnown = top;
      else if (top > newestKnown) { newestKnown = top; playChime(); }

      const per = {};
      let total = 0;
      rows.forEach(m => {
        const from = String(m.sender_id);
        if (new Date(m.created_at) > new Date(readSeenAt(id, from) || 0)) {
          per[from] = (per[from] || 0) + 1;
          total += 1;
        }
      });
      paintBadge(total);
      paintPeerBadges(per);
    }

    async function poll() {
      if (!panel.hidden && (isAgent ? !!peer : !!agent)) await loadThread();
      await checkIncoming();
    }

    function startPolling() {
      if (timer) clearInterval(timer);
      timer = setInterval(poll, POLL_MS);
    }

    // ---------- Panel ----------
    async function openPanel() {
      panel.hidden = false;
      fab.setAttribute('aria-expanded', 'true');
      if (!signedIn) {
        if (!guest && nameInput) nameInput.focus();
        else if (!phone && phoneInput) phoneInput.focus();
      }
      if (isAgent) {
        if (peer) {
          list.hidden = true;
          thread.hidden = false;
          backBtn.hidden = false;
          await loadThread();
        } else {
          showInbox();
        }
      } else {
        if (!agent) agent = await findAgent();
        if (!agent) {
          log.innerHTML = '<div class="fb-support-empty">Customer Service is offline right now. Please try again later.</div>';
        } else {
          await loadThread();
        }
      }
      await checkIncoming();
    }

    function closePanel() {
      panel.hidden = true;
      fab.setAttribute('aria-expanded', 'false');
    }

    fab.addEventListener('click', () => {
      if (panel.hidden) openPanel();
      else closePanel();
    });
    el.querySelector('#supClose').addEventListener('click', closePanel);
    backBtn.addEventListener('click', showInbox);

    // The typed username becomes this device's identity for the chat
    if (nameInput) {
      nameInput.addEventListener('change', () => {
        guest = nameInput.value.trim();
        if (guest) localStorage.setItem(GUEST_NAME_KEY, guest);
        else localStorage.removeItem(GUEST_NAME_KEY);
        if (agent) loadThread();
      });
    }

    // The mobile number rides along with each request so we can call back
    if (phoneInput) {
      phoneInput.addEventListener('change', () => {
        phone = phoneInput.value.trim();
        if (phone) localStorage.setItem(GUEST_PHONE_KEY, phone);
        else localStorage.removeItem(GUEST_PHONE_KEY);
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let text = input.value.trim();
      if (!text) return;
      if (!signedIn) {
        const name = (nameInput.value || '').trim();
        const mobile = (phoneInput.value || '').trim();
        if (!name) {
          sub.textContent = 'Type the username you log in with first';
          nameInput.focus();
          return;
        }
        if (!mobile) {
          sub.textContent = 'Type your active mobile number first';
          phoneInput.focus();
          return;
        }
        guest = name;
        phone = mobile;
        localStorage.setItem(GUEST_NAME_KEY, name);
        localStorage.setItem(GUEST_PHONE_KEY, mobile);
        text = '[' + name + ' · ' + mobile + '] ' + text;
      }
      const id = me();
      if (!id) return;
      // An admin replies to the member they picked; a member answers Customer Service
      const to = isAgent ? (peer && peer.id) : (lastFromAgent || (agent && agent.id));
      if (!to || to === id) return;
      input.value = '';
      try {
        const { error } = await sb.from('chat_messages').insert([{ sender_id: id, receiver_id: to, message: text }]);
        if (error) throw error;
        await loadThread();
        await checkIncoming();
      } catch (err) {
        if (typeof showToast === 'function') showToast('Message not sent: ' + err.message, 'error');
      }
    });

    // Sound needs one touch on the page before the browser allows it
    document.addEventListener('pointerdown', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });

    startPolling();
    checkIncoming();
  }

  window.SupportWidget = { mount, unmount };

  // The help button belongs to every page, so follow the visitor across routes
  function sync() {
    const signedIn = typeof Auth !== 'undefined' && Auth.currentUser;
    mount(signedIn || null);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  else sync();
  window.addEventListener('hashchange', sync);
})();
