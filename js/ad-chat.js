// The Message button on a playing ad opens the chat of the member who placed
// the ad. A signed-in member gets the normal Messages widget. A visitor without
// an account gets a small chat that works like the guest group chat: they pick
// a name once, reply in text only, and the advertiser answers in Messages.
window.AdChat = (function () {
  const COLUMNS = 'id, sender_id, receiver_id, message, created_at';

  let panel = null;
  let timer = 0;
  let busy = false;
  let locked = false;
  let lockCheckedAt = 0;

  function close() {
    if (timer) clearInterval(timer);
    timer = 0;
    if (panel) panel.remove();
    panel = null;
    document.body.classList.remove('ad-chat-open');
  }

  function shell(title, bodyHtml) {
    close();
    panel = document.createElement('div');
    panel.className = 'ad-chat';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Message the advertiser');
    panel.innerHTML = `
      <div class="ad-chat-panel">
        <header class="ad-chat-head">
          <div class="ad-chat-title">Message <span>${fbEscape(title)}</span></div>
          <button class="ad-chat-close" type="button" aria-label="Close">✕</button>
        </header>
        ${bodyHtml}
      </div>`;
    document.body.appendChild(panel);
    document.body.classList.add('ad-chat-open');
    panel.querySelector('.ad-chat-close').addEventListener('click', close);
    panel.addEventListener('click', event => { if (event.target === panel) close(); });
    document.addEventListener('keydown', function onKey(event) {
      if (!panel || !document.body.contains(panel)) {
        document.removeEventListener('keydown', onKey);
        return;
      }
      if (event.key === 'Escape') {
        document.removeEventListener('keydown', onKey);
        close();
      }
    });
    return panel;
  }

  // A signed-in member messages the advertiser through the Messages widget
  function openMemberChat(ownerId) {
    const widget = window.fbChat || window.ChatWidget;
    if (widget && widget.openWith) {
      widget.openWith(ownerId);
      return;
    }
    // The shared profile page has no chat widget: open the app, then try again
    location.hash = '#/App';
    let tries = 0;
    const wait = setInterval(() => {
      const next = window.fbChat || window.ChatWidget;
      tries += 1;
      if (next && next.openWith) {
        clearInterval(wait);
        next.openWith(ownerId);
      } else if (tries > 40) {
        clearInterval(wait);
      }
    }, 100);
  }

  // A visitor without an account picks the name the advertiser will see
  function askName(ownerId, ownerName) {
    const G = window.GroupChat;
    const box = shell(ownerName, `
      <div class="ad-chat-name">
        <p class="ad-chat-hint">You can message without an account. What name should ${fbEscape(ownerName)} see?</p>
        <input class="ad-chat-name-input" type="text" maxlength="24" placeholder="Your name" aria-label="Your name">
        <button class="fb-btn fb-btn-primary ad-chat-name-go" type="button">Start chatting</button>
      </div>`);
    const input = box.querySelector('.ad-chat-name-input');
    input.focus();
    box.querySelector('.ad-chat-name-go').addEventListener('click', () => {
      try {
        const guest = G.saveGuest(input.value);
        guestChat(ownerId, ownerName, guest);
      } catch (error) {
        showToast(error.message, 'error', 5000);
      }
    });
    input.addEventListener('keypress', event => {
      if (event.key === 'Enter') box.querySelector('.ad-chat-name-go').click();
    });
  }

  // Guests reply in text only, like in the guest group chat
  function guestChat(ownerId, ownerName, guest) {
    const G = window.GroupChat;
    const box = shell(ownerName, `
      <div class="ad-chat-body"></div>
      <div class="ad-chat-meta">Guest chat · you are ${fbEscape(guest.name)}</div>
      <div class="ad-chat-input-row">
        <input type="text" class="ad-chat-input" placeholder="Type a message..." aria-label="Your message">
        <button class="ad-chat-send" type="button" aria-label="Send">➤</button>
      </div>`);
    const body = box.querySelector('.ad-chat-body');
    const input = box.querySelector('.ad-chat-input');
    const sendBtn = box.querySelector('.ad-chat-send');
    let messages = [];
    let lastAt = '';

    function render() {
      if (!messages.length) {
        body.innerHTML = '<div class="chat-empty">No messages yet. Say hi! 👋</div>';
        return;
      }
      const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 90;
      body.innerHTML = messages.map(message => {
        const mine = String(message.sender_id) === String(guest.id);
        return `<div class="chat-bubble ${mine ? 'chat-bubble-me' : 'chat-bubble-them'}">
          <div class="chat-bubble-text">${fbEscape(message.message)}</div>
          <div class="chat-bubble-time">${G.formatTime(message.created_at)}</div>
        </div>`;
      }).join('');
      if (atBottom) body.scrollTop = body.scrollHeight;
    }

    // The thread is read in both directions without a combined filter, so a
    // guest name with brackets or commas cannot break the query
    async function loadMessages(force) {
      if (!panel || !document.body.contains(body)) {
        close();
        return;
      }
      if (document.hidden) return;
      try {
        const [mine, theirs] = await Promise.all([
          sb.from('chat_messages').select(COLUMNS).eq('sender_id', guest.id).eq('receiver_id', ownerId)
            .order('created_at', { ascending: true }),
          sb.from('chat_messages').select(COLUMNS).eq('sender_id', ownerId).eq('receiver_id', guest.id)
            .order('created_at', { ascending: true })
        ]);
        if (mine.error) throw mine.error;
        if (theirs.error) throw theirs.error;
        const rows = (mine.data || []).concat(theirs.data || [])
          .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        const newest = rows[rows.length - 1];
        if (!force && newest && newest.created_at === lastAt) return;
        messages = rows;
        if (newest && newest.created_at) lastAt = newest.created_at;
        render();
      } catch (error) {
        body.innerHTML = '<div class="chat-empty">Chat is not set up yet. Run the SQL migration in Supabase.</div>';
      }
    }

    async function send() {
      const text = input.value.trim();
      if (!text || busy) return;
      if (locked) {
        showToast('An admin turned off sending for guests', '', 5000);
        return;
      }
      if (G.hasLink(text)) {
        showToast('Guests can only send text — log in to share links', '', 6000);
        return;
      }
      busy = true;
      input.value = '';
      const temp = { id: 'temp-' + Date.now(), sender_id: guest.id, receiver_id: ownerId, message: text, created_at: new Date().toISOString() };
      messages.push(temp);
      render();
      try {
        const { error } = await sb.from('chat_messages').insert([{ sender_id: guest.id, receiver_id: ownerId, message: text }]);
        if (error) throw error;
        await loadMessages(true);
      } catch (error) {
        messages = messages.filter(message => message !== temp);
        render();
        showToast('Failed to send message', 'error', 6000);
      } finally {
        busy = false;
      }
    }

    sendBtn.addEventListener('click', send);
    input.addEventListener('keypress', event => { if (event.key === 'Enter') send(); });

    // An admin can turn guest sending off for every guest device
    async function refreshLock() {
      if (Date.now() - lockCheckedAt < 30000) return;
      try {
        locked = !(await G.guestCanSend());
        lockCheckedAt = Date.now();
      } catch (error) {
        locked = false;
      }
    }

    refreshLock();
    loadMessages(true);
    timer = setInterval(() => loadMessages(false), 3000);
    input.focus();
  }

  // Auth is a top-level const in auth.js, so it is not a window property
  function signedInMember() {
    const auth = window.Auth || (typeof Auth === 'undefined' ? null : Auth);
    return auth && auth.isLoggedIn() ? auth.currentUser : null;
  }

  // ownerId is the member who placed the ad; ownerName is what they are called
  function open(ownerId, ownerName) {
    if (!ownerId || !sb) return;
    const name = String(ownerName || 'the advertiser');
    // A member with an account messages as themselves, so the advertiser gets
    // the thread in their own Messages list and can answer it there
    if (signedInMember()) {
      openMemberChat(ownerId);
      return;
    }
    const G = window.GroupChat;
    if (!G) {
      showToast('Chat is not available right now', 'error', 5000);
      return;
    }
    const guest = G.storedGuest();
    if (guest) guestChat(ownerId, name, guest);
    else askName(ownerId, name);
  }

  return { open };
})();
