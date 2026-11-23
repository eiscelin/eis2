// Group chats for friends: create a group, invite people with a link, and send
// text, photos, videos and files in one thread.
window.GroupChat = (function () {
  const MAX_IMAGE = 20 * 1024 * 1024;
  const MAX_VIDEO = 100 * 1024 * 1024;
  const MAX_FILE = 25 * 1024 * 1024;
  const MESSAGE_COLUMNS = 'id, group_id, sender_id, message, attachment_url, attachment_type, attachment_name, created_at';

  const asId = value => String(value == null ? '' : value);
  const nameOf = person => (person && (person.full_name || person.username)) || 'Member';

  function inviteLink(code) {
    return location.origin + location.pathname + '#/Join/' + encodeURIComponent(code || '');
  }

  function newInviteCode() {
    const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
    const bytes = new Uint8Array(10);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    let code = '';
    for (let i = 0; i < bytes.length; i++) code += alphabet[bytes[i] % alphabet.length];
    return code;
  }

  function groupError(error) {
    const message = String((error && error.message) || error || 'Something went wrong');
    if (/chat_group/.test(message)) {
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
    const { error: memberError } = await sb.from('chat_group_members')
      .upsert(ids.map(uid => ({ group_id: group.id, user_id: uid })), { onConflict: 'group_id,user_id' });
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
    const { data: rows, error } = await sb.from('chat_group_members').select('user_id').eq('group_id', groupId);
    if (error) throw groupError(error);
    const ids = [...new Set((rows || []).map(row => asId(row.user_id)).filter(Boolean))];
    if (!ids.length) return [];
    const { data } = await sb.from('users')
      .select('id, username, full_name, avatar_url, role')
      .in('id', ids);
    return (data || []).filter(person => person.role !== 'admin');
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

  // ---------- The group conversation ----------

  function open(container, group, user, onBack) {
    let messages = [];
    let lastAt = '';
    let senderNames = new Map();
    let pollTimer = null;
    let busy = false;
    let destroyed = false;
    let firstRender = true;

    container.innerHTML = `
      <div class="chat-group-head">
        <button class="chat-back" type="button" data-group-back>← Back</button>
        <div class="chat-group-title">
          <div class="chat-group-name">${fbEscape(group.name)}</div>
          <div class="chat-group-meta" data-group-meta>Loading members…</div>
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
      <div class="chat-messages chat-group-messages" data-group-messages></div>
      <div class="chat-upload" data-group-upload hidden>
        <span class="chat-upload-text" data-upload-text>Uploading…</span>
        <div class="chat-upload-bar"><div class="chat-upload-fill" data-upload-fill></div></div>
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
      const ids = [...new Set(messages.map(m => asId(m.sender_id)).filter(id => id && !senderNames.has(id)))];
      if (!ids.length || !sb) return;
      const { data } = await sb.from('users').select('id, username, full_name, avatar_url').in('id', ids);
      (data || []).forEach(person => senderNames.set(asId(person.id), person));
    }

    function renderMessages() {
      if (!messages.length) {
        messagesEl.innerHTML = '<div class="chat-empty">No messages yet. Say hi to the group! 👋</div>';
        return;
      }
      const atBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 90;
      messagesEl.innerHTML = messages.map(message => {
        const mine = asId(message.sender_id) === asId(user.id);
        const sender = senderNames.get(asId(message.sender_id));
        const name = sender ? nameOf(sender) : 'Member';
        return `<div class="chat-bubble chat-group-bubble ${mine ? 'chat-bubble-me' : 'chat-bubble-them'}">
          ${mine ? '' : `<div class="chat-bubble-sender">${fbEscape(name)}</div>`}
          ${message.message ? `<div class="chat-bubble-text">${linkify(message.message)}</div>` : ''}
          ${attachmentHTML(message)}
          <div class="chat-bubble-time">${formatTime(message.created_at)}</div>
        </div>`;
      }).join('');
      if (atBottom || firstRender) messagesEl.scrollTop = messagesEl.scrollHeight;
      firstRender = false;
    }

    async function loadMessages(force) {
      if (destroyed || document.hidden) return;
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
          const known = new Set(messages.map(m => asId(m.id)));
          data.forEach(message => {
            if (!known.has(asId(message.id))) messages.push(message);
          });
          messages.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        }
        const newest = messages[messages.length - 1];
        if (newest && newest.created_at) lastAt = newest.created_at;
        await loadSenders();
        renderMessages();
      } catch (error) {
        messagesEl.innerHTML = `<div class="chat-empty">${fbEscape(groupError(error).message)}</div>`;
      }
    }

    async function sendText() {
      const text = input.value.trim();
      if (!text || busy) return;
      if (window.ReadOnlyMode && ReadOnlyMode.block('Sending messages')) return;
      input.value = '';
      const temp = {
        id: 'temp-' + Date.now(),
        group_id: group.id,
        sender_id: user.id,
        message: text,
        created_at: new Date().toISOString()
      };
      messages.push(temp);
      renderMessages();
      try {
        const { error } = await sb.from('chat_group_messages').insert([{
          group_id: group.id,
          sender_id: asId(user.id),
          message: text
        }]);
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
      const type = String(file.type || '');
      const kind = type.indexOf('image/') === 0 ? 'image' : type.indexOf('video/') === 0 ? 'video' : 'file';
      const limit = kind === 'image' ? MAX_IMAGE : kind === 'video' ? MAX_VIDEO : MAX_FILE;
      const what = kind === 'image' ? 'Photo' : kind === 'video' ? 'Video' : 'File';
      if (file.size > limit) {
        showToast(`${what} must be ${Math.round(limit / (1024 * 1024))} MB or smaller`, 'error', 5000);
        fileInput.value = '';
        return;
      }
      if (window.ReadOnlyMode && ReadOnlyMode.block('Sending attachments')) {
        fileInput.value = '';
        return;
      }
      busy = true;
      sendBtn.disabled = true;
      const label = kind === 'image' ? 'Uploading photo…' : kind === 'video' ? 'Uploading video…' : 'Uploading file…';
      showUpload(label, 0);
      try {
        let payload = file;
        if (kind === 'image' && typeof shrinkImage === 'function') {
          payload = await shrinkImage(file, 1600).catch(() => file);
        }
        const onProgress = fraction => showUpload(label, fraction);
        let url = '';
        if (kind === 'file' && typeof cloudinaryUploadFile === 'function') {
          url = await cloudinaryUploadFile(payload, onProgress);
        } else {
          url = await cloudinaryUpload(payload, onProgress);
        }
        if (!url) throw new Error('File hosting is not connected');
        const { error } = await sb.from('chat_group_messages').insert([{
          group_id: group.id,
          sender_id: asId(user.id),
          message: null,
          attachment_url: url,
          attachment_type: kind,
          attachment_name: file.name || ''
        }]);
        if (error) throw error;
        await loadMessages(true);
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

    members(group.id).then(list => {
      if (destroyed) return;
      const count = list.length || group.member_count || 1;
      const names = list.slice(0, 3).map(nameOf).join(', ');
      metaEl.textContent = `${count} member${count === 1 ? '' : 's'}${names ? ' · ' + names : ''}`;
    }).catch(() => {
      if (!destroyed) metaEl.textContent = `${group.member_count || 1} members`;
    });

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
      try { localStorage.setItem('meday.pendingInvite', code); } catch (e) { /* storage blocked */ }
      el.innerHTML = `<div class="fb-feed"><section class="fb-card chat-join-card">
        <h3>Join this group chat</h3>
        <p>Log in or create an account, then you will join the group automatically.</p>
        <div class="chat-join-actions">
          <a class="fb-btn fb-btn-primary" href="#/Login">Log in</a>
          <a class="fb-btn fb-btn-secondary" href="#/Register">Create account</a>
        </div>
      </section></div>`;
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
    members,
    open,
    openCreate,
    joinPage,
    inviteLink
  };
})();
