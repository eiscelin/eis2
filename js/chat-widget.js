// Messenger-style chat widget — direct messages and group chats across all accounts
window.ChatWidget = function(container, currentUser) {
  if (!sb || !currentUser) return;

  let activeChat = null;
  let pollTimer = null;
  let users = [];
  let messages = [];
  let groups = [];
  let groupsError = '';
  let groupView = null;

  container.innerHTML = `
    <div class="chat-fab" id="chatFab"><img class="chat-fab-icon" src="/img/chat-bubble-logo.png" alt=""></div>
    <div class="chat-panel" id="chatPanel" style="display:none">
      <div class="chat-header">
        <div class="chat-header-title" id="chatHeaderTitle">Messages</div>
        <button class="chat-group-btn" id="chatGroupBtn" type="button">Group Chat</button>
        <div class="chat-header-actions">
          <button class="chat-new-group" id="chatNewGroup" type="button" title="New group" aria-label="New group">＋</button>
          <button class="chat-close" id="chatClose" type="button" aria-label="Close messages">✕</button>
        </div>
      </div>
      <div class="chat-body">
        <div class="chat-list-view" id="chatListView">
          <div class="chat-groups" id="chatGroupList"></div>
          <div class="chat-user-list" id="chatUserList"></div>
        </div>
        <div class="chat-group-picker" id="chatGroupPicker" style="display:none">
          <button class="chat-back" id="chatPickerBack" type="button">← Messages</button>
          <div class="chat-group-picker-list" id="chatGroupPickerList"></div>
        </div>
        <div class="chat-conversation" id="chatConversation" style="display:none">
          <button class="chat-back" id="chatBack">← Back</button>
          <div class="chat-messages" id="chatMessages"></div>
          <div class="chat-input-row">
            <input type="text" id="chatInput" placeholder="Type a message...">
            <button id="chatSend" class="chat-send-btn" aria-label="Send">➤</button>
          </div>
        </div>
        <div class="chat-conversation chat-group-conversation" id="chatGroupConversation" style="display:none"></div>
      </div>
    </div>`;

  const fab = container.querySelector('#chatFab');
  const panel = container.querySelector('#chatPanel');
  const closeBtn = container.querySelector('#chatClose');
  const newGroupBtn = container.querySelector('#chatNewGroup');
  const groupBtn = container.querySelector('#chatGroupBtn');
  const picker = container.querySelector('#chatGroupPicker');
  const pickerList = container.querySelector('#chatGroupPickerList');
  const pickerBack = container.querySelector('#chatPickerBack');
  const backBtn = container.querySelector('#chatBack');
  const listView = container.querySelector('#chatListView');
  const userListView = container.querySelector('#chatUserList');
  const groupListView = container.querySelector('#chatGroupList');
  const convoView = container.querySelector('#chatConversation');
  const groupConvo = container.querySelector('#chatGroupConversation');
  const messagesEl = container.querySelector('#chatMessages');
  const input = container.querySelector('#chatInput');
  const sendBtn = container.querySelector('#chatSend');
  const headerTitle = container.querySelector('#chatHeaderTitle');

  function closePanel() {
    panel.style.display = 'none';
    stopPolling();
    stopGroupView();
  }

  function stopGroupView() {
    if (groupView) {
      groupView.stop();
      groupView = null;
    }
  }

  function showList() {
    activeChat = null;
    stopPolling();
    stopGroupView();
    headerTitle.textContent = 'Messages';
    convoView.style.display = 'none';
    groupConvo.style.display = 'none';
    picker.style.display = 'none';
    listView.style.display = '';
  }

  // The Group Chat button opens the groups this member belongs to
  async function showGroupPicker() {
    activeChat = null;
    stopPolling();
    stopGroupView();
    headerTitle.textContent = 'Group chats';
    convoView.style.display = 'none';
    groupConvo.style.display = 'none';
    listView.style.display = 'none';
    picker.style.display = 'flex';
    pickerList.innerHTML = '<div class="chat-empty">Loading group chats…</div>';
    await loadGroups();
    if (picker.style.display !== 'none') renderPicker();
  }

  fab.addEventListener('click', () => {
    const open = panel.style.display === 'none';
    panel.style.display = open ? 'flex' : 'none';
    if (open) refreshList();
    else closePanel();
  });
  closeBtn.addEventListener('click', closePanel);
  backBtn.addEventListener('click', showList);
  pickerBack.addEventListener('click', showList);
  groupBtn.addEventListener('click', () => {
    if (picker.style.display !== 'none') showList();
    else showGroupPicker();
  });

  async function refreshList() {
    await Promise.all([loadUsers(), loadGroups()]);
  }

  async function loadUsers() {
    try {
      // Only people this user already has a conversation with — no strangers — and never admins
      const { data: msgs } = await sb.from('chat_messages')
        .select('sender_id,receiver_id,created_at')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);
      const lastSeen = new Map();
      (msgs || []).forEach(m => {
        const mine = String(m.sender_id) === String(currentUser.id);
        const other = String(mine ? m.receiver_id : m.sender_id);
        if (!other || other === String(currentUser.id)) return;
        const at = new Date(m.created_at || 0).getTime();
        if (!lastSeen.has(other) || at > lastSeen.get(other)) lastSeen.set(other, at);
      });
      const ids = [...lastSeen.keys()];
      if (!ids.length) { users = []; renderUserList(); return; }
      // A guest who wrote from an ad has no account row: their name rides in the id
      const guestIds = ids.filter(id => window.GroupChat && GroupChat.isGuest(id));
      const memberIds = ids.filter(id => guestIds.indexOf(id) === -1);
      const { data } = memberIds.length
        ? await sb.from('users').select('*').in('id', memberIds)
        : { data: [] };
      const guests = guestIds.map(id => ({
        id,
        full_name: GroupChat.guestName(id) + ' (guest)',
        username: GroupChat.guestName(id),
        role: 'guest',
        guest: true
      }));
      users = guests.concat((data || [])
        .filter(u => u.role !== 'admin' && !u.deleted_at && u.status !== 'deleted' && u.status !== 'suspended'))
        .sort((a, b) => (lastSeen.get(String(b.id)) || 0) - (lastSeen.get(String(a.id)) || 0));
      renderUserList();
    } catch (e) {
      userListView.innerHTML = '<div class="chat-empty">Failed to load conversations</div>';
    }
  }

  async function loadGroups() {
    if (!window.GroupChat) { groups = []; renderGroupList(); return; }
    try {
      groups = await GroupChat.myGroups(currentUser.id);
      groupsError = '';
    } catch (e) {
      groups = [];
      groupsError = e.message;
    }
    renderGroupList();
  }

  function groupItemHTML(g) {
    const initial = (g.name || '?')[0].toUpperCase();
    const preview = String(g.last_message || '').slice(0, 48);
    return `<div class="chat-user-item chat-group-item" data-gid="${escapeHtml(g.id)}">
      <div class="chat-user-avatar chat-group-avatar">${escapeHtml(initial)}</div>
      <div class="chat-user-info">
        <div class="chat-user-name">${escapeHtml(g.name)}</div>
        <div class="chat-user-role">${g.member_count} member${g.member_count === 1 ? '' : 's'}${preview ? ' · ' + escapeHtml(preview) : ''}</div>
      </div>
    </div>`;
  }

  function bindGroupItems(scope) {
    scope.querySelectorAll('[data-gid]').forEach(item => {
      item.addEventListener('click', () => {
        const group = groups.find(g => String(g.id) === String(item.dataset.gid));
        if (group) openGroupConversation(group);
      });
    });
  }

  function renderGroupList() {
    if (groupsError) {
      groupListView.innerHTML = `<div class="chat-empty chat-groups-empty">${escapeHtml(groupsError)}</div>`;
      return;
    }
    if (!groups.length) { groupListView.innerHTML = ''; return; }
    groupListView.innerHTML = '<div class="chat-groups-label">Group chats</div>' + groups.map(groupItemHTML).join('');
    bindGroupItems(groupListView);
  }

  function renderPicker() {
    if (!window.GroupChat) {
      pickerList.innerHTML = '<div class="chat-empty">Group chats are not available.</div>';
      return;
    }
    if (groupsError) {
      pickerList.innerHTML = `<div class="chat-empty chat-groups-empty">${escapeHtml(groupsError)}</div>`;
      return;
    }
    if (!groups.length) {
      pickerList.innerHTML = '<div class="chat-empty">No group chats yet — tap ＋ to create one.</div>';
      return;
    }
    pickerList.innerHTML = '<div class="chat-groups-label">Your group chats</div>' + groups.map(groupItemHTML).join('');
    bindGroupItems(pickerList);
  }

  function renderUserList() {
    if (users.length === 0) {
      userListView.innerHTML = '<div class="chat-empty">No direct messages yet</div>';
      return;
    }
    userListView.innerHTML = users.map(u => {
      const initial = (u.username || '?')[0].toUpperCase();
      // The member's own picture or video stands for them in the chat list
      const url = String(u.avatar_url || '');
      const isVideo = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(url);
      const avatar = url
        ? (isVideo
          ? `<video class="chat-user-avatar chat-user-media" src="${escapeHtml(url)}" autoplay muted loop playsinline></video>`
          : `<img class="chat-user-avatar chat-user-media" src="${escapeHtml(fbImageUrl(url, 96))}" alt="" loading="lazy" decoding="async">`)
        : `<div class="chat-user-avatar" style="background:#bbb">${initial}</div>`;
      return `<div class="chat-user-item" data-uid="${u.id}">
        ${avatar}
        <div class="chat-user-info">
          <div class="chat-user-name">${u.full_name || u.username}</div>
          <div class="chat-user-role">${u.role}</div>
        </div>
      </div>`;
    }).join('');
    userListView.querySelectorAll('.chat-user-item').forEach(item => {
      item.addEventListener('click', () => {
        const user = users.find(u => String(u.id) === String(item.dataset.uid));
        if (user) openConversation(user);
      });
    });
  }

  async function openConversation(user) {
    activeChat = user;
    stopGroupView();
    headerTitle.textContent = user.full_name || user.username;
    listView.style.display = 'none';
    picker.style.display = 'none';
    groupConvo.style.display = 'none';
    convoView.style.display = 'flex';
    await loadMessages();
    startPolling();
  }

  function openGroupConversation(group) {
    if (!window.GroupChat) return;
    activeChat = null;
    stopPolling();
    stopGroupView();
    headerTitle.textContent = group.name;
    listView.style.display = 'none';
    picker.style.display = 'none';
    convoView.style.display = 'none';
    groupConvo.style.display = 'flex';
    groupView = GroupChat.open(groupConvo, group, currentUser, () => {
      stopGroupView();
      headerTitle.textContent = 'Messages';
      groupConvo.style.display = 'none';
      listView.style.display = '';
      loadGroups();
    });
  }

  // Only the columns a bubble shows travel on every refresh
  const MESSAGE_COLUMNS = 'id, sender_id, receiver_id, message, created_at';
  let loadedThread = null;
  let lastMessageAt = '';

  async function loadMessages(force) {
    if (!activeChat || document.hidden) return;
    const thread = String(activeChat.id);
    const full = !!force || loadedThread !== thread;
    try {
      let data = null;
      if (window.GroupChat && GroupChat.isGuest(thread)) {
        // A guest name can hold brackets or commas, so the two sides of that
        // thread are read apart instead of in one filter
        const [mine, theirs] = await Promise.all([
          sb.from('chat_messages').select(MESSAGE_COLUMNS).eq('sender_id', currentUser.id).eq('receiver_id', thread).order('created_at', { ascending: true }),
          sb.from('chat_messages').select(MESSAGE_COLUMNS).eq('sender_id', thread).eq('receiver_id', currentUser.id).order('created_at', { ascending: true })
        ]);
        if (mine.error) throw mine.error;
        if (theirs.error) throw theirs.error;
        data = (mine.data || []).concat(theirs.data || [])
          .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
      } else {
        let query = sb.from('chat_messages').select(MESSAGE_COLUMNS)
          .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},receiver_id.eq.${currentUser.id})`)
          .order('created_at', { ascending: true });
        // After the first read only messages that arrived since reach the phone,
        // and nothing is repainted when there is nothing new
        if (!full && lastMessageAt) query = query.gt('created_at', lastMessageAt);
        const result = await query;
        if (result.error) throw result.error;
        data = result.data;
      }
      if (full) {
        messages = data || [];
        loadedThread = thread;
      } else {
        if (!data || !data.length) return;
        const known = new Set(messages.map(m => String(m.id)));
        data.forEach(m => {
          if (!known.has(String(m.id))) messages.push(m);
        });
      }
      const newest = messages[messages.length - 1];
      if (newest && newest.created_at) lastMessageAt = newest.created_at;
      renderMessages();
    } catch (e) {
      messagesEl.innerHTML = '<div class="chat-empty">Chat not set up yet. Run the SQL migration in Supabase.</div>';
    }
  }

  function renderMessages() {
    if (messages.length === 0) {
      messagesEl.innerHTML = '<div class="chat-empty">No messages yet. Say hi! 👋</div>';
      return;
    }
    messagesEl.innerHTML = messages.map(m => {
      const isMe = String(m.sender_id) === String(currentUser.id);
      return `<div class="chat-bubble ${isMe ? 'chat-bubble-me' : 'chat-bubble-them'}">
        <div class="chat-bubble-text">${escapeHtml(m.message)}</div>
        <div class="chat-bubble-time">${formatTime(m.created_at)}</div>
      </div>`;
    }).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text || !activeChat) return;
    if (ReadOnlyMode.block('Sending messages')) return;
    input.value = '';
    // The message shows the moment it is sent, before the save comes back
    messages.push({ sender_id: currentUser.id, receiver_id: activeChat.id, message: text, created_at: new Date().toISOString() });
    renderMessages();
    try {
      await sb.from('chat_messages').insert([{ sender_id: currentUser.id, receiver_id: activeChat.id, message: text }]);
      // One read of the thread keeps the sent message and its saved id in step
      await loadMessages(true);
    } catch (e) {
      showToast('Failed to send message', 'error');
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

  newGroupBtn.addEventListener('click', () => {
    if (!window.GroupChat) return;
    GroupChat.openCreate(currentUser, group => {
      loadGroups();
      openGroupConversation(group);
    });
  });

  // Public hook so the top bar can open the message list
  window.ChatWidget.open = () => {
    panel.style.display = 'flex';
    showList();
    refreshList();
  };

  // Public hook so other pages (e.g. the profile friends list) can open a conversation
  window.ChatWidget.openWith = async (uid) => {
    if (!uid) return;
    panel.style.display = 'flex';
    showList();
    await loadUsers();
    let target = users.find(u => String(u.id) === String(uid));
    // A person picked from a profile or the people list has no thread yet
    if (!target) {
      const { data } = await sb.from('users').select('*').eq('id', uid).maybeSingle();
      if (data && data.role !== 'admin' && !data.deleted_at) target = data;
    }
    if (target) openConversation(target);
  };

  // Public hook so an invite link can open the group it just joined
  window.ChatWidget.openGroup = async (gid) => {
    if (!gid || !window.GroupChat) return;
    panel.style.display = 'flex';
    showList();
    await loadGroups();
    let group = groups.find(g => String(g.id) === String(gid));
    if (!group) {
      const { data } = await sb.from('chat_groups').select('*').eq('id', gid).maybeSingle();
      if (data) group = data;
    }
    if (group) openGroupConversation(group);
  };

  function startPolling() { stopPolling(); pollTimer = setInterval(loadMessages, 3000); }
  function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function formatTime(ts) { const d = new Date(ts); return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
};
