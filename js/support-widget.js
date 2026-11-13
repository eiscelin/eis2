// Customer Service chat — the green help button floats on top of every page.
// Members and visitors talk to a customer service admin; an admin gets the
// list of customers and can start a conversation with any of them.
(function () {
  const GUEST_NAME_KEY = 'chookee_guest_name';
  const GUEST_PHONE_KEY = 'chookee_guest_phone';
  const READ_KEY = 'chookee_support_read';
  const POLL_MS = 5000;

  let root = null;
  let timer = null;
  let soundCtx = null;
  let soundUnlocked = false;

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

  // Which conversations were already read on this device — the badge counts the rest
  function readMap() {
    try { return JSON.parse(localStorage.getItem(READ_KEY)) || {}; } catch { return {}; }
  }

  function lastReadAt(thread) {
    const ts = readMap()[thread];
    const time = ts ? new Date(ts).getTime() : 0;
    return Number.isNaN(time) ? 0 : time;
  }

  function markRead(thread, at) {
    if (!thread) return;
    const map = readMap();
    map[thread] = at || new Date().toISOString();
    localStorage.setItem(READ_KEY, JSON.stringify(map));
  }

  // A loud, distinct three-note chime for a message that lands on this side
  function audio() {
    if (!soundCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      soundCtx = Ctx ? new Ctx() : false;
    }
    if (soundCtx && soundCtx.state === 'suspended') soundCtx.resume();
    return soundCtx || null;
  }

  function unlockSound() {
    if (soundUnlocked) return;
    soundUnlocked = true;
    // Browsers only allow sound after the visitor has clicked or tapped once
    document.addEventListener('pointerdown', audio, { once: true });
  }

  function chime() {
    const ctx = audio();
    if (!ctx || ctx.state !== 'running') return;
    const start = ctx.currentTime + 0.02;
    [0, 0.17, 0.4].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = start + offset;
      osc.type = 'triangle';
      osc.frequency.value = i === 1 ? 1318.5 : 987.8;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.4, at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.32);
    });
  }

  // Sits the button just above a profile cover — in the empty strip between the
  // page top and the photo — so the cover itself stays clear for the visitor
  function dockAboveCover(cover) {
    const rect = cover.getBoundingClientRect();
    if (!rect.height) return false;
    const fab = root.querySelector('.fb-support-fab');
    const height = (fab && fab.offsetHeight) || 36;
    const top = rect.top + window.scrollY - height - 8;
    // Nowhere to sit above the cover (it starts at the very top of the page)
    if (top < 4) return false;
    root.classList.add('dock-cover');
    root.style.setProperty('--sup-left', Math.round(rect.left + window.scrollX + rect.width / 2) + 'px');
    root.style.setProperty('--sup-top', Math.round(top) + 'px');
    return true;
  }

  // Where the button lives: the vacant stretch of the top bar, or above the
  // profile cover on pages without one
  function syncDock() {
    if (!root) return;
    const fab = root.querySelector('.fb-support-fab');
    const bar = document.querySelector('.fb-topbar');
    const cover = document.querySelector('.fb-cover');
    const rect = bar ? bar.getBoundingClientRect() : null;
    if (rect && rect.height) {
      const narrow = window.innerWidth <= 900;
      root.classList.add('dock-bar');
      root.classList.remove('dock-cover');
      // Phones: a round icon centred in the empty space between the search
      // button and the icons on the right
      root.classList.toggle('dock-compact', narrow);
      root.style.removeProperty('--sup-left');
      const leftGroup = bar.querySelector('.fb-topbar-left');
      const rightGroup = bar.querySelector('.fb-topbar-right');
      const gapStart = leftGroup ? leftGroup.getBoundingClientRect().right : rect.left;
      const gapEnd = rightGroup ? rightGroup.getBoundingClientRect().left : rect.right;
      const fabWidth = fab.offsetWidth || 38;
      // Wide screens sit just before the profile buttons; phones centre in the gap
      const anchor = narrow ? (gapStart + gapEnd) / 2 + fabWidth / 2 : gapEnd - 10;
      root.style.setProperty('--sup-top', Math.round(rect.top + (rect.height - fab.offsetHeight) / 2) + 'px');
      root.style.setProperty('--sup-right', Math.round(document.documentElement.clientWidth - anchor) + 'px');
      return;
    }
    root.classList.remove('dock-bar', 'dock-compact');
    if (cover && dockAboveCover(cover)) return;
    root.classList.remove('dock-cover');
    root.style.removeProperty('--sup-top');
    root.style.removeProperty('--sup-left');
  }

  // Layout keeps moving for a moment after a render or a resize — measure again
  function onLayoutChange() {
    syncDock();
    [120, 500, 1500].forEach(ms => setTimeout(syncDock, ms));
  }

  function unmount() {
    if (timer) { clearInterval(timer); timer = null; }
    window.removeEventListener('resize', onLayoutChange);
    window.removeEventListener('hashchange', onLayoutChange);
    if (root) { root.remove(); root = null; }
  }

  function mount(user) {
    if (!sb) return;
    const identity = user ? String(user.id) : 'guest';
    // Same person as the widget already on screen: keep the open chat
    if (root && root.isConnected && root.dataset.identity === identity) { syncDock(); return; }
    unmount();

    const signedIn = !!user;
    const isAdmin = signedIn && user.role === 'admin';
    let guest = signedIn ? '' : savedGuestName();
    let phone = signedIn ? '' : savedGuestPhone();
    let admins = [];       // every customer service account
    let customers = [];    // admin only: who can be messaged
    let active = null;     // who this side is talking to
    let seen = null;       // messages this device already knows about
    let listLoaded = false;

    const me = () => (signedIn ? String(user.id) : (guest ? guestIdFor(guest) : null));
    const subText = isAdmin
      ? 'Pick a customer to start a chat'
      : (signedIn ? 'We usually reply within a few minutes' : 'Tell us your username and mobile number');
    const emptyText = signedIn
      ? 'Write your message and our team will answer here.'
      : 'Type the username you log in with and your active mobile number, then write your message.';

    const el = document.createElement('div');
    el.className = 'fb-support';
    el.dataset.identity = identity;
    el.innerHTML = `
      <button class="fb-support-fab" id="supFab" type="button" aria-expanded="false" aria-label="Customer Service">
        <span aria-hidden="true">🎧</span> <span class="fb-support-label">Customer Service</span>
        <span class="fb-support-badge" id="supBadge" hidden>0</span>
      </button>
      <section class="fb-support-panel" id="supPanel" hidden aria-label="Customer Service chat">
        <header class="fb-support-head">
          <div>
            <strong id="supTitle">Customer Service</strong>
            <span id="supSub">${esc(subText)}</span>
          </div>
          <button class="fb-support-close" id="supClose" type="button" aria-label="Close">✕</button>
        </header>
        ${signedIn ? '' : `<label class="fb-support-name">Your username <input id="supName" type="text" maxlength="40" placeholder="The username you use to log in" autocomplete="off" value="${esc(guest)}"></label>
        <label class="fb-support-name">Mobile number <input id="supPhone" type="tel" maxlength="20" placeholder="Active number for a call" autocomplete="tel" value="${esc(phone)}"></label>`}
        <button class="fb-support-back" id="supBack" type="button" hidden>← All customers</button>
        <div class="fb-support-body">
          <div class="fb-support-list" id="supList" ${isAdmin ? '' : 'hidden'}></div>
          <div class="fb-support-log" id="supLog" ${isAdmin ? 'hidden' : ''}>
            <div class="fb-support-empty">${esc(emptyText)}</div>
          </div>
          <form class="fb-support-form" id="supForm" ${isAdmin ? 'hidden' : ''}>
            <input id="supInput" type="text" placeholder="Write your message…" autocomplete="off" aria-label="Your message">
            <button type="submit">Send</button>
          </form>
        </div>
      </section>`;
    document.body.appendChild(el);
    root = el;

    const $ = sel => el.querySelector(sel);
    const fab = $('#supFab');
    const panel = $('#supPanel');
    const log = $('#supLog');
    const list = $('#supList');
    const form = $('#supForm');
    const input = $('#supInput');
    const title = $('#supTitle');
    const sub = $('#supSub');
    const badge = $('#supBadge');
    const back = $('#supBack');
    const nameInput = $('#supName');
    const phoneInput = $('#supPhone');

    unlockSound();
    syncChatOffset();
    syncDock();
    window.addEventListener('resize', onLayoutChange);
    window.addEventListener('hashchange', onLayoutChange);
    // The page settles a moment after the first render — measure the cover again
    [0, 300, 1200].forEach(ms => setTimeout(syncDock, ms));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncDock);
    // The messenger bubble mounts a moment later — stack above it once it does
    [300, 1200].forEach(ms => setTimeout(syncChatOffset, ms));

    // ---------- rendering ----------
    function paint(rows) {
      if (!rows.length) {
        log.innerHTML = `<div class="fb-support-empty">${esc(emptyText)}</div>`;
        return;
      }
      const id = me();
      log.innerHTML = rows.map(m => {
        const mine = String(m.sender_id) === id;
        const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `<div class="chat-bubble ${mine ? 'chat-bubble-me' : 'chat-bubble-them'}">
          <div class="chat-bubble-text">${esc(m.message)}</div>
          <div class="chat-bubble-time">${esc(time)}</div>
        </div>`;
      }).join('');
      log.scrollTop = log.scrollHeight;
    }

    function paintBadge(total) {
      badge.hidden = !total;
      badge.textContent = total > 99 ? '99+' : String(total);
      fab.setAttribute('aria-label', total
        ? `Customer Service — ${total} new message${total === 1 ? '' : 's'}`
        : 'Customer Service');
    }

    function paintCustomers() {
      if (!customers.length) {
        list.innerHTML = '<div class="fb-support-empty">No customers yet.</div>';
        return;
      }
      list.innerHTML = customers.map(c => `
        <button class="fb-support-person" type="button" data-cid="${esc(c.id)}">
          <span class="fb-support-avatar" aria-hidden="true">${esc((c.name || '?').trim()[0].toUpperCase())}</span>
          <span class="fb-support-person-info">
            <span class="fb-support-person-name">${esc(c.name)}</span>
            <span class="fb-support-person-meta">${esc(c.meta)}</span>
          </span>
          <span class="fb-support-count" hidden></span>
        </button>`).join('');
      list.querySelectorAll('.fb-support-person').forEach(btn => {
        btn.addEventListener('click', () => {
          const customer = customers.find(c => c.id === btn.dataset.cid);
          if (customer) openCustomer(customer);
        });
      });
    }

    function showList() {
      log.hidden = true;
      form.hidden = true;
      list.hidden = false;
      title.textContent = 'Customer Service';
      sub.textContent = 'Pick a customer to start a chat';
      back.hidden = true;
      active = null;
    }

    function showLog() {
      list.hidden = true;
      log.hidden = false;
      form.hidden = false;
      back.hidden = !isAdmin;
    }

    // ---------- data ----------
    async function loadAdmins() {
      try {
        const { data } = await sb.from('users').select('id, username, full_name').eq('role', 'admin');
        admins = (data || []).map(a => ({
          id: String(a.id),
          name: a.full_name || a.username || 'Customer Service'
        }));
      } catch {
        admins = [];
      }
    }

    async function loadCustomers() {
      const found = [];
      try {
        const { data } = await sb.from('users')
          .select('id, username, full_name, role, status, deleted_at')
          .order('username', { ascending: true });
        (data || [])
          .filter(u => String(u.id) !== String(user.id) && !u.deleted_at && u.status !== 'deleted' && u.status !== 'suspended')
          .forEach(u => found.push({
            id: String(u.id),
            name: u.full_name || u.username || 'Member',
            meta: u.role === 'admin' ? 'admin' : 'member'
          }));
        // Visitors who wrote in without an account
        const { data: guests } = await sb.from('chat_messages').select('sender_id').like('sender_id', 'guest:%');
        const known = new Set(found.map(c => c.id));
        (guests || []).forEach(row => {
          const id = String(row.sender_id || '');
          if (!id || known.has(id)) return;
          known.add(id);
          found.push({ id, name: id.slice(6), meta: 'visitor' });
        });
      } catch {
        // keep whatever we managed to load
      }
      customers = found;
      listLoaded = true;
    }

    // Messages that arrived on this side since this device last opened the thread
    async function unreadCounts() {
      const counts = {};
      const id = me();
      if (!id) return counts;
      let rows = [];
      try {
        const { data } = await sb.from('chat_messages')
          .select('sender_id, created_at')
          .eq('receiver_id', id)
          .order('created_at', { ascending: false })
          .limit(200);
        rows = data || [];
      } catch {
        return counts;
      }
      rows.forEach(m => {
        const from = String(m.sender_id || '');
        if (!from) return;
        if (!isAdmin && !admins.some(a => a.id === from)) return;
        const thread = isAdmin ? from : id;
        if (new Date(m.created_at).getTime() <= lastReadAt(thread)) return;
        counts[thread] = (counts[thread] || 0) + 1;
      });
      return counts;
    }

    async function refreshBadges() {
      const counts = await unreadCounts();
      const total = Object.keys(counts).reduce((sum, key) => sum + counts[key], 0);
      paintBadge(total);
      list.querySelectorAll('.fb-support-person').forEach(row => {
        const n = counts[row.dataset.cid] || 0;
        const tag = row.querySelector('.fb-support-count');
        if (!tag) return;
        tag.hidden = !n;
        tag.textContent = n > 99 ? '99+' : String(n);
      });
    }

    async function loadThread() {
      const id = me();
      if (!active) return;
      if (!id) {
        log.innerHTML = '<div class="fb-support-empty">Type the username you use to log in so we know who we are helping.</div>';
        return;
      }
      const adminIds = admins.map(a => a.id);
      try {
        let rows;
        if (isAdmin) {
          const [mine, theirs] = await Promise.all([
            sb.from('chat_messages').select('*').eq('sender_id', id).eq('receiver_id', active.id),
            sb.from('chat_messages').select('*').eq('sender_id', active.id).in('receiver_id', adminIds)
          ]);
          rows = [...(mine.data || []), ...(theirs.data || [])];
        } else {
          const [mine, theirs] = await Promise.all([
            sb.from('chat_messages').select('*').eq('sender_id', id).in('receiver_id', adminIds),
            sb.from('chat_messages').select('*').eq('receiver_id', id).in('sender_id', adminIds)
          ]);
          rows = [...(mine.data || []), ...(theirs.data || [])];
          // Answer the agent who wrote last, so a chat an admin started lands back with them
          const lastAgent = (theirs.data || []).slice()
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            .pop();
          if (lastAgent) active = { id: String(lastAgent.sender_id), name: 'Customer Service' };
        }
        rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        paint(rows);
        const newestTheirs = rows.filter(m => String(m.sender_id) !== id).pop();
        if (newestTheirs) markRead(isAdmin ? active.id : id, newestTheirs.created_at);
      } catch {
        log.innerHTML = '<div class="fb-support-empty">Customer Service chat is not available right now.</div>';
      }
    }

    // ---------- actions ----------
    async function openCustomer(customer) {
      active = customer;
      title.textContent = customer.name;
      sub.textContent = customer.meta === 'visitor' ? 'Visitor · no account' : 'Customer service chat';
      showLog();
      log.innerHTML = '<div class="fb-support-empty">Loading…</div>';
      await loadThread();
      await refreshBadges();
    }

    async function openPanel() {
      panel.hidden = false;
      fab.setAttribute('aria-expanded', 'true');
      // Docked under the cover the chat hangs below the button: on a short screen
      // that puts it past the bottom edge, so it opens upwards instead
      if (root.classList.contains('dock-cover')) {
        const fabRect = fab.getBoundingClientRect();
        panel.classList.toggle('panel-up', fabRect.bottom + panel.offsetHeight + 16 > window.innerHeight);
      } else {
        panel.classList.remove('panel-up');
      }
      if (!admins.length) await loadAdmins();
      if (!admins.length) {
        log.innerHTML = '<div class="fb-support-empty">Customer Service is offline right now. Please try again later.</div>';
        form.hidden = true;
        return;
      }
      if (isAdmin) {
        if (!listLoaded) await loadCustomers();
        if (active) await loadThread();
        else { paintCustomers(); showList(); }
        await refreshBadges();
      } else {
        if (!active) active = { id: admins[0].id, name: 'Customer Service' };
        showLog();
        await loadThread();
        await refreshBadges();
        if (!signedIn) {
          if (!guest && nameInput) nameInput.focus();
          else if (!phone && phoneInput) phoneInput.focus();
        }
      }
    }

    function closePanel() {
      panel.hidden = true;
      fab.setAttribute('aria-expanded', 'false');
    }

    function syncChatOffset() {
      if (!root) return;
      root.classList.toggle('has-chat', !!document.getElementById('chatWidget'));
    }

    // Watch this side's inbox so a new message badges the button and rings,
    // even with the panel closed
    async function watchInbox() {
      const id = me();
      if (!id) return;
      let rows = [];
      try {
        const { data } = await sb.from('chat_messages')
          .select('id, sender_id, created_at')
          .eq('receiver_id', id)
          .order('created_at', { ascending: false })
          .limit(50);
        rows = data || [];
      } catch {
        return;
      }
      rows = rows.filter(m => isAdmin || admins.some(a => a.id === String(m.sender_id)));
      const ids = new Set(rows.map(m => String(m.id)));
      if (seen) {
        const openThread = (!panel.hidden && isAdmin && active) ? active.id : null;
        const ring = rows.some(m => !seen.has(String(m.id)) && String(m.sender_id) !== openThread);
        if (ring) chime();
      }
      seen = ids;
      await refreshBadges();
    }

    function startPolling() {
      stopPolling();
      timer = setInterval(async () => {
        // A phone in the background has nothing to show, so it stops asking
        if (document.hidden) return;
        syncChatOffset();
        syncDock();
        if (!panel.hidden && active) await loadThread();
        await watchInbox();
      }, POLL_MS);
    }

    function stopPolling() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    // ---------- wiring ----------
    fab.addEventListener('click', () => {
      try { audio(); } catch { /* the chat must still open without sound */ }
      if (panel.hidden) openPanel();
      else closePanel();
    });
    $('#supClose').addEventListener('click', closePanel);

    back.addEventListener('click', async () => {
      showList();
      if (!listLoaded) await loadCustomers();
      paintCustomers();
      await refreshBadges();
    });

    // The typed username becomes this device's identity for the chat
    if (nameInput) {
      nameInput.addEventListener('change', async () => {
        guest = nameInput.value.trim();
        if (guest) localStorage.setItem(GUEST_NAME_KEY, guest);
        else localStorage.removeItem(GUEST_NAME_KEY);
        if (guest && panel.hidden === false) await loadThread();
        await refreshBadges();
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
      if (!active) return;
      const id = me();
      if (!id) {
        sub.textContent = 'Type the username you log in with first';
        if (nameInput) nameInput.focus();
        return;
      }
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
      input.value = '';
      try {
        const { error } = await sb.from('chat_messages').insert([{ sender_id: me(), receiver_id: active.id, message: text }]);
        if (error) throw error;
        await loadThread();
      } catch (err) {
        input.value = text;
        if (typeof showToast === 'function') showToast('Message not sent: ' + err.message, 'error');
      }
    });

    // The badge and the ring work from here on, with the panel closed
    (async () => {
      await loadAdmins();
      await watchInbox();
      if (!root || root !== el) return;
      startPolling();
    })();
  }

  window.SupportWidget = { mount, unmount };
})();
