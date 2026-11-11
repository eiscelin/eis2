// Customer Service chat — a help button on profile pages and on the log in page
(function () {
  const GUEST_NAME_KEY = 'chookee_guest_name';

  let root = null;
  let timer = null;

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

  function guestIdFor(name) {
    return 'guest:' + name.trim().replace(/^@+/, '').toLowerCase();
  }

  function unmount() {
    if (timer) { clearInterval(timer); timer = null; }
    if (root) { root.remove(); root = null; }
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
    unmount();
    if (!sb) return;

    const signedIn = !!user;
    let guest = signedIn ? '' : savedGuestName();
    const me = () => (signedIn ? String(user.id) : (guest ? guestIdFor(guest) : null));
    const emptyText = signedIn
      ? 'Write your message and our team will answer here.'
      : 'Type the username you log in with, then write your message.';
    let agent = null;
    let agentChecked = false;

    const el = document.createElement('div');
    el.className = 'fb-support';
    el.innerHTML = `
      <button class="fb-support-fab" id="supFab" type="button" aria-expanded="false">🎧 Customer Service</button>
      <section class="fb-support-panel" id="supPanel" hidden aria-label="Customer Service chat">
        <header class="fb-support-head">
          <div>
            <strong>Customer Service</strong>
            <span id="supSub">${signedIn ? 'We usually reply within a few minutes' : 'Tell us the username you log in with'}</span>
          </div>
          <button class="fb-support-close" id="supClose" type="button" aria-label="Close">✕</button>
        </header>
        ${signedIn ? '' : '<label class="fb-support-name">Your username <input id="supName" type="text" maxlength="40" placeholder="The username you use to log in" autocomplete="off" value="' + esc(guest) + '"></label>'}
        <div class="fb-support-log" id="supLog"><div class="fb-support-empty">${esc(emptyText)}</div></div>
        <form class="fb-support-form" id="supForm">
          <input id="supInput" type="text" placeholder="Write your message…" autocomplete="off" aria-label="Your message">
          <button type="submit">Send</button>
        </form>
      </section>`;
    document.body.appendChild(el);
    root = el;

    // Keep the help button clear of the messenger bubble
    setTimeout(() => {
      if (root === el && document.getElementById('chatWidget')) el.classList.add('has-chat');
    }, 0);

    const fab = el.querySelector('#supFab');
    const panel = el.querySelector('#supPanel');
    const log = el.querySelector('#supLog');
    const form = el.querySelector('#supForm');
    const input = el.querySelector('#supInput');
    const nameInput = el.querySelector('#supName');
    const sub = el.querySelector('#supSub');

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

    async function loadMessages() {
      if (!agent) return;
      const id = me();
      if (!id) {
        log.innerHTML = '<div class="fb-support-empty">Type the username you use to log in so we know who we are helping.</div>';
        return;
      }
      try {
        const [mine, theirs] = await Promise.all([
          sb.from('chat_messages').select('*').eq('sender_id', id).eq('receiver_id', agent.id),
          sb.from('chat_messages').select('*').eq('sender_id', agent.id).eq('receiver_id', id)
        ]);
        const rows = [...(mine.data || []), ...(theirs.data || [])]
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        paint(rows);
      } catch {
        log.innerHTML = '<div class="fb-support-empty">Customer Service chat is not available right now.</div>';
      }
    }

    async function openPanel() {
      panel.hidden = false;
      fab.setAttribute('aria-expanded', 'true');
      if (!agentChecked) {
        agentChecked = true;
        agent = await findAgent();
      }
      if (!agent) {
        log.innerHTML = '<div class="fb-support-empty">Customer Service is offline right now. Please try again later.</div>';
        return;
      }
      if (String(agent.id) === me()) sub.textContent = 'You are the Customer Service account';
      await loadMessages();
      if (!signedIn && !guest && nameInput) nameInput.focus();
      if (timer) clearInterval(timer);
      timer = setInterval(loadMessages, 4000);
    }

    function closePanel() {
      panel.hidden = true;
      fab.setAttribute('aria-expanded', 'false');
      if (timer) { clearInterval(timer); timer = null; }
    }

    fab.addEventListener('click', () => {
      if (panel.hidden) openPanel();
      else closePanel();
    });
    el.querySelector('#supClose').addEventListener('click', closePanel);

    // The typed username becomes this device's identity for the chat
    if (nameInput) {
      nameInput.addEventListener('change', () => {
        guest = nameInput.value.trim();
        if (guest) localStorage.setItem(GUEST_NAME_KEY, guest);
        else localStorage.removeItem(GUEST_NAME_KEY);
        if (agent) loadMessages();
      });
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!agent || String(agent.id) === me()) return;
      let text = input.value.trim();
      if (!text) return;
      if (!signedIn) {
        const name = (nameInput.value || '').trim();
        if (!name) {
          sub.textContent = 'Type the username you log in with first';
          nameInput.focus();
          return;
        }
        guest = name;
        localStorage.setItem(GUEST_NAME_KEY, name);
        text = '[' + name + '] ' + text;
      }
      input.value = '';
      try {
        const { error } = await sb.from('chat_messages').insert([{ sender_id: me(), receiver_id: agent.id, message: text }]);
        if (error) throw error;
        await loadMessages();
      } catch (err) {
        if (typeof showToast === 'function') showToast('Message not sent: ' + err.message, 'error');
      }
    });
  }

  window.SupportWidget = { mount, unmount };

  // Leave no help button behind when the page changes
  if (window.Router) Router.beforeRender = unmount;
})();
