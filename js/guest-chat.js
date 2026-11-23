// Guest chat: someone who opened an invite link without a MeDay account joins
// the group, sees the links, photos, videos and files shared there and replies
// in text. The text chat between members stays private.
window.GuestChat = (function () {
  const MESSAGE_COLUMNS = 'id, group_id, sender_id, message, attachment_url, attachment_type, attachment_name, created_at';

  function open(el, group, guest) {
    const G = window.GroupChat;
    if (!G) return;

    let messages = [];
    let lastAt = '';
    let people = new Map();
    let pollTimer = null;
    let busy = false;
    let firstRender = true;

    el.innerHTML = `<div class="fb-feed"><section class="fb-card guest-chat-card">
      <div class="chat-group-head">
        <div class="chat-group-title">
          <div class="chat-group-name">${fbEscape(group.name)}</div>
          <div class="chat-group-meta" data-guest-meta>Guest chat · you are ${fbEscape(guest.name)}</div>
        </div>
      </div>
      <div class="chat-group-invite">
        <div class="chat-group-invite-copy">
          <span class="chat-group-invite-label">Invite link</span>
          <input class="chat-group-invite-input" data-guest-invite readonly aria-label="Group invite link">
        </div>
        <div class="chat-group-invite-actions">
          <button class="chat-invite-btn" type="button" data-guest-copy>Copy</button>
          <button class="chat-invite-btn" type="button" data-guest-share>Share</button>
        </div>
      </div>
      <p class="guest-chat-note">You are a guest here. You see the links, photos, videos and files shared in this group and can reply in text — the rest of the chat stays private.
        <a href="#/Login" data-guest-account>Log in</a> to join the full chat.</p>
      <div class="chat-messages chat-group-messages" data-guest-messages></div>
      <div class="chat-upload" data-guest-upload hidden>
        <span class="chat-upload-text" data-guest-upload-text>Uploading…</span>
        <div class="chat-upload-bar"><div class="chat-upload-fill" data-guest-upload-fill></div></div>
      </div>
      <div class="chat-input-row chat-group-input-row">
        <button class="chat-attach-btn" type="button" data-guest-attach title="Send a photo, video or file" aria-label="Send a photo, video or file">📎</button>
        <input type="text" data-guest-input placeholder="Reply to the group..." aria-label="Reply to the group">
        <button class="chat-send-btn" type="button" data-guest-send aria-label="Send">➤</button>
      </div>
    </section></div>`;

    const messagesEl = el.querySelector('[data-guest-messages]');
    const input = el.querySelector('[data-guest-input]');
    const sendBtn = el.querySelector('[data-guest-send]');
    const attachBtn = el.querySelector('[data-guest-attach]');
    const inviteInput = el.querySelector('[data-guest-invite]');
    const uploadEl = el.querySelector('[data-guest-upload]');
    const uploadText = el.querySelector('[data-guest-upload-text]');
    const uploadFill = el.querySelector('[data-guest-upload-fill]');
    const metaEl = el.querySelector('[data-guest-meta]');

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z';
    fileInput.hidden = true;
    el.appendChild(fileInput);

    inviteInput.value = G.inviteLink(group.invite_code);
    inviteInput.addEventListener('click', () => inviteInput.select());

    // Signing in from here lands back on this invite link and joins as a member
    const accountLink = el.querySelector('[data-guest-account]');
    if (accountLink) {
      accountLink.addEventListener('click', () => {
        try { localStorage.setItem('meday.pendingInvite', group.invite_code); } catch (e) { /* storage blocked */ }
      });
    }

    function showUpload(label, fraction) {
      uploadEl.hidden = false;
      const percent = Math.round((fraction || 0) * 100);
      uploadText.textContent = percent > 0 ? `${label} ${percent}%` : label;
      uploadFill.style.width = percent + '%';
    }

    function hideUpload() {
      uploadEl.hidden = true;
      uploadFill.style.width = '0%';
    }

    async function copyInvite() {
      const link = inviteInput.value;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(link);
          showToast('Invite link copied', 'success');
          return;
        }
      } catch (e) { /* clipboard blocked: select the link instead */ }
      inviteInput.focus();
      inviteInput.select();
      try {
        document.execCommand('copy');
        showToast('Invite link copied', 'success');
      } catch (e) {
        showToast('Press Ctrl+C to copy the invite link', '', 5000);
      }
    }

    async function shareInvite() {
      const link = inviteInput.value;
      if (navigator.share) {
        try {
          await navigator.share({ title: group.name, text: 'Join our group chat', url: link });
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') return;
        }
      }
      copyInvite();
    }

    el.querySelector('[data-guest-copy]').addEventListener('click', copyInvite);
    el.querySelector('[data-guest-share]').addEventListener('click', shareInvite);

    // A guest sees the shared links and media, and the replies guests write
    function visible(message) {
      return G.isShared(message) || G.isGuest(message.sender_id);
    }

    function nameOfSender(id) {
      const person = people.get(String(id));
      if (person) return (person.full_name || person.username || 'Member') + (person.guest ? ' (guest)' : '');
      return G.isGuest(id) ? G.guestName(id) + ' (guest)' : 'Member';
    }

    async function loadPeople() {
      try {
        const list = await G.members(group.id);
        people = new Map(list.map(person => [String(person.id), person]));
        const guests = list.filter(person => person.guest).length;
        metaEl.textContent = `Guest chat · you are ${guest.name} · ${list.length} member${list.length === 1 ? '' : 's'}${guests ? ` (${guests} guest${guests === 1 ? '' : 's'})` : ''}`;
      } catch (e) {
        metaEl.textContent = `Guest chat · you are ${guest.name}`;
      }
    }

    function renderMessages() {
      const shown = messages.filter(visible);
      if (!shown.length) {
        messagesEl.innerHTML = '<div class="chat-empty">Nothing shared yet. Send the first photo, video, file or link.</div>';
        return;
      }
      const atBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 90;
      messagesEl.innerHTML = shown.map(message => {
        const mine = String(message.sender_id) === String(guest.id);
        return `<div class="chat-bubble chat-group-bubble ${mine ? 'chat-bubble-me' : 'chat-bubble-them'}">
          ${mine ? '' : `<div class="chat-bubble-sender">${fbEscape(nameOfSender(message.sender_id))}</div>`}
          ${message.message ? `<div class="chat-bubble-text">${G.linkify(message.message)}</div>` : ''}
          ${G.attachmentHTML(message)}
          <div class="chat-bubble-time">${G.formatTime(message.created_at)}</div>
        </div>`;
      }).join('');
      if (atBottom || firstRender) messagesEl.scrollTop = messagesEl.scrollHeight;
      firstRender = false;
    }

    async function loadMessages(force) {
      if (!document.body.contains(messagesEl)) {
        stop();
        return;
      }
      if (document.hidden) return;
      try {
        let query = sb.from('chat_group_messages').select(MESSAGE_COLUMNS)
          .eq('group_id', group.id)
          .order('created_at', { ascending: true });
        if (!force && lastAt) query = query.gt('created_at', lastAt);
        const { data, error } = await query;
        if (error) throw error;
        if (force) {
          messages = data || [];
        } else {
          if (!data || !data.length) return;
          const known = new Set(messages.map(m => String(m.id)));
          data.forEach(message => {
            if (!known.has(String(message.id))) messages.push(message);
          });
          messages.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        }
        const newest = messages[messages.length - 1];
        if (newest && newest.created_at) lastAt = newest.created_at;
        if (messages.some(message => !people.has(String(message.sender_id)))) await loadPeople();
        renderMessages();
      } catch (error) {
        messagesEl.innerHTML = `<div class="chat-empty">${fbEscape(G.groupError(error).message)}</div>`;
      }
    }

    async function sendText() {
      const text = input.value.trim();
      if (!text || busy) return;
      input.value = '';
      // The reply shows the moment it is sent, before the save comes back
      const temp = {
        id: 'temp-' + Date.now(),
        group_id: group.id,
        sender_id: guest.id,
        message: text,
        created_at: new Date().toISOString()
      };
      messages.push(temp);
      renderMessages();
      try {
        const { error } = await sb.from('chat_group_messages').insert([{
          group_id: group.id,
          sender_id: guest.id,
          message: text
        }]);
        if (error) throw error;
        await loadMessages(true);
      } catch (error) {
        messages = messages.filter(message => message !== temp);
        renderMessages();
        showToast(G.groupError(error).message, 'error', 6000);
      }
    }

    async function sendAttachment(file) {
      if (!file || busy) return;
      const kind = G.kindOf(file);
      busy = true;
      sendBtn.disabled = true;
      const label = kind === 'image' ? 'Uploading photo…' : kind === 'video' ? 'Uploading video…' : 'Uploading file…';
      showUpload(label, 0);
      try {
        const sent = await G.postAttachment(group.id, guest.id, file, fraction => showUpload(label, fraction));
        if (sent) await loadMessages(true);
      } catch (error) {
        showToast(`Could not send that ${kind === 'file' ? 'file' : kind}: ${G.groupError(error).message}`, 'error', 7000);
      } finally {
        busy = false;
        sendBtn.disabled = false;
        hideUpload();
        fileInput.value = '';
      }
    }

    sendBtn.addEventListener('click', sendText);
    input.addEventListener('keypress', event => { if (event.key === 'Enter') sendText(); });
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const picked = fileInput.files && fileInput.files[0];
      if (picked) sendAttachment(picked);
    });

    function stop() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    loadPeople();
    loadMessages(true);
    pollTimer = setInterval(() => loadMessages(false), 3000);

    return { stop };
  }

  return { open };
})();
