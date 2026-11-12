// Messenger-style chat widget — functional across all accounts
window.ChatWidget = function(container, currentUser) {
  if (!sb || !currentUser) return;

  let activeChat = null;
  let pollTimer = null;
  let users = [];
  let messages = [];

  container.innerHTML = `
    <div class="chat-fab" id="chatFab"><img class="chat-fab-icon" src="/img/chat-bubble-logo.png" alt=""></div>
    <div class="chat-panel" id="chatPanel" style="display:none">
      <div class="chat-header">
        <div class="chat-header-title" id="chatHeaderTitle">Messages</div>
        <button class="chat-close" id="chatClose">✕</button>
      </div>
      <div class="chat-body">
        <div class="chat-user-list" id="chatUserList"></div>
        <div class="chat-conversation" id="chatConversation" style="display:none">
          <button class="chat-back" id="chatBack">← Back</button>
          <div class="chat-messages" id="chatMessages"></div>
          <div class="chat-input-row">
            <input type="text" id="chatInput" placeholder="Type a message...">
            <button id="chatSend" class="chat-send-btn">➤</button>
          </div>
        </div>
      </div>
    </div>`;

  const fab = container.querySelector('#chatFab');
  const panel = container.querySelector('#chatPanel');
  const closeBtn = container.querySelector('#chatClose');
  const backBtn = container.querySelector('#chatBack');
  const userListView = container.querySelector('#chatUserList');
  const convoView = container.querySelector('#chatConversation');
  const messagesEl = container.querySelector('#chatMessages');
  const input = container.querySelector('#chatInput');
  const sendBtn = container.querySelector('#chatSend');
  const headerTitle = container.querySelector('#chatHeaderTitle');

  fab.addEventListener('click', () => {
    const open = panel.style.display === 'none';
    panel.style.display = open ? 'flex' : 'none';
    if (open) loadUsers();
    else stopPolling();
  });
  closeBtn.addEventListener('click', () => { panel.style.display = 'none'; stopPolling(); });
  backBtn.addEventListener('click', () => {
    activeChat = null;
    stopPolling();
    headerTitle.textContent = 'Messages';
    userListView.style.display = '';
    convoView.style.display = 'none';
  });

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
      const { data } = await sb.from('users').select('*').in('id', ids);
      users = (data || [])
        .filter(u => u.role !== 'admin' && !u.deleted_at && u.status !== 'deleted' && u.status !== 'suspended')
        .sort((a, b) => (lastSeen.get(String(b.id)) || 0) - (lastSeen.get(String(a.id)) || 0));
      renderUserList();
    } catch (e) {
      userListView.innerHTML = '<div class="chat-empty">Failed to load conversations</div>';
    }
  }

  function renderUserList() {
    if (users.length === 0) {
      userListView.innerHTML = '<div class="chat-empty">No conversations yet</div>';
      return;
    }
    userListView.innerHTML = users.map(u => {
      const initial = (u.username || '?')[0].toUpperCase();
      const avatarColor = u.role === 'admin' ? 'var(--gradient)' : '#bbb';
      return `<div class="chat-user-item" data-uid="${u.id}">
        <div class="chat-user-avatar" style="background:${avatarColor}">${initial}</div>
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
    headerTitle.textContent = user.full_name || user.username;
    userListView.style.display = 'none';
    convoView.style.display = 'flex';
    await loadMessages();
    startPolling();
  }

  async function loadMessages() {
    if (!activeChat) return;
    try {
      const { data, error } = await sb.from('chat_messages').select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });
      if (error) throw error;
      messages = data || [];
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
    input.value = '';
    try {
      await sb.from('chat_messages').insert([{ sender_id: currentUser.id, receiver_id: activeChat.id, message: text }]);
      messages.push({ sender_id: currentUser.id, receiver_id: activeChat.id, message: text, created_at: new Date().toISOString() });
      renderMessages();
    } catch (e) {
      showToast('Failed to send message', 'error');
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

  // Public hook so the top bar can open the message list
  window.ChatWidget.open = () => {
    panel.style.display = 'flex';
    loadUsers();
  };

  // Public hook so other pages (e.g. the profile friends list) can open a conversation
  window.ChatWidget.openWith = async (uid) => {
    if (!uid) return;
    panel.style.display = 'flex';
    await loadUsers();
    let target = users.find(u => String(u.id) === String(uid));
    // A person picked from a profile or the people list has no thread yet
    if (!target) {
      const { data } = await sb.from('users').select('*').eq('id', uid).maybeSingle();
      if (data && data.role !== 'admin' && !data.deleted_at) target = data;
    }
    if (target) openConversation(target);
  };

  function startPolling() { stopPolling(); pollTimer = setInterval(loadMessages, 3000); }
  function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function formatTime(ts) { const d = new Date(ts); return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
};
