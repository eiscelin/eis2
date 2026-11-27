// Group chats for friends: create a group, invite people with a link, and send
// text, photos, videos and files in one thread.
window.GroupChat = (function () {
  const MAX_IMAGE = 20 * 1024 * 1024;
  const MAX_VIDEO = 100 * 1024 * 1024;
  const MAX_FILE = 25 * 1024 * 1024;
  // Star so a database that has not run the reply/pin migration yet still loads
  const MESSAGE_COLUMNS = '*';

  const asId = value => String(value == null ? '' : value);
  const nameOf = person => (person && (person.full_name || person.username)) || 'Member';

  function inviteLink(code) {
    return location.origin + location.pathname + '#/Join/' + encodeURIComponent(code || '');
  }

  function randomCode(length) {
    const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
    const bytes = new Uint8Array(length);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    let code = '';
    for (let i = 0; i < bytes.length; i++) code += alphabet[bytes[i] % alphabet.length];
    return code;
  }

  function newInviteCode() { return randomCode(10); }

  // A guest opened the invite link without a MeDay account. Their identity lives
  // in this browser and their chosen name travels inside their id — the id reads
  // "guest:<name>:<random>" — so the group can show who replied without an account.
  const GUEST_PREFIX = 'guest:';
  const GUEST_KEY = 'meday.guest';

  function isGuest(id) { return String(id == null ? '' : id).indexOf(GUEST_PREFIX) === 0; }

  function guestName(id) {
    const raw = String(id == null ? '' : id);
    if (!isGuest(raw)) return '';
    try {
      return decodeURIComponent(raw.slice(GUEST_PREFIX.length).split(':')[0]) || 'Guest';
    } catch (e) {
      return 'Guest';
    }
  }

  function storedGuest() {
    try {
      const saved = JSON.parse(localStorage.getItem(GUEST_KEY) || 'null');
      return saved && saved.id && saved.name ? saved : null;
    } catch (e) {
      return null;
    }
  }

  // The name a guest typed, kept in this browser so the next invite link remembers it
  function saveGuest(name) {
    const clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 24);
    if (!clean) throw new Error('Type a name so the group knows who you are');
    const saved = storedGuest();
    const guest = saved && guestName(saved.id) === clean
      ? saved
      : { id: GUEST_PREFIX + encodeURIComponent(clean) + ':' + randomCode(6), name: clean };
    try { localStorage.setItem(GUEST_KEY, JSON.stringify(guest)); } catch (e) { /* storage blocked */ }
    return guest;
  }

  // Links and media are what a guest may see; the rest of the chat stays private
  function hasLink(text) {
    return /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/.test(String(text || ''));
  }

  function isShared(message) {
    if (!message) return false;
    return !!message.attachment_url || hasLink(message.message);
  }

  function groupError(error) {
    const message = String((error && error.message) || error || 'Something went wrong');
    const code = String((error && error.code) || '');
    // A missing reply/pin/admin column means this update's SQL has not been run yet
    const missingColumn = /(reply_to_id|pinned_message_id|is_admin)/.test(message) &&
      /does not exist|schema cache|column/i.test(message);
    if (missingColumn) {
      return new Error('Replies, @everyone and pins need the latest update. Run supabase/migrations/025_add_group_replies_pins_admins.sql in Supabase.');
    }
    // Only a genuinely missing table points at the migration; any other failure
    // (a permission, a stale page, a bad link) shows what actually went wrong
    const missingTable = code === '42P01' || code === 'PGRST205' ||
      (/chat_group/.test(message) && /does not exist|schema cache/i.test(message));
    if (missingTable) {
      return new Error('Group chats are not set up yet. Run supabase/migrations/023_create_chat_groups.sql in Supabase.');
    }
    return new Error(message);
  }

  function previewOf(row) {
    if (!row) return '';
    if (row.message) return row.message;
    if (row.attachment_type === 'video') return '🎬 Video';
    if (row.attachment_type === 'file') return '📎 File';
    if (row.attachment_type === 'image') return '📷 Photo';
    return '';
  }

  // Groups the member belongs to, newest activity first
  async function myGroups(userId) {
    const id = asId(userId);
    if (!sb || !id) return [];
    const { data: mine, error } = await sb.from('chat_group_members').select('group_id').eq('user_id', id);
    if (error) throw groupError(error);
    const ids = [...new Set((mine || []).map(row => asId(row.group_id)).filter(Boolean))];
    if (!ids.length) return [];

    const [groupsRes, lastRes, membersRes] = await Promise.all([
      sb.from('chat_groups').select('*').in('id', ids),
      sb.from('chat_group_messages').select('group_id, message, attachment_type, created_at')
        .in('group_id', ids).order('created_at', { ascending: false }).limit(300),
      sb.from('chat_group_members').select('group_id').in('group_id', ids)
    ]);
    if (groupsRes.error) throw groupError(groupsRes.error);

    const last = new Map();
    (lastRes.data || []).forEach(row => {
      const key = asId(row.group_id);
      if (!last.has(key)) last.set(key, row);
    });
    const counts = new Map();
    (membersRes.data || []).forEach(row => {
      const key = asId(row.group_id);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return (groupsRes.data || []).map(group => {
      const latest = last.get(asId(group.id));
      return {
        ...group,
        member_count: counts.get(asId(group.id)) || 1,
        last_message: previewOf(latest),
        last_at: latest ? latest.created_at : group.created_at
      };
    }).sort((a, b) => new Date(b.last_at || 0) - new Date(a.last_at || 0));
  }

  async function create(user, name, memberIds) {
    if (!sb || !user) throw new Error('Log in to create a group');
    const groupName = String(name || '').trim();
    if (!groupName) throw new Error('Give the group a name');
    if (window.ReadOnlyMode && ReadOnlyMode.block('Creating groups')) return null;

    const { data: group, error } = await sb.from('chat_groups')
      .insert([{ name: groupName, created_by: asId(user.id), invite_code: newInviteCode() }])
      .select()
      .single();
    if (error) throw groupError(error);

    const ids = [...new Set([asId(user.id), ...(memberIds || []).map(asId)])].filter(Boolean);
    let { error: memberError } = await sb.from('chat_group_members')
      .upsert(ids.map(uid => ({
        group_id: group.id,
        user_id: uid,
        is_admin: uid === asId(user.id)
      })), { onConflict: 'group_id,user_id' });
    // A database that has not run the admin migration yet still gets its members
    if (memberError && /is_admin/.test(String(memberError.message || ''))) {
      ({ error: memberError } = await sb.from('chat_group_members')
        .upsert(ids.map(uid => ({ group_id: group.id, user_id: uid })), { onConflict: 'group_id,user_id' }));
    }
    if (memberError) throw groupError(memberError);
    return group;
  }

  async function join(code, user) {
    if (!sb || !user) throw new Error('Log in to join this group');
    const invite = String(code || '').trim();
    if (!invite) throw new Error('This invite link is incomplete');
    const { data: group, error } = await sb.from('chat_groups')
      .select('*')
      .eq('invite_code', invite)
      .maybeSingle();
    if (error) throw groupError(error);
    if (!group) throw new Error('This invite link is no longer valid');
    const { error: joinError } = await sb.from('chat_group_members')
      .upsert([{ group_id: group.id, user_id: asId(user.id) }], { onConflict: 'group_id,user_id' });
    if (joinError) throw groupError(joinError);
    return group;
  }

  async function members(groupId) {
    if (!sb) return [];
    let { data: rows, error } = await sb.from('chat_group_members')
      .select('user_id, is_admin')
      .eq('group_id', groupId);
    // Older databases have no admin column yet
    if (error && /is_admin/.test(String(error.message || ''))) {
      ({ data: rows, error } = await sb.from('chat_group_members')
        .select('user_id')
        .eq('group_id', groupId));
    }
    if (error) throw groupError(error);
    const flags = new Map();
    (rows || []).forEach(row => flags.set(asId(row.user_id), !!row.is_admin));
    const all = (rows || []).map(row => asId(row.user_id)).filter(Boolean);
    const guests = [...new Set(all.filter(isGuest))]
      .map(id => ({ id, full_name: guestName(id), guest: true, is_admin: flags.get(id) || false }));
    const ids = [...new Set(all.filter(id => !isGuest(id)))];
    if (!ids.length) return guests;
    const { data } = await sb.from('users')
      .select('id, username, full_name, avatar_url, role')
      .in('id', ids);
    return (data || [])
      .filter(person => person.role !== 'admin')
      .map(person => ({ ...person, is_admin: flags.get(asId(person.id)) || false }))
      .concat(guests);
  }

  // An admin can turn sending off for every guest device
  async function guestCanSend() {
    if (!sb) return true;
    const { data } = await sb.from('app_settings')
      .select('value')
      .eq('key', 'guest_chat_send')
      .maybeSingle();
    return !data || data.value !== 'false';
  }

  // Anyone holding the invite link can step into the group as a guest
  async function joinAsGuest(code, name) {
    if (!sb) throw new Error('Database not configured');
    const invite = String(code || '').trim();
    if (!invite) throw new Error('This invite link is incomplete');
    const { data: group, error } = await sb.from('chat_groups')
      .select('*')
      .eq('invite_code', invite)
      .maybeSingle();
    if (error) throw groupError(error);
    if (!group) throw new Error('This invite link is no longer valid');
    const guest = saveGuest(name);
    // A returning guest is already a member: the table takes new rows only, so
    // an existing membership is left alone instead of being written again
    const { data: member, error: memberError } = await sb.from('chat_group_members')
      .select('id')
      .eq('group_id', group.id)
      .eq('user_id', guest.id)
      .maybeSingle();
    if (memberError) throw groupError(memberError);
    if (!member) {
      const { error: joinError } = await sb.from('chat_group_members')
        .insert([{ group_id: group.id, user_id: guest.id }]);
      if (joinError) throw groupError(joinError);
    }
    return { group, guest };
  }

  // Links inside a message are clickable, everything else stays plain text
  function linkify(text) {
    const source = String(text || '');
    const pattern = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/g;
    let out = '';
    let last = 0;
    let match;
    while ((match = pattern.exec(source))) {
      out += fbEscape(source.slice(last, match.index));
      let url = match[0];
      let trail = '';
      while (/[.,!?;:)\]]$/.test(url)) {
        trail = url.slice(-1) + trail;
        url = url.slice(0, -1);
      }
      const href = url.indexOf('www.') === 0 ? 'https://' + url : url;
      out += `<a class="chat-link" href="${fbEscape(href)}" target="_blank" rel="noopener noreferrer">${fbEscape(url)}</a>${fbEscape(trail)}`;
      last = match.index + match[0].length;
    }
    return out + fbEscape(source.slice(last));
  }

  function attachmentHTML(message) {
    const url = String(message.attachment_url || '');
    if (!url) return '';
    const safe = fbEscape(url);
    const name = message.attachment_name || (message.attachment_type === 'file' ? 'File' : 'Attachment');
    if (message.attachment_type === 'image') {
      return `<a class="chat-attachment" href="${safe}" target="_blank" rel="noopener noreferrer">
        <img class="chat-attachment-img" src="${safe}" alt="${fbEscape(name)}" loading="lazy" decoding="async">
      </a>`;
    }
    if (message.attachment_type === 'video') {
      return `<video class="chat-attachment-video" src="${safe}" controls playsinline preload="metadata"></video>`;
    }
    return `<a class="chat-attachment-file" href="${safe}" target="_blank" rel="noopener noreferrer" download="${fbEscape(name)}">
      <span class="chat-attachment-ico" aria-hidden="true">📄</span>
      <span class="chat-attachment-name">${fbEscape(name)}</span>
    </a>`;
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // The name shown above a bubble; guests are marked so members know
  function senderLabel(id, senderNames) {
    const sender = senderNames && senderNames.get(id);
    if (sender) return nameOf(sender) + (sender.guest ? ' (guest)' : '');
    return isGuest(id) ? guestName(id) + ' (guest)' : 'Member';
  }

  function kindOf(file) {
    const type = String((file && file.type) || '');
    if (type.indexOf('image/') === 0) return 'image';
    if (type.indexOf('video/') === 0) return 'video';
    return 'file';
  }

  // Uploads one picked file and posts it into the group thread. A file that is
  // too big says so and returns null; an upload or save failure throws.
  async function postAttachment(groupId, senderId, file, onProgress) {
    const kind = kindOf(file);
    const limit = kind === 'image' ? MAX_IMAGE : kind === 'video' ? MAX_VIDEO : MAX_FILE;
    const what = kind === 'image' ? 'Photo' : kind === 'video' ? 'Video' : 'File';
    if (file.size > limit) {
      showToast(`${what} must be ${Math.round(limit / (1024 * 1024))} MB or smaller`, 'error', 5000);
      return null;
    }
    let payload = file;
    if (kind === 'image' && typeof shrinkImage === 'function') {
      payload = await shrinkImage(file, 1600).catch(() => file);
    }
    let url = '';
    if (kind === 'file' && typeof cloudinaryUploadFile === 'function') {
      url = await cloudinaryUploadFile(payload, onProgress);
    } else {
      url = await cloudinaryUpload(payload, onProgress);
    }
    if (!url) throw new Error('File hosting is not connected');
    const { error } = await sb.from('chat_group_messages').insert([{
      group_id: groupId,
      sender_id: asId(senderId),
      message: null,
      attachment_url: url,
      attachment_type: kind,
      attachment_name: (file && file.name) || ''
    }]);
    if (error) throw groupError(error);
    return kind;
  }

  // ---------- The group conversation ----------

  function open(container, group, user, onBack) {
    let messages = [];
    let lastAt = '';
    let senderNames = new Map();
    let pollTimer = null;
    let busy = false;
    let destroyed = false;
    let firstRender = true;
    let replyTo = null;
    let isAdmin = false;

    container.innerHTML = `
      <div class="chat-group-head">
        <button class="chat-back" type="button" data-group-back>← Back</button>
        <div class="chat-group-title">
          <div class="chat-group-name">${fbEscape(group.name)}</div>
          <button class="chat-group-meta chat-group-meta-btn" type="button" data-group-meta title="View members and admins">Loading members…</button>
        </div>
      </div>
      <div class="chat-group-invite">
        <div class="chat-group-invite-copy">
          <span class="chat-group-invite-label">Invite link</span>
          <input class="chat-group-invite-input" data-invite readonly aria-label="Group invite link">
        </div>
        <div class="chat-group-invite-actions">
          <button class="chat-invite-btn" type="button" data-invite-copy>Copy</button>
          <button class="chat-invite-btn" type="button" data-invite-share>Share</button>
        </div>
      </div>
      <div class="chat-pinned" data-pinned hidden>
        <span class="chat-pinned-ico" aria-hidden="true">📌</span>
        <div class="chat-pinned-body">
          <span class="chat-pinned-label">Pinned message</span>
          <span class="chat-pinned-text" data-pinned-text></span>
        </div>
        <button class="chat-pinned-close" type="button" data-unpin title="Unpin message" aria-label="Unpin message">✕</button>
      </div>
      <div class="chat-messages chat-group-messages" data-group-messages></div>
      <div class="chat-upload" data-group-upload hidden>
        <span class="chat-upload-text" data-upload-text>Uploading…</span>
        <div class="chat-upload-bar"><div class="chat-upload-fill" data-upload-fill></div></div>
      </div>
      <div class="chat-reply-preview" data-reply-preview hidden>
        <div class="chat-reply-preview-body">
          <span class="chat-reply-preview-name" data-reply-name></span>
          <span class="chat-reply-preview-text" data-reply-text></span>
        </div>
        <button class="chat-reply-cancel" type="button" data-reply-cancel title="Cancel reply" aria-label="Cancel reply">✕</button>
      </div>
      <div class="chat-input-row chat-group-input-row">
        <button class="chat-attach-btn" type="button" data-group-attach title="Send a photo, video or file" aria-label="Send a photo, video or file">📎</button>
        <input type="text" data-group-input placeholder="Message the group..." aria-label="Message the group">
        <button class="chat-send-btn" type="button" data-group-send aria-label="Send">➤</button>
      </div>`;

    const messagesEl = container.querySelector('[data-group-messages]');
    const input = container.querySelector('[data-group-input]');
    const sendBtn = container.querySelector('[data-group-send]');
    const attachBtn = container.querySelector('[data-group-attach]');
    const inviteInput = container.querySelector('[data-invite]');
    const uploadEl = container.querySelector('[data-group-upload]');
    const uploadText = container.querySelector('[data-upload-text]');
    const uploadFill = container.querySelector('[data-upload-fill]');
    const metaEl = container.querySelector('[data-group-meta]');
    const pinnedEl = container.querySelector('[data-pinned]');
    const pinnedText = container.querySelector('[data-pinned-text]');
    const unpinBtn = container.querySelector('[data-unpin]');
    const replyPreview = container.querySelector('[data-reply-preview]');
    const replyName = container.querySelector('[data-reply-name]');
    const replyText = container.querySelector('[data-reply-text]');

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z';
    fileInput.hidden = true;
    container.appendChild(fileInput);

    inviteInput.value = inviteLink(group.invite_code);
    // A click selects the whole link, so it can be copied with Ctrl/Cmd+C
    inviteInput.addEventListener('click', () => inviteInput.select());

    container.querySelector('[data-group-back]').addEventListener('click', () => {
      if (onBack) onBack();
    });

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

    container.querySelector('[data-invite-copy]').addEventListener('click', copyInvite);
    container.querySelector('[data-invite-share]').addEventListener('click', shareInvite);

    async function loadSenders() {
      const wanted = [...new Set(messages.map(m => asId(m.sender_id)).filter(id => id && !senderNames.has(id)))];
      if (!wanted.length) return;
      // Guests have no account row — their name is read straight from their id
      wanted.filter(isGuest).forEach(id => senderNames.set(id, { id, full_name: guestName(id), guest: true }));
      const ids = wanted.filter(id => !isGuest(id));
      if (!ids.length || !sb) return;
      const { data } = await sb.from('users').select('id, username, full_name, avatar_url').in('id', ids);
      (data || []).forEach(person => senderNames.set(asId(person.id), person));
    }

    function mentionsEveryone(message) {
      return /(^|\s)@everyone\b/i.test(String((message && message.message) || ''));
    }

    function replyQuoteHTML(message, byId) {
      if (!message.reply_to_id) return '';
      const parent = byId.get(asId(message.reply_to_id));
      const name = parent ? senderLabel(asId(parent.sender_id), senderNames) : 'Earlier message';
      const text = parent ? previewOf(parent) : 'Not in this thread';
      return `<div class="chat-reply-quote" data-jump="${fbEscape(message.reply_to_id)}">
        <span class="chat-reply-quote-name">${fbEscape(name)}</span>
        <span class="chat-reply-quote-text">${fbEscape(text)}</span>
      </div>`;
    }

    function paintPinned() {
      const id = asId(group.pinned_message_id);
      const message = id ? messages.find(item => asId(item.id) === id) : null;
      pinnedEl.hidden = !message;
      unpinBtn.hidden = !isAdmin || !message;
      if (!message) return;
      pinnedText.textContent = senderLabel(asId(message.sender_id), senderNames) + ': ' + previewOf(message);
    }

    function renderMessages() {
      if (!messages.length) {
        messagesEl.innerHTML = '<div class="chat-empty">No messages yet. Say hi to the group! 👋</div>';
        paintPinned();
        return;
      }
      const atBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 90;
      const byId = new Map(messages.map(item => [asId(item.id), item]));
      const pinnedId = asId(group.pinned_message_id);
      messagesEl.innerHTML = messages.map(message => {
        const mine = asId(message.sender_id) === asId(user.id);
        const name = senderLabel(asId(message.sender_id), senderNames);
        const shout = mentionsEveryone(message);
        const isPinned = pinnedId && pinnedId === asId(message.id);
        return `<div class="chat-bubble chat-group-bubble ${mine ? 'chat-bubble-me' : 'chat-bubble-them'}${shout ? ' chat-bubble-everyone' : ''}" data-message="${fbEscape(message.id)}">
          ${mine ? '' : `<div class="chat-bubble-sender">${fbEscape(name)}</div>`}
          ${replyQuoteHTML(message, byId)}
          ${shout ? '<div class="chat-everyone">@everyone</div>' : ''}
          ${message.message ? `<div class="chat-bubble-text">${linkify(message.message)}</div>` : ''}
          ${attachmentHTML(message)}
          <div class="chat-bubble-time">${formatTime(message.created_at)}${isPinned ? ' · 📌' : ''}</div>
          <div class="chat-bubble-actions">
            <button class="chat-bubble-action" type="button" data-reply="${fbEscape(message.id)}" title="Reply to this message" aria-label="Reply to this message">↩</button>
            ${isAdmin ? `<button class="chat-bubble-action" type="button" data-pin="${fbEscape(message.id)}" title="${isPinned ? 'Unpin message' : 'Pin message'}" aria-label="${isPinned ? 'Unpin message' : 'Pin message'}">📌</button>` : ''}
          </div>
        </div>`;
      }).join('');
      if (atBottom || firstRender) messagesEl.scrollTop = messagesEl.scrollHeight;
      firstRender = false;
      paintPinned();
    }

    function startReply(message) {
      if (!message || String(message.id).indexOf('temp-') === 0) return;
      replyTo = message;
      replyPreview.hidden = false;
      replyName.textContent = senderLabel(asId(message.sender_id), senderNames);
      replyText.textContent = previewOf(message).slice(0, 120);
      input.focus();
    }

    function clearReply() {
      replyTo = null;
      replyPreview.hidden = true;
      replyName.textContent = '';
      replyText.textContent = '';
    }

    async function togglePin(id) {
      if (String(id).indexOf('temp-') === 0) return;
      if (!isAdmin) {
        showToast('Only group admins can pin messages', 'error');
        return;
      }
      const next = asId(group.pinned_message_id) === asId(id) ? null : id;
      const { error } = await sb.from('chat_groups').update({ pinned_message_id: next }).eq('id', group.id);
      if (error) {
        showToast(groupError(error).message, 'error', 6000);
        return;
      }
      group.pinned_message_id = next;
      renderMessages();
      showToast(next ? 'Message pinned' : 'Message unpinned', 'success');
    }

    messagesEl.addEventListener('click', event => {
      const replyBtn = event.target.closest('[data-reply]');
      if (replyBtn) {
        const found = messages.find(item => asId(item.id) === asId(replyBtn.getAttribute('data-reply')));
        if (found) startReply(found);
        return;
      }
      const pinBtn = event.target.closest('[data-pin]');
      if (pinBtn) {
        togglePin(pinBtn.getAttribute('data-pin'));
        return;
      }
      const quote = event.target.closest('[data-jump]');
      if (quote) {
        const target = messagesEl.querySelector(`[data-message="${asId(quote.getAttribute('data-jump'))}"]`);
        if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });

    container.querySelector('[data-reply-cancel]').addEventListener('click', clearReply);
    unpinBtn.addEventListener('click', () => {
      if (group.pinned_message_id) togglePin(group.pinned_message_id);
    });
    pinnedEl.addEventListener('click', event => {
      if (event.target.closest('[data-unpin]')) return;
      const target = messagesEl.querySelector(`[data-message="${asId(group.pinned_message_id)}"]`);
      if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });

    async function loadMessages(force) {
      if (destroyed || document.hidden) return;
      try {
        let query = sb.from('chat_group_messages').select(MESSAGE_COLUMNS)
          .eq('group_id', group.id)
          .order('created_at', { ascending: true });
        if (!force && lastAt) query = query.gt('created_at', lastAt);
        const { data, error } = await query;
        if (error) throw error;
        const fresh = [];
        if (force) {
          messages = data || [];
        } else {
          if (!data || !data.length) return;
          const known = new Set(messages.map(m => asId(m.id)));
          data.forEach(message => {
            if (!known.has(asId(message.id))) {
              messages.push(message);
              fresh.push(message);
            }
          });
          messages.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        }
        const newest = messages[messages.length - 1];
        if (newest && newest.created_at) lastAt = newest.created_at;
        await loadSenders();
        renderMessages();
        // An @everyone message pulls the whole group's attention
        const shout = fresh
          .filter(message => mentionsEveryone(message) && asId(message.sender_id) !== asId(user.id))
          .pop();
        if (shout) {
          showToast(senderLabel(asId(shout.sender_id), senderNames) + ' mentioned @everyone: ' + previewOf(shout).slice(0, 60), '', 8000);
        }
      } catch (error) {
        messagesEl.innerHTML = `<div class="chat-empty">${fbEscape(groupError(error).message)}</div>`;
      }
    }

    async function sendText() {
      const text = input.value.trim();
      if (!text || busy) return;
      if (window.ReadOnlyMode && ReadOnlyMode.block('Sending messages')) return;
      input.value = '';
      const payload = {
        group_id: group.id,
        sender_id: asId(user.id),
        message: text
      };
      if (replyTo) payload.reply_to_id = replyTo.id;
      const temp = {
        id: 'temp-' + Date.now(),
        group_id: group.id,
        sender_id: user.id,
        message: text,
        reply_to_id: payload.reply_to_id || null,
        created_at: new Date().toISOString()
      };
      messages.push(temp);
      clearReply();
      renderMessages();
      try {
        const { error } = await sb.from('chat_group_messages').insert([payload]);
        if (error) throw error;
        await loadMessages(true);
      } catch (error) {
        messages = messages.filter(message => message !== temp);
        renderMessages();
        showToast(groupError(error).message, 'error', 6000);
      }
    }

    async function sendAttachment(file) {
      if (!file || busy) return;
      const kind = kindOf(file);
      if (window.ReadOnlyMode && ReadOnlyMode.block('Sending attachments')) {
        fileInput.value = '';
        return;
      }
      busy = true;
      sendBtn.disabled = true;
      const label = kind === 'image' ? 'Uploading photo…' : kind === 'video' ? 'Uploading video…' : 'Uploading file…';
      showUpload(label, 0);
      try {
        const sent = await postAttachment(group.id, user.id, file, fraction => showUpload(label, fraction));
        if (sent) await loadMessages(true);
      } catch (error) {
        showToast(`Could not send that ${kind === 'file' ? 'file' : kind}: ${groupError(error).message}`, 'error', 7000);
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

    function paintMeta(list) {
      const count = list.length || group.member_count || 1;
      const admins = list.filter(person => person.is_admin).map(nameOf);
      const names = list.slice(0, 3).map(nameOf).join(', ');
      metaEl.textContent = `${count} member${count === 1 ? '' : 's'}` +
        (admins.length ? ' · admin: ' + admins.slice(0, 2).join(', ') : '') +
        (names ? ' · ' + names : '');
    }

    async function refreshMembers() {
      try {
        const list = await members(group.id);
        if (!destroyed) paintMeta(list);
        return list;
      } catch (e) {
        if (!destroyed) metaEl.textContent = `${group.member_count || 1} members`;
        return [];
      }
    }

    // The creator is the first admin, and admins can make other members admins
    function openMembers() {
      const overlay = document.createElement('div');
      overlay.className = 'chat-group-overlay';
      overlay.innerHTML = `<div class="chat-group-modal" role="dialog" aria-modal="true" aria-label="Group members">
        <div class="chat-group-modal-head">
          <h3>Members</h3>
          <button class="chat-group-close" type="button" data-close aria-label="Close">✕</button>
        </div>
        <p class="chat-members-hint">${isAdmin
          ? 'You are a group admin — you can pin messages and make other members admins.'
          : 'Group admins can pin messages and make other members admins.'}</p>
        <div class="chat-members-list" data-list><p class="chat-group-empty">Loading members…</p></div>
      </div>`;
      document.body.appendChild(overlay);
      const listEl = overlay.querySelector('[data-list]');

      overlay.addEventListener('click', event => {
        if (event.target === overlay || event.target.closest('[data-close]')) overlay.remove();
      });

      async function paint() {
        const list = await members(group.id).catch(() => []);
        listEl.innerHTML = list.map(person => {
          const admin = !!person.is_admin;
          const isMe = asId(person.id) === asId(user.id);
          const canToggle = isAdmin && !person.guest && !isMe;
          return `<div class="chat-member-row">
            <span class="chat-member-name">${fbEscape(nameOf(person))}${person.guest ? ' (guest)' : ''}${isMe ? ' (you)' : ''}</span>
            ${admin ? '<span class="chat-member-badge">Admin</span>' : ''}
            ${canToggle ? `<button class="chat-member-toggle" type="button" data-admin="${fbEscape(person.id)}" data-make="${admin ? 'false' : 'true'}">${admin ? 'Remove admin' : 'Make admin'}</button>` : ''}
          </div>`;
        }).join('') || '<p class="chat-group-empty">No members yet.</p>';
      }

      listEl.addEventListener('click', async event => {
        const btn = event.target.closest('[data-admin]');
        if (!btn) return;
        btn.disabled = true;
        const make = btn.getAttribute('data-make') === 'true';
        const { error } = await sb.from('chat_group_members')
          .update({ is_admin: make })
          .eq('group_id', group.id)
          .eq('user_id', btn.getAttribute('data-admin'));
        if (error) {
          showToast(groupError(error).message, 'error', 6000);
          btn.disabled = false;
          return;
        }
        showToast(make ? 'Member is now a group admin' : 'Admin removed', 'success');
        await paint();
        refreshMembers();
      });

      paint();
    }

    metaEl.addEventListener('click', openMembers);

    // The group row carries the pinned message; my membership row says if I am an admin
    async function loadGroupState() {
      try {
        const [groupRes, memberRes] = await Promise.all([
          sb.from('chat_groups').select('*').eq('id', group.id).maybeSingle(),
          sb.from('chat_group_members').select('user_id, is_admin').eq('group_id', group.id)
        ]);
        if (groupRes.data) {
          group.pinned_message_id = groupRes.data.pinned_message_id || null;
          group.created_by = group.created_by || groupRes.data.created_by;
        }
        const mine = (memberRes.data || []).find(row => asId(row.user_id) === asId(user.id));
        isAdmin = !!(mine && mine.is_admin) || asId(group.created_by) === asId(user.id);
      } catch (e) {
        isAdmin = asId(group.created_by) === asId(user.id);
      }
      if (destroyed) return;
      renderMessages();
    }

    refreshMembers();
    loadGroupState();
    loadMessages(true);
    pollTimer = setInterval(() => loadMessages(false), 3000);

    return {
      stop() {
        destroyed = true;
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      }
    };
  }

  // ---------- Creating a group ----------

  async function openCreate(user, onCreated) {
    let friends = [];
    try {
      if (window.Friends) {
        await Friends.load(user);
        const ids = Friends.friendIds();
        if (ids.length) {
          const { data } = await sb.from('users')
            .select('id, username, full_name, avatar_url, role')
            .in('id', ids);
          friends = (data || []).filter(person => person.role !== 'admin' && !person.deleted_at);
        }
      }
    } catch (e) {
      friends = [];
    }

    const overlay = document.createElement('div');
    overlay.className = 'chat-group-overlay';
    overlay.innerHTML = `<div class="chat-group-modal" role="dialog" aria-modal="true" aria-label="New group">
      <div class="chat-group-modal-head">
        <h3>New group</h3>
        <button class="chat-group-close" type="button" data-group-close aria-label="Close">✕</button>
      </div>
      <label class="chat-group-field">
        <span>Group name</span>
        <input data-group-name type="text" maxlength="60" placeholder="Weekend crew" autocomplete="off">
      </label>
      <div class="chat-group-field">
        <span>Add friends</span>
        <div class="chat-group-friends">
          ${friends.length
            ? friends.map(person => `<label class="chat-group-friend">
                <input type="checkbox" value="${fbEscape(person.id)}">
                <span class="chat-group-friend-pic">${window.Friends ? Friends.media(person) : fbEscape(nameOf(person)[0])}</span>
                <span>${fbEscape(nameOf(person))}</span>
              </label>`).join('')
            : '<p class="chat-group-empty">No friends yet — create the group and share its invite link instead.</p>'}
        </div>
      </div>
      <div class="chat-group-modal-foot">
        <button class="fb-btn fb-btn-secondary" type="button" data-group-cancel>Cancel</button>
        <button class="fb-btn fb-btn-primary" type="button" data-group-create>Create group</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);

    const nameInput = overlay.querySelector('[data-group-name]');
    const createBtn = overlay.querySelector('[data-group-create]');
    let working = false;

    function close() {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
    }
    function onKey(event) {
      if (event.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-group-close]') || event.target.closest('[data-group-cancel]')) close();
    });

    createBtn.addEventListener('click', async () => {
      if (working) return;
      const name = nameInput.value.trim();
      if (!name) {
        showToast('Give the group a name', 'error');
        nameInput.focus();
        return;
      }
      const memberIds = [...overlay.querySelectorAll('.chat-group-friend input:checked')].map(box => box.value);
      working = true;
      createBtn.disabled = true;
      createBtn.textContent = 'Creating…';
      try {
        const group = await create(user, name, memberIds);
        if (!group) { working = false; createBtn.disabled = false; createBtn.textContent = 'Create group'; return; }
        close();
        showToast('Group created — share its invite link', 'success');
        if (onCreated) onCreated(group);
      } catch (error) {
        showToast(groupError(error).message, 'error', 7000);
        working = false;
        createBtn.disabled = false;
        createBtn.textContent = 'Create group';
      }
    });

    nameInput.focus();
  }

  // ---------- Joining from an invite link ----------

  async function joinPage(el, code) {
    const user = typeof Auth !== 'undefined' ? Auth.currentUser : null;
    if (!user) {
      const saved = storedGuest();
      // A device that already joined this group goes straight back into the chat
      const remembered = window.GuestStore ? window.GuestStore.find(code) : null;
      if (saved && remembered) {
        el.innerHTML = '<div class="fb-feed"><section class="fb-card chat-join-card"><div class="loading">Opening your guest chat…</div></section></div>';
        try {
          const resumed = await joinAsGuest(code, saved.name);
          if (window.GuestChat) {
            window.GuestChat.open(el, resumed.group, resumed.guest);
            return;
          }
        } catch (error) {
          showToast(groupError(error).message, 'error', 7000);
        }
      }
      el.innerHTML = `<div class="fb-feed"><section class="fb-card chat-join-card">
        <h3>Join this group chat</h3>
        <p>You do not need a MeDay account. Join as a guest to see the links, photos, videos and files shared in this group and reply to them.</p>
        <label class="chat-group-field">
          <span>Your name</span>
          <input data-guest-name type="text" maxlength="24" placeholder="Aya" autocomplete="nickname" value="${fbEscape(saved ? saved.name : '')}">
        </label>
        <div class="chat-join-actions">
          <button class="fb-btn fb-btn-primary" type="button" data-guest-join>Join as guest</button>
        </div>
        <p class="chat-join-note">Guest chat shows links, photos, videos, files and guest replies only — the rest of the group chat stays private.
          <a href="#/Login" data-guest-account>Log in</a> or <a href="#/Register" data-guest-account>create an account</a> to join the full chat.</p>
      </section></div>`;

      const nameInput = el.querySelector('[data-guest-name]');
      const joinBtn = el.querySelector('[data-guest-join]');
      // An account holder lands back on this link after signing in and joins as a member
      el.querySelectorAll('[data-guest-account]').forEach(link => {
        link.addEventListener('click', () => {
          try { localStorage.setItem('meday.pendingInvite', code); } catch (e) { /* storage blocked */ }
        });
      });

      let working = false;
      async function enterAsGuest() {
        if (working) return;
        working = true;
        joinBtn.disabled = true;
        joinBtn.textContent = 'Joining…';
        try {
          const { group, guest } = await joinAsGuest(code, nameInput.value);
          if (window.GuestChat) {
            window.GuestChat.open(el, group, guest);
          } else {
            el.innerHTML = '<div class="empty-state"><p>Guest chat could not load. Check your connection and try again.</p></div>';
          }
        } catch (error) {
          showToast(groupError(error).message, 'error', 7000);
          working = false;
          joinBtn.disabled = false;
          joinBtn.textContent = 'Join as guest';
        }
      }

      joinBtn.addEventListener('click', enterAsGuest);
      nameInput.addEventListener('keypress', event => { if (event.key === 'Enter') enterAsGuest(); });
      nameInput.focus();
      return;
    }

    el.innerHTML = `<div class="fb-feed"><section class="fb-card chat-join-card">
      <div class="loading">Joining the group…</div>
    </section></div>`;
    try {
      const group = await join(code, user);
      try { localStorage.removeItem('meday.pendingInvite'); } catch (e) { /* storage blocked */ }
      showToast(`You joined ${group.name}`, 'success');
      Router.navigate('/App');
      let tries = 0;
      const openWhenReady = () => {
        if (window.ChatWidget && window.ChatWidget.openGroup && document.getElementById('chatWidget')) {
          window.ChatWidget.openGroup(group.id);
        } else if (tries++ < 25) {
          setTimeout(openWhenReady, 200);
        }
      };
      setTimeout(openWhenReady, 200);
    } catch (error) {
      el.innerHTML = `<div class="fb-feed"><section class="fb-card chat-join-card">
        <h3>Could not join this group</h3>
        <p>${fbEscape(error.message)}</p>
        <a class="fb-btn fb-btn-primary" href="#/App">Go to the app</a>
      </section></div>`;
    }
  }

  return {
    myGroups,
    create,
    join,
    joinAsGuest,
    guestCanSend,
    members,
    open,
    openCreate,
    joinPage,
    inviteLink,
    linkify,
    attachmentHTML,
    formatTime,
    hasLink,
    isShared,
    isGuest,
    guestName,
    storedGuest,
    saveGuest,
    kindOf,
    postAttachment,
    groupError
  };
})();
