// Admin panel — approve profile media, moderate every message and manage members
var Pages = window.Pages || {};

(function () {
  const state = {
    tab: 'members',
    users: [],
    messages: [],
    announcements: [],
    settings: {},
    search: '',
    showDeleted: false,
    messageFilter: null
  };
  let me = null;
  let rootEl = null;

  const MEDIA_LABEL = { avatar: 'Profile picture', cover: 'Cover' };

  function nameOf(u) {
    return (u && (u.full_name || u.username)) || 'Member';
  }

  function initialOf(u) {
    return (String(nameOf(u)).trim()[0] || '?').toUpperCase();
  }

  function isVideoUrl(url) {
    return /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(String(url || ''));
  }

  function statusOf(u) {
    if (!u) return 'active';
    if (u.deleted_at || u.status === 'deleted') return 'deleted';
    return u.status || 'active';
  }

  function pendingKinds(u) {
    const kinds = [];
    if (u.avatar_review_status === 'pending' && u.avatar_pending_url) kinds.push('avatar');
    if (u.cover_review_status === 'pending' && u.cover_pending_url) kinds.push('cover');
    return kinds;
  }

  function pendingTotal() {
    return state.users.reduce((sum, u) => sum + pendingKinds(u).length, 0);
  }

  function visibleUsers() {
    return state.users.filter(u => state.showDeleted || statusOf(u) !== 'deleted');
  }

  function memberCount() {
    return state.users.filter(u => statusOf(u) !== 'deleted').length;
  }

  function fmtWhen(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function avatarHtml(u, cls) {
    const url = u && u.avatar_url;
    const extra = cls ? ' ' + cls : '';
    if (!url) return `<span class="admin-avatar${extra}"><span>${fbEscape(initialOf(u))}</span></span>`;
    return `<span class="admin-avatar${extra}">${isVideoUrl(url)
      ? `<video src="${fbEscape(url)}" muted loop autoplay playsinline></video>`
      : `<img src="${fbEscape(url)}" alt="">`}</span>`;
  }

  function reviewBadge(u) {
    const kinds = pendingKinds(u);
    if (kinds.length) return `<span class="admin-badge admin-badge-pending">⏳ ${kinds.length} pending</span>`;
    if (u.avatar_review_status === 'rejected' || u.cover_review_status === 'rejected') {
      return '<span class="admin-badge admin-badge-rejected">Rejected</span>';
    }
    return '';
  }

  function statusBadge(u) {
    const status = statusOf(u);
    const label = status === 'suspended' ? 'Suspended' : status === 'deleted' ? 'Deleted' : 'Active';
    return `<span class="admin-badge admin-badge-${status}">${label}</span>`;
  }

  function csvCell(value) {
    const text = value == null ? '' : String(value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function toastError(e) {
    const message = String((e && e.message) || e || 'Something went wrong');
    showToast(/could not find the function|does not exist|schema cache/i.test(message)
      ? 'Run 008_add_admin_controls.sql in Supabase, then try again'
      : message, 'error', 6000);
  }

  // A missing table (migration not run yet) must not block the whole panel
  async function rows(promise) {
    try {
      const { data, error } = await promise;
      return error ? [] : (data || []);
    } catch {
      return [];
    }
  }

  async function loadAll() {
    const [users, messages, announcements, settings] = await Promise.all([
      rows(sb.from('users').select('*').order('created_at', { ascending: false })),
      rows(sb.from('chat_messages').select('*').order('created_at', { ascending: false }).limit(1000)),
      rows(sb.from('announcements').select('*').order('created_at', { ascending: false })),
      rows(sb.from('app_settings').select('*'))
    ]);
    state.users = users;
    state.messages = messages;
    state.announcements = announcements;
    state.settings = {};
    settings.forEach(row => { state.settings[row.key] = row.value; });
  }

  async function refresh() {
    await loadAll();
    renderPage(rootEl);
  }

  function statCard(icon, count, label, tone) {
    return `<div class="admin-stat">
      <span class="admin-stat-icon ${tone}">${icon}</span>
      <div><div class="admin-stat-count">${count}</div><div class="admin-stat-label">${label}</div></div>
    </div>`;
  }

  // ===================== Page shell =====================

  function renderPage(el) {
    rootEl = el;
    const brand = fbBrand();
    const tabs = [
      { id: 'members', label: `Members (${memberCount()})` },
      { id: 'approvals', label: `Approvals (${pendingTotal()})` },
      { id: 'messages', label: `Messages (${state.messages.length})` },
      { id: 'announcements', label: 'Announcements' },
      { id: 'roles', label: 'Roles' },
      { id: 'settings', label: 'Settings' },
      { id: 'deleted', label: `Deleted (${state.users.filter(u => statusOf(u) === 'deleted').length})` },
      { id: 'myprofile', label: 'My Profile' }
    ];

    el.innerHTML = `
      <div class="admin-page">
        <div class="admin-wrap">
          <header class="admin-top">
            <div class="admin-brand">
              <span class="admin-shield" aria-hidden="true">🛡️</span>
              <div>
                <h1>Admin Panel</h1>
                <p>Approve profile media, read messages and manage ${fbEscape(brand.name)} members</p>
              </div>
            </div>
            <div class="admin-top-actions">
              <button class="admin-export" id="adminExport" type="button">⬇ Export CSV</button>
              <a class="admin-back" href="#/App">← Back to app</a>
            </div>
          </header>

          <div class="admin-stats">
            ${statCard('👥', memberCount(), 'Total Members', 'blue')}
            ${statCard('⏳', pendingTotal(), 'Pending Approvals', 'orange')}
            ${statCard('💬', state.messages.length, 'Messages', 'teal')}
            ${statCard('⏸️', state.users.filter(u => statusOf(u) === 'suspended').length, 'Suspended', 'red')}
          </div>

          <nav class="admin-nav" aria-label="Admin sections">
            ${tabs.map(t => `<button class="admin-pill${state.tab === t.id ? ' active' : ''}" type="button" data-tab="${t.id}">${t.label}</button>`).join('')}
          </nav>

          <div id="adminBody"></div>
        </div>
      </div>`;

    el.querySelector('#adminExport').addEventListener('click', exportCsv);
    el.querySelectorAll('.admin-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        state.tab = btn.dataset.tab;
        state.search = '';
        state.messageFilter = null;
        el.querySelectorAll('.admin-pill').forEach(b => b.classList.toggle('active', b === btn));
        renderBody();
      });
    });
    renderBody();
  }

  function renderBody() {
    const body = rootEl.querySelector('#adminBody');
    if (!body) return;
    if (state.tab === 'members') return renderMembers(body);
    if (state.tab === 'approvals') return renderApprovals(body);
    if (state.tab === 'messages') return renderMessages(body);
    if (state.tab === 'announcements') return renderAnnouncements(body);
    if (state.tab === 'roles') return renderRoles(body);
    if (state.tab === 'settings') return renderSettings(body);
    if (state.tab === 'deleted') return renderDeleted(body);
    return renderMyProfile(body);
  }

  // ===================== Members =====================

  function renderMembers(body) {
    body.innerHTML = `
      <section class="admin-card">
        <div class="admin-toolbar">
          <label class="admin-search">
            <span aria-hidden="true">🔍</span>
            <input id="adminSearch" type="search" placeholder="Search members..." value="${fbEscape(state.search)}" aria-label="Search members">
          </label>
          <button class="admin-tool" id="adminUnhide" type="button">${state.showDeleted ? '🙈 Hide deleted' : '👁 Unhide'}</button>
          <button class="admin-tool" id="adminRefresh" type="button">↻ Refresh</button>
        </div>
        <div id="adminList"></div>
      </section>`;

    const input = body.querySelector('#adminSearch');
    input.addEventListener('input', () => {
      state.search = input.value;
      paintMembers();
    });
    body.querySelector('#adminUnhide').addEventListener('click', () => {
      state.showDeleted = !state.showDeleted;
      renderMembers(body);
    });
    body.querySelector('#adminRefresh').addEventListener('click', refresh);

    paintMembers();

    function paintMembers() {
      const list = body.querySelector('#adminList');
      if (!list) return;
      const q = state.search.trim().toLowerCase();
      const users = visibleUsers().filter(u => !q ||
        `${nameOf(u)} ${u.username || ''}`.toLowerCase().includes(q));

      if (!users.length) {
        list.innerHTML = `<div class="admin-empty">${emptyState('👥', q ? 'No member matches that search.' : 'No members yet.')}</div>`;
        return;
      }

      list.innerHTML = users.map((u, i) => {
        const status = statusOf(u);
        const isAdmin = u.role === 'admin';
        const acts = [];
        if (pendingKinds(u).length) {
          acts.push('<button class="admin-act review" type="button" data-act="review" title="Review media">✅</button>');
        }
        acts.push('<button class="admin-act msg" type="button" data-act="messages" title="Read messages">💬</button>');
        if (status !== 'deleted') {
          acts.push(`<button class="admin-act role" type="button" data-act="role" title="${isAdmin ? 'Remove admin' : 'Make admin'}">${isAdmin ? '🎭' : '🛡️'}</button>`);
          if (status === 'suspended') {
            acts.push('<button class="admin-act approve" type="button" data-act="activate" title="Reactivate member">▶️</button>');
          } else {
            acts.push('<button class="admin-act suspend" type="button" data-act="suspend" title="Suspend member">⏸️</button>');
          }
          acts.push('<button class="admin-act delete" type="button" data-act="delete" title="Delete member">🗑️</button>');
        } else {
          acts.push('<button class="admin-act approve" type="button" data-act="restore" title="Restore member">♻️</button>');
        }
        if (u.username) {
          acts.push(`<a class="admin-act view" href="#/u/${encodeURIComponent(u.username)}" title="Open profile">👁️</a>`);
        }

        return `<div class="admin-row" data-id="${fbEscape(u.id)}">
          <span class="admin-index">${i + 1}</span>
          ${avatarHtml(u)}
          <div class="admin-who">
            <div class="admin-name">${fbEscape(nameOf(u))}</div>
            <div class="admin-handle">@${fbEscape(u.username || '')}</div>
          </div>
          <div class="admin-col">${statusBadge(u)}</div>
          <div class="admin-col"><span class="admin-role ${isAdmin ? 'is-admin' : ''}">${isAdmin ? 'Admin' : 'Member'}</span></div>
          <div class="admin-col">${reviewBadge(u)}</div>
          <div class="admin-actions">${acts.join('')}</div>
        </div>`;
      }).join('');

      list.querySelectorAll('[data-act]').forEach(btn => {
        btn.addEventListener('click', () => {
          const row = btn.closest('[data-id]');
          const user = state.users.find(x => String(x.id) === String(row.dataset.id));
          if (!user) return;
          memberAction(btn.dataset.act, user);
        });
      });
    }
  }

  async function memberAction(act, user) {
    const label = nameOf(user);
    try {
      if (act === 'review') {
        state.tab = 'approvals';
        state.search = '';
        rootEl.querySelectorAll('.admin-pill').forEach(b => b.classList.toggle('active', b.dataset.tab === 'approvals'));
        return renderBody();
      }
      if (act === 'messages') {
        state.tab = 'messages';
        state.messageFilter = String(user.id);
        state.search = '';
        rootEl.querySelectorAll('.admin-pill').forEach(b => b.classList.toggle('active', b.dataset.tab === 'messages'));
        return renderBody();
      }
      if (act === 'role') {
        const next = user.role === 'admin' ? 'member' : 'admin';
        if (!confirm(`Change ${label} to ${next}?`)) return;
        const { error } = await sb.rpc('admin_set_user_role', {
          p_admin_id: me.id, p_user_id: user.id, p_role: next
        });
        if (error) throw error;
        showToast(`${label} is now ${next}`, 'success');
        return refresh();
      }
      if (act === 'suspend') {
        if (!confirm(`Suspend ${label}? They will not be able to log in.`)) return;
        const { error } = await sb.rpc('admin_set_user_status', {
          p_admin_id: me.id, p_user_id: user.id, p_status: 'suspended'
        });
        if (error) throw error;
        showToast(`${label} is suspended`, 'success');
        return refresh();
      }
      if (act === 'activate') {
        const { error } = await sb.rpc('admin_set_user_status', {
          p_admin_id: me.id, p_user_id: user.id, p_status: 'active'
        });
        if (error) throw error;
        showToast(`${label} is active again`, 'success');
        return refresh();
      }
      if (act === 'delete') {
        if (!confirm(`Delete ${label}? You can restore them from the Deleted tab.`)) return;
        const { error } = await sb.rpc('admin_soft_delete_user', {
          p_admin_id: me.id, p_user_id: user.id
        });
        if (error) throw error;
        showToast(`${label} was deleted`, 'success');
        return refresh();
      }
      if (act === 'restore') {
        const { error } = await sb.rpc('admin_restore_user', {
          p_admin_id: me.id, p_user_id: user.id
        });
        if (error) throw error;
        showToast(`${label} was restored`, 'success');
        return refresh();
      }
    } catch (e) {
      toastError(e);
    }
  }

  // ===================== Approvals =====================

  function renderApprovals(body) {
    const pending = state.users.map(u => ({ user: u, kinds: pendingKinds(u) })).filter(x => x.kinds.length);

    body.innerHTML = `
      <section class="admin-card">
        <div class="admin-toolbar">
          <div class="admin-toolbar-title">⏳ Profile media waiting for review (${pendingTotal()})</div>
          <button class="admin-tool" id="adminRefresh" type="button">↻ Refresh</button>
        </div>
        ${pending.length ? `<div class="admin-approvals">${pending.map(item => item.kinds.map(kind => approvalCard(item.user, kind)).join('')).join('')}</div>`
          : `<div class="admin-empty">${emptyState('✅', 'Nothing to review. Every profile picture and cover is approved.')}</div>`}
      </section>`;

    body.querySelector('#adminRefresh').addEventListener('click', refresh);
    body.querySelectorAll('[data-review]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { review, id, kind } = btn.dataset;
        try {
          btn.disabled = true;
          const { error } = await sb.rpc('review_profile_media', {
            p_admin_id: me.id,
            p_user_id: id,
            p_kind: kind,
            p_approve: review === 'approve'
          });
          if (error) throw error;
          showToast(review === 'approve' ? `${MEDIA_LABEL[kind]} approved` : `${MEDIA_LABEL[kind]} rejected`, 'success');
          await refresh();
        } catch (e) {
          btn.disabled = false;
          toastError(e);
        }
      });
    });
  }

  function approvalCard(user, kind) {
    const url = kind === 'avatar' ? user.avatar_pending_url : user.cover_pending_url;
    return `<article class="admin-approval">
      <div class="admin-approval-head">
        ${avatarHtml(user, 'admin-avatar-sm')}
        <div>
          <div class="admin-name">${fbEscape(nameOf(user))}</div>
          <div class="admin-handle">@${fbEscape(user.username || '')} · ${MEDIA_LABEL[kind]}</div>
        </div>
      </div>
      <div class="admin-approval-media">
        ${isVideoUrl(url)
          ? `<video src="${fbEscape(url)}" controls muted playsinline></video>`
          : `<img src="${fbEscape(url)}" alt="${fbEscape(MEDIA_LABEL[kind])} from ${fbEscape(nameOf(user))}">`}
      </div>
      <div class="admin-approval-actions">
        <button class="admin-approve" type="button" data-review="approve" data-id="${fbEscape(user.id)}" data-kind="${kind}">✓ Approve</button>
        <button class="admin-reject" type="button" data-review="reject" data-id="${fbEscape(user.id)}" data-kind="${kind}">✕ Reject</button>
      </div>
    </article>`;
  }

  // ===================== Messages =====================

  function renderMessages(body) {
    const filterUser = state.messageFilter
      ? state.users.find(u => String(u.id) === String(state.messageFilter))
      : null;

    body.innerHTML = `
      <section class="admin-card">
        <div class="admin-toolbar">
          <label class="admin-search">
            <span aria-hidden="true">🔍</span>
            <input id="adminMsgSearch" type="search" placeholder="Search messages or members..." value="${fbEscape(state.search)}" aria-label="Search messages">
          </label>
          ${filterUser ? `<button class="admin-tool active" id="adminMsgClear" type="button">✕ ${fbEscape(nameOf(filterUser))}</button>` : ''}
          <button class="admin-tool" id="adminRefresh" type="button">↻ Refresh</button>
        </div>
        <p class="admin-hint">Every message sent between members. Latest ${state.messages.length.toLocaleString()} shown.</p>
        <div id="adminList"></div>
      </section>`;

    const input = body.querySelector('#adminMsgSearch');
    input.addEventListener('input', () => {
      state.search = input.value;
      paintMessages();
    });
    body.querySelector('#adminRefresh').addEventListener('click', refresh);
    const clear = body.querySelector('#adminMsgClear');
    if (clear) {
      clear.addEventListener('click', () => {
        state.messageFilter = null;
        state.search = '';
        renderBody();
      });
    }
    paintMessages();

    function paintMessages() {
      const list = body.querySelector('#adminList');
      const q = state.search.trim().toLowerCase();
      const byId = id => state.users.find(u => String(u.id) === String(id));
      const rows = state.messages.filter(m => {
        if (state.messageFilter && String(m.sender_id) !== state.messageFilter && String(m.receiver_id) !== state.messageFilter) return false;
        if (!q) return true;
        const sender = nameOf(byId(m.sender_id));
        const receiver = nameOf(byId(m.receiver_id));
        return `${m.message || ''} ${sender} ${receiver}`.toLowerCase().includes(q);
      });

      if (!rows.length) {
        list.innerHTML = `<div class="admin-empty">${emptyState('💬', q || state.messageFilter ? 'No message matches.' : 'No messages have been sent yet.')}</div>`;
        return;
      }

      list.innerHTML = rows.map(m => {
        const sender = byId(m.sender_id);
        const receiver = byId(m.receiver_id);
        return `<div class="admin-msg" data-msg="${fbEscape(m.id)}">
          <div class="admin-msg-head">
            <span class="admin-msg-people">
              <strong>${fbEscape(sender ? nameOf(sender) : (String(m.sender_id || '').startsWith('guest:') ? 'Guest' : 'Unknown'))}</strong>
              <span aria-hidden="true">→</span>
              <strong>${fbEscape(receiver ? nameOf(receiver) : 'Unknown')}</strong>
            </span>
            <span class="admin-msg-time">${fbEscape(fmtWhen(m.created_at))}</span>
            <button class="admin-act delete" type="button" data-del-msg="${fbEscape(m.id)}" title="Delete message">🗑️</button>
          </div>
          <div class="admin-msg-text">${fbEscape(m.message || '')}</div>
          ${String(m.sender_id || '').startsWith('guest:')
            ? `<div class="admin-msg-reply">
                 <input type="text" data-reply-input="${fbEscape(m.sender_id)}" placeholder="Reply to this Customer Service request…" aria-label="Reply to Customer Service request">
                 <button class="admin-tool" type="button" data-reply-to="${fbEscape(m.sender_id)}">Send</button>
               </div>`
            : ''}
        </div>`;
      }).join('');

      list.querySelectorAll('[data-reply-to]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const field = btn.parentElement.querySelector('[data-reply-input]');
          const text = (field.value || '').trim();
          if (!text) return;
          try {
            const { error } = await sb.from('chat_messages').insert([{
              sender_id: me.id, receiver_id: btn.dataset.replyTo, message: text
            }]);
            if (error) throw error;
            showToast('Reply sent to Customer Service request', 'success');
            await refresh();
          } catch (e) {
            toastError(e);
          }
        });
      });

      list.querySelectorAll('[data-del-msg]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this message for everyone?')) return;
          try {
            const { error } = await sb.from('chat_messages').delete().eq('id', btn.dataset.delMsg);
            if (error) throw error;
            showToast('Message deleted', 'success');
            await refresh();
          } catch (e) {
            toastError(e);
          }
        });
      });
    }
  }

  // ===================== Deleted =====================

  function renderDeleted(body) {
    const deleted = state.users.filter(u => statusOf(u) === 'deleted');
    body.innerHTML = `
      <section class="admin-card">
        <div class="admin-toolbar">
          <div class="admin-toolbar-title">🗑️ Deleted members (${deleted.length})</div>
          <button class="admin-tool" id="adminRefresh" type="button">↻ Refresh</button>
        </div>
        ${deleted.length ? `<div id="adminList">${deleted.map(u => `
          <div class="admin-row admin-row-deleted" data-id="${fbEscape(u.id)}">
            ${avatarHtml(u)}
            <div class="admin-who">
              <div class="admin-name">${fbEscape(nameOf(u))}</div>
              <div class="admin-handle">@${fbEscape(u.username || '')} · deleted ${fbEscape(fmtWhen(u.deleted_at))}</div>
            </div>
            <div class="admin-actions">
              <button class="admin-act approve" type="button" data-act="restore" title="Restore member">♻️</button>
            </div>
          </div>`).join('')}</div>`
          : `<div class="admin-empty">${emptyState('🗑️', 'No deleted members.')}</div>`}
      </section>`;

    body.querySelector('#adminRefresh').addEventListener('click', refresh);
    body.querySelectorAll('[data-act="restore"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const user = state.users.find(x => String(x.id) === String(btn.closest('[data-id]').dataset.id));
        if (user) memberAction('restore', user);
      });
    });
  }

  // ===================== Announcements =====================

  function renderAnnouncements(body) {
    body.innerHTML = `
      <section class="admin-card">
        <div class="admin-toolbar">
          <div class="admin-toolbar-title">📣 Posts shown on the home feed</div>
          <button class="admin-tool" id="adminRefresh" type="button">↻ Refresh</button>
        </div>
        <div class="admin-compose">
          <input id="adminAnnTitle" type="text" placeholder="Post title" aria-label="Post title">
          <textarea id="adminAnnContent" rows="3" placeholder="Write the announcement members will see…" aria-label="Announcement content"></textarea>
          <div class="admin-compose-foot">
            <select id="adminAnnPriority" aria-label="Priority">
              <option value="normal">Normal</option>
              <option value="high">Important</option>
            </select>
            <button class="admin-approve" id="adminAnnPost" type="button">Post announcement</button>
          </div>
        </div>
        <div id="adminList">
          ${state.announcements.length ? state.announcements.map(a => `
            <div class="admin-ann" data-ann="${fbEscape(a.id)}">
              <div class="admin-ann-body">
                <div class="admin-ann-title">${a.priority === 'high' ? '<span class="admin-badge admin-badge-suspended">Important</span> ' : ''}${fbEscape(a.title || 'Post')}</div>
                <div class="admin-ann-text">${fbEscape(a.content || '')}</div>
                <div class="admin-ann-time">${fbEscape(fmtWhen(a.created_at || a.date))}</div>
              </div>
              <button class="admin-act delete" type="button" data-del-ann="${fbEscape(a.id)}" title="Delete post">🗑️</button>
            </div>`).join('') : `<div class="admin-empty">${emptyState('📣', 'No announcements yet.')}</div>`}
        </div>
      </section>`;

    body.querySelector('#adminRefresh').addEventListener('click', refresh);
    body.querySelector('#adminAnnPost').addEventListener('click', async () => {
      const titleInput = body.querySelector('#adminAnnTitle');
      const contentInput = body.querySelector('#adminAnnContent');
      const priority = body.querySelector('#adminAnnPriority').value;
      const content = contentInput.value.trim();
      if (!content) return showToast('Write the announcement first', 'error');
      const title = titleInput.value.trim() || (content.length > 60 ? content.slice(0, 60) + '…' : content);
      try {
        const { error } = await sb.from('announcements').insert([{
          title, content, priority, is_active: true
        }]);
        if (error) throw error;
        showToast('Announcement posted', 'success');
        await refresh();
      } catch (e) {
        toastError(e);
      }
    });

    body.querySelectorAll('[data-del-ann]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this post for everyone?')) return;
        try {
          const { error } = await sb.from('announcements').delete().eq('id', btn.dataset.delAnn);
          if (error) throw error;
          showToast('Post deleted', 'success');
          await refresh();
        } catch (e) {
          toastError(e);
        }
      });
    });
  }

  // ===================== Roles =====================

  function renderRoles(body) {
    const users = state.users.filter(u => statusOf(u) !== 'deleted');
    const admins = users.filter(u => u.role === 'admin').length;
    body.innerHTML = `
      <section class="admin-card">
        <div class="admin-toolbar">
          <div class="admin-toolbar-title">🎭 ${admins} admin · ${users.length - admins} members</div>
          <button class="admin-tool" id="adminRefresh" type="button">↻ Refresh</button>
        </div>
        <p class="admin-hint">Admins can open this panel, approve media and read every message.</p>
        <div id="adminList">
          ${users.map(u => `
            <div class="admin-row admin-row-role" data-id="${fbEscape(u.id)}">
              ${avatarHtml(u)}
              <div class="admin-who">
                <div class="admin-name">${fbEscape(nameOf(u))}</div>
                <div class="admin-handle">@${fbEscape(u.username || '')}</div>
              </div>
              <select class="admin-role-select" data-role-for="${fbEscape(u.id)}" aria-label="Role for ${fbEscape(nameOf(u))}">
                <option value="member"${u.role !== 'admin' ? ' selected' : ''}>Member</option>
                <option value="admin"${u.role === 'admin' ? ' selected' : ''}>Admin</option>
              </select>
            </div>`).join('')}
        </div>
      </section>`;

    body.querySelector('#adminRefresh').addEventListener('click', refresh);
    body.querySelectorAll('.admin-role-select').forEach(select => {
      select.addEventListener('change', async () => {
        const user = state.users.find(u => String(u.id) === String(select.dataset.roleFor));
        if (!user) return;
        const next = select.value;
        try {
          const { error } = await sb.rpc('admin_set_user_role', {
            p_admin_id: me.id, p_user_id: user.id, p_role: next
          });
          if (error) throw error;
          showToast(`${nameOf(user)} is now ${next}`, 'success');
          await refresh();
        } catch (e) {
          select.value = user.role === 'admin' ? 'admin' : 'member';
          toastError(e);
        }
      });
    });
  }

  // ===================== Settings =====================

  function renderSettings(body) {
    const approval = state.settings.require_media_approval !== 'false';
    body.innerHTML = `
      <section class="admin-card">
        <div class="admin-toolbar">
          <div class="admin-toolbar-title">⚙️ Admin settings</div>
          <button class="admin-tool" id="adminRefresh" type="button">↻ Refresh</button>
        </div>
        <div class="admin-setting">
          <div>
            <div class="admin-setting-name">Review profile pictures and videos</div>
            <div class="admin-setting-desc">New profile pictures and covers wait for an admin before they appear on the profile.</div>
          </div>
          <button class="admin-switch${approval ? ' on' : ''}" id="adminApprovalToggle" type="button" role="switch" aria-checked="${approval}" aria-label="Require profile media approval"><i></i></button>
        </div>
        <div class="admin-setting">
          <div>
            <div class="admin-setting-name">Message moderation</div>
            <div class="admin-setting-desc">Admins can read every message from the Messages tab and delete a message from all devices.</div>
          </div>
          <span class="admin-badge admin-badge-active">Always on</span>
        </div>
      </section>`;

    body.querySelector('#adminRefresh').addEventListener('click', refresh);
    body.querySelector('#adminApprovalToggle').addEventListener('click', async () => {
      const next = approval ? 'false' : 'true';
      try {
        const { error } = await sb.rpc('admin_set_setting', {
          p_admin_id: me.id, p_key: 'require_media_approval', p_value: next
        });
        if (error) throw error;
        state.settings.require_media_approval = next;
        showToast(next === 'true' ? 'Media approval is on' : 'Media approval is off — new media goes live at once', 'success');
        renderBody();
      } catch (e) {
        toastError(e);
      }
    });
  }

  // ===================== My profile =====================

  function renderMyProfile(body) {
    body.innerHTML = `
      <section class="admin-card admin-me-card">
        ${avatarHtml(me, 'admin-avatar-lg')}
        <h2>${fbEscape(nameOf(me))}</h2>
        <p class="admin-handle">@${fbEscape(me.username || '')} · Administrator</p>
        <p class="admin-hint">Signed in with the administrator account. Every action on this panel is done as this member.</p>
        <div class="admin-me-actions">
          <a class="admin-approve" href="#/App/Profile">Open my profile</a>
          <a class="admin-tool" href="#/App">Back to app</a>
        </div>
      </section>`;
  }

  // ===================== Export =====================

  function exportCsv() {
    const rows = [['username', 'full_name', 'role', 'status', 'pending_media', 'joined']];
    state.users.forEach(u => {
      rows.push([
        u.username || '',
        u.full_name || '',
        u.role || 'member',
        statusOf(u),
        pendingKinds(u).join(' '),
        u.created_at || ''
      ]);
    });
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'members-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Members exported', 'success');
  }

  // ===================== Access gate =====================

  function renderDenied(el, adminCount) {
    el.innerHTML = `
      <div class="admin-page">
        <div class="admin-wrap">
          <section class="admin-denied">
            <span class="admin-shield big" aria-hidden="true">🛡️</span>
            <h1>Admin access only</h1>
            <p>You are signed in as <strong>@${fbEscape(me.username || '')}</strong>. Only an administrator can approve profile media and read member messages.</p>
            ${adminCount === 0
              ? `<button class="admin-approve" id="adminClaim" type="button">Make me the first admin</button>
                 <p class="admin-hint">No admin exists yet, so the first account can claim the role once.</p>`
              : '<p class="admin-hint">Ask an existing admin to give your account the admin role.</p>'}
            <a class="admin-tool" href="#/App">← Back to app</a>
          </section>
        </div>
      </div>`;

    const claim = el.querySelector('#adminClaim');
    if (claim) {
      claim.addEventListener('click', async () => {
        try {
          claim.disabled = true;
          const { error } = await sb.rpc('admin_claim', { p_user_id: me.id });
          if (error) throw error;
          me.role = 'admin';
          if (Auth.currentUser) {
            Auth.currentUser.role = 'admin';
            localStorage.setItem('chookee_user', JSON.stringify(Auth.currentUser));
          }
          await loadAll();
          renderPage(el);
        } catch (e) {
          claim.disabled = false;
          toastError(e);
        }
      });
    }
  }

  Pages.admin = async function (el) {
    me = Auth.currentUser;
    if (!me) {
      // Stay on #/Admin so the claim option is discoverable instead of bouncing to Login
      el.innerHTML = `
        <div class="admin-page">
          <div class="admin-wrap">
            <section class="admin-denied">
              <span class="admin-shield big" aria-hidden="true">🛡️</span>
              <h1>Admin access only</h1>
              <p>Log in first — while no admin exists, the first account can claim the admin role.</p>
              <a class="admin-approve" href="#/Login">Log in</a>
              <a class="admin-tool" href="#/App">← Back to app</a>
            </section>
          </div>
        </div>`;
      return;
    }
    if (!sb) {
      el.innerHTML = `<div class="admin-page"><div class="admin-wrap"><section class="admin-denied">
        <h1>Admin panel needs the database</h1>
        <p>Connect Supabase to use admin controls.</p>
        <a class="admin-tool" href="#/App">← Back to app</a>
      </section></div></div>`;
      return;
    }

    el.innerHTML = '<div class="admin-page"><div class="admin-wrap"><div class="loading" style="padding:3rem;text-align:center;">Loading admin panel…</div></div></div>';
    let adminCount = 0;
    try {
      let res = await sb.from('users').select('id, role, status, deleted_at').eq('role', 'admin');
      if (res.error) {
        res = await sb.from('users').select('id, role').eq('role', 'admin');
      }
      const admins = (res.data || []).filter(a => !a.deleted_at && a.status !== 'suspended');
      adminCount = admins.length;
      const isAdmin = admins.some(a => String(a.id) === String(me.id));
      if (!isAdmin) {
        renderDenied(el, adminCount);
        return;
      }
    } catch (e) {
      toastError(e);
    }

    await loadAll();
    renderPage(el);
  };
})();

window.Pages = Pages;
