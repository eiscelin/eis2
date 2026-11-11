// Customer Service chat — a help button on profile pages and on the log in page
(function () {
  const GUEST_ID_KEY = 'chookee_guest_id';
  const GUEST_NAME_KEY = 'chookee_guest_name';

  let root = null;
  let timer = null;

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  // Visitors who can't log in still get a stable identity to be answered on
  function guestId() {
    let id = localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      id = 'guest:' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
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

    const me = user ? String(user.id) : guestId();
    const signedIn = !!user;
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
            <span id="supSub">${signedIn ? 'We usually reply within a few minutes' : 'Locked out? Tell us your problem here'}</span>
          </div>
          <button class="fb-support-close" id="supClose" type="button" aria-label="Close">✕</button>
        </header>
        ${signedIn ? '' : '<label class="fb-support-name">Your name <input id="supName" type="text" maxlength="40" placeholder="So we know who we are helping" value="' + esc(localStorage.getItem(GUEST_NAME_KEY) || '') + '"></label>'}
        <div class="fb-support-log" id="supLog"><div class="fb-support-empty">Write your message and our team will answer here.</div></div>
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
        log.innerHTML = '<div class="fb-support-empty">Write your message and our team will answer here.</div>';
        return;
      }
      log.innerHTML = rows.map(m => {
        const mine = String(m.sender_id) === me;
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
      try {
        const [mine, theirs] = await Promise.all([
          sb.from('chat_messages').select('*').eq('sender_id', me).eq('receiver_id', agent.id),
          sb.from('chat_messages').select('*').eq('sender_id', agent.id).eq('receiver_id', me)
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
      if (String(agent.id) === me) sub.textContent = 'You are the Customer Service account';
      await loadMessages();
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

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!agent || String(agent.id) === me) return;
      let text = input.value.trim();
      if (!text) return;
      if (!signedIn) {
        const name = (nameInput.value || '').trim();
        if (name) localStorage.setItem(GUEST_NAME_KEY, name);
        text = '[' + (name || 'Guest') + '] ' + text;
      }
      input.value = '';
      try {
        const { error } = await sb.from('chat_messages').insert([{ sender_id: me, receiver_id: agent.id, message: text }]);
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
