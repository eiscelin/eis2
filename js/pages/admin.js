// Admin panel — approve profile media, moderate every message and manage members
var Pages = window.Pages || {};

(function () {
  const state = {
    tab: 'members',
    users: [],
    messages: [],
    announcements: [],
    reactionMedia: [],
    reactionUses: [],
    ads: [],
    adsMissing: false,
    settings: {},
    search: '',
    showDeleted: false,
    profileMemberId: null,
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

  function adsPending() {
    return state.ads.filter(a => a.status === 'pending').length;
  }

  // Reactions a member uploaded themselves, shown on their row so an admin
  // always sees who owns each one
  function reactionsOf(u) {
    const owned = state.reactionMedia.filter(m => String(m.user_id) === String(u.id));
    if (owned.length) return owned.map(m => ({ url: m.url, kind: m.kind }));
    const seen = new Map();
    state.reactionUses
      .filter(r => r.user_id === String(u.id))
      .forEach(r => {
        const type = String(r.type || '');
        const url = type.replace(/^(face|vid):/, '');
        if (url && !seen.has(url)) seen.set(url, { url, kind: type.indexOf('vid:') === 0 ? 'video' : 'face' });
      });
    return Array.from(seen.values());
  }

  function reactionChips(u) {
    const media = reactionsOf(u);
    if (!media.length) return '';
    const name = nameOf(u);
    const thumbs = media.slice(0, 4).map(m => (m.kind === 'video' || isVideoUrl(m.url)
      ? `<video class="admin-rx-thumb" src="${fbEscape(m.url)}" muted playsinline preload="metadata" title="Video reaction · ${fbEscape(name)}"></video>`
      : `<img class="admin-rx-thumb" src="${fbEscape(m.url)}" alt="Face reaction of ${fbEscape(name)}" title="Face reaction · ${fbEscape(name)}">`
    )).join('');
    return `<div class="admin-rx" title="${fbEscape(`${name} uploaded ${media.length} own reaction${media.length === 1 ? '' : 's'}`)}">
      ${thumbs}${media.length > 4 ? `<span class="admin-rx-more">+${media.length - 4}</span>` : ''}
      <span class="admin-rx-label">own reaction${media.length === 1 ? '' : 's'}</span>
    </div>`;
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
    if (/target_user_id|target_post_id|target_label/i.test(message)) {
      return showToast('Run 027_ad_targeting.sql in Supabase, then try again', 'error', 6000);
    }
    if (/admin_review_ad|admin_set_ad_active|public\.ads|relation "ads"|table 'public\.ads'/i.test(message)) {
      return showToast('Run 026_create_ads.sql in Supabase, then try again', 'error', 6000);
    }
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

  // The ads table only exists after 026_create_ads.sql has been run, so a
  // missing table is remembered instead of breaking the whole panel
  async function loadAds() {
    try {
      const { data, error } = await sb.from('ads').select('*').order('created_at', { ascending: false });
      state.adsMissing = !!error && /could not find|does not exist|schema cache|relation/i.test(error.message || '');
      return error ? [] : (data || []);
    } catch {
      state.adsMissing = true;
      return [];
    }
  }

  async function loadAll() {
    const [users, messages, announcements, settings, reactionMedia, uses, ads] = await Promise.all([
      rows(sb.from('users').select('*').order('created_at', { ascending: false })),
      rows(sb.from('chat_messages').select('*').order('created_at', { ascending: false }).limit(1000)),
      rows(sb.from('announcements').select('*').order('created_at', { ascending: false })),
      rows(sb.from('app_settings').select('*')),
      rows(sb.from('reaction_media').select('*').order('created_at', { ascending: true })),
      rows(sb.from('post_reactions').select('user_id, type').order('created_at', { ascending: false }).limit(2000)),
      loadAds()
    ]);
    state.users = users;
    state.messages = messages;
    state.announcements = announcements;
    state.reactionMedia = reactionMedia;
    state.ads = ads;
    // Before the upload table exists, the reactions a member used still show
    // who they belong to
    state.reactionUses = uses.filter(r => /^(face|vid):/.test(String(r.type)));
    state.reactionUses.forEach(r => { r.user_id = String(r.user_id); });
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

  // One admin switch: flip the stored value, then repaint the panel
  function bindSwitch(body, selector, key, onMsg, offMsg, migration) {
    const el = body.querySelector(selector);
    if (!el) return;
    el.addEventListener('click', async () => {
      const next = el.getAttribute('aria-checked') === 'true' ? 'false' : 'true';
      try {
        const { error } = await sb.rpc('admin_set_setting', {
          p_admin_id: me.id, p_key: key, p_value: next
        });
        if (error) throw new Error(migration && /Unknown setting/.test(error.message)
          ? `Run ${migration} in Supabase, then try again`
          : error.message);
        state.settings[key] = next;
        showToast(next === 'true' ? onMsg : offMsg, 'success');
        renderBody();
      } catch (e) {
        toastError(e);
      }
    });
  }

  // ===================== Page shell =====================

  function renderPage(el) {
    rootEl = el;
    const brand = fbBrand();
    const tabs = [
      { id: 'members', label: `Members (${memberCount()})` },
      { id: 'approvals', label: `Approvals (${pendingTotal()})` },
      { id: 'ads', label: `Ads${adsPending() ? ` (${adsPending()})` : ''}` },
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
                <p>Approve profile media and ads, read messages and manage ${fbEscape(brand.name)} members</p>
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
    // The customer service button docks into this page's header row
    if (window.SupportWidget && window.SupportWidget.refresh) window.SupportWidget.refresh();
  }

  function renderBody() {
    const body = rootEl.querySelector('#adminBody');
    if (!body) return;
    if (state.tab === 'members') return renderMembers(body);
    if (state.tab === 'approvals') return renderApprovals(body);
    if (state.tab === 'ads') return renderAds(body);
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
            ${reactionChips(u)}
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

  // ===================== Ads =====================

  function adStatusBadge(ad) {
    if (ad.status === 'pending') return '<span class="admin-badge admin-badge-pending">Pending review</span>';
    if (ad.status === 'rejected') return '<span class="admin-badge admin-badge-rejected">Rejected</span>';
    return ad.is_active
      ? `<span class="admin-badge admin-badge-active">${isCoverAd(ad) ? 'Live on profile covers' : 'Live in videos'}</span>`
      : '<span class="admin-badge admin-badge-suspended">Paused</span>';
  }

  function adTargetLabel(ad) {
    if (ad.target_label) return ad.target_label;
    if (ad.target_post_id) return 'One specific video';
    if (ad.target_user_id) return isCoverAd(ad) ? "One member's cover" : "One member's videos";
    return isCoverAd(ad) ? 'All profile covers' : 'All member videos';
  }

  function isCoverAd(ad) {
    return String(ad.media_type || '').indexOf('cover') === 0;
  }

  function adPlacementLabel(ad) {
    return isCoverAd(ad) ? '🖼️ Profile cover' : '🎬 Inside videos';
  }

  function adCard(ad) {
    const isVideo = /video$/.test(String(ad.media_type || ''));
    const acts = [];
    if (ad.status !== 'approved') {
      acts.push(`<button class="admin-approve" type="button" data-ad-review="approve" data-ad="${fbEscape(ad.id)}">✓ Approve</button>`);
    }
    if (ad.status !== 'rejected') {
      acts.push(`<button class="admin-reject" type="button" data-ad-review="reject" data-ad="${fbEscape(ad.id)}">✕ Reject</button>`);
    }
    if (ad.status === 'approved') {
      acts.push(`<button class="admin-tool" type="button" data-ad-active="${ad.is_active ? 'pause' : 'play'}" data-ad="${fbEscape(ad.id)}">${ad.is_active ? '⏸ Pause' : '▶️ Resume'}</button>`);
    }
    acts.push(`<button class="admin-act delete" type="button" data-del-ad="${fbEscape(ad.id)}" title="Delete ad">🗑️</button>`);

    return `<article class="admin-ad" data-ad-id="${fbEscape(ad.id)}">
      <div class="admin-ad-media">
        ${isVideo
          ? `<video src="${fbEscape(ad.media_url)}" controls muted playsinline preload="metadata"></video>`
          : `<img src="${fbEscape(ad.media_url)}" alt="${fbEscape(ad.title || 'Ad')}">`}
      </div>
      <div class="admin-ad-body">
        <div class="admin-ad-title">${fbEscape(ad.title || 'Untitled ad')}</div>
        <div class="admin-ad-meta">${adStatusBadge(ad)}
          <span class="admin-badge admin-badge-target">${fbEscape(adPlacementLabel(ad))}</span>
          <span class="admin-badge admin-badge-target">🎯 ${fbEscape(adTargetLabel(ad))}</span>
          <span class="admin-handle">${isVideo ? 'Video ad' : 'Image ad'} · ${fbEscape(fmtWhen(ad.created_at))}</span>
        </div>
        <div class="admin-ad-actions">${acts.join('')}</div>
      </div>
    </article>`;
  }

  function renderAds(body) {
    const adsOn = state.settings.video_ads !== 'false';
    const live = state.ads.filter(a => a.status === 'approved' && a.is_active).length;
    const pending = adsPending();
    let pickedAdFile = null;

    body.innerHTML = `
      <section class="admin-card">
        <div class="admin-toolbar">
          <div class="admin-toolbar-title">📺 Ads (${live} live)</div>
          <button class="admin-tool" id="adminRefresh" type="button">↻ Refresh</button>
        </div>
        <div class="admin-setting">
          <div>
            <div class="admin-setting-name">Ad breaks inside member videos</div>
            <div class="admin-setting-desc">A few seconds into a member's video an approved ad suddenly covers it. The member's video pauses while the ad plays and continues from where it stopped.</div>
          </div>
          <button class="admin-switch${adsOn ? ' on' : ''}" id="adminVideoAdsToggle" type="button" role="switch" aria-checked="${adsOn}" aria-label="Play ads inside member videos"><i></i></button>
        </div>
        <div class="admin-compose">
          <input id="adminAdTitle" type="text" placeholder="Ad name (e.g. Summer sale)" aria-label="Ad name">
          <div class="admin-ad-target">
            <select id="adminAdPlacement" aria-label="Where this ad is inserted">
              <option value="video">Insert inside member videos</option>
              <option value="cover">Insert on member profile covers</option>
            </select>
            <select id="adminAdScope" aria-label="Where this ad plays">
              <option value="all">Play in all member videos</option>
              <option value="user">Play in all videos from one member</option>
              <option value="video">Play in one specific video</option>
            </select>
            <select id="adminAdUser" aria-label="Member whose videos play this ad" hidden></select>
            <select id="adminAdPost" aria-label="The video that plays this ad" hidden></select>
          </div>
          <input id="adminAdFile" type="file" accept="image/*,video/*" hidden>
          <div class="admin-compose-foot">
            <button class="admin-tool" id="adminAdPick" type="button">🎞 Choose image or video</button>
            <span class="admin-hint admin-ad-pick-label" id="adminAdFileLabel">No file chosen</span>
            <button class="admin-approve" id="adminAdUpload" type="button">Upload ad</button>
          </div>
        </div>
        ${state.adsMissing ? '<p class="admin-hint">Run <code>026_create_ads.sql</code> and <code>027_ad_targeting.sql</code> in your Supabase SQL Editor to create the ads table, then refresh.</p>' : ''}
        ${pending ? `<p class="admin-hint">${pending} ad${pending === 1 ? '' : 's'} waiting for your review.</p>` : ''}
        <div id="adminAdList" class="admin-ads">
          ${state.ads.length ? state.ads.map(adCard).join('') : `<div class="admin-empty">${emptyState('📺', 'No ads yet. Upload an image or video above to start an ad break.')}</div>`}
        </div>
      </section>`;

    body.querySelector('#adminRefresh').addEventListener('click', refresh);
    bindSwitch(body, '#adminVideoAdsToggle', 'video_ads',
      'Ad breaks are on', 'Ad breaks are off — member videos play without ads',
      '026_create_ads.sql');
    const adsSwitch = body.querySelector('#adminVideoAdsToggle');
    if (adsSwitch) adsSwitch.addEventListener('click', () => { if (window.Ads) window.Ads.refresh(); });

    const fileInput = body.querySelector('#adminAdFile');
    const fileLabel = body.querySelector('#adminAdFileLabel');
    body.querySelector('#adminAdPick').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      pickedAdFile = (fileInput.files && fileInput.files[0]) || null;
      fileLabel.textContent = pickedAdFile
        ? pickedAdFile.name
        : 'No file chosen';
    });

    // Where the ad plays: every member video, one member's videos, or one video
    // A cover ad is inserted on profile covers instead of inside videos
    const placementSel = body.querySelector('#adminAdPlacement');
    const scopeSel = body.querySelector('#adminAdScope');
    const userSel = body.querySelector('#adminAdUser');
    const postSel = body.querySelector('#adminAdPost');
    const members = state.users.filter(u => statusOf(u) !== 'deleted');
    userSel.innerHTML = members.map(u =>
      `<option value="${fbEscape(u.id)}">${fbEscape(nameOf(u))}${u.username ? ` (@${fbEscape(u.username)})` : ''}</option>`
    ).join('');
    let memberVideos = [];

    function videoPostLabel(post) {
      const text = String(post.content || '').trim().replace(/\s+/g, ' ').slice(0, 50);
      return `${text || `Video #${post.id}`} · ${fmtWhen(post.created_at)}`;
    }

    async function fillMemberVideos() {
      memberVideos = [];
      postSel.innerHTML = '<option value="">Loading videos…</option>';
      if (!userSel.value) return;
      const { data } = await sb.from('posts')
        .select('id, content, created_at')
        .eq('user_id', Number(userSel.value))
        .eq('media_type', 'video')
        .order('created_at', { ascending: false })
        .limit(100);
      memberVideos = data || [];
      postSel.innerHTML = memberVideos.length
        ? memberVideos.map(p => `<option value="${fbEscape(p.id)}">${fbEscape(videoPostLabel(p))}</option>`).join('')
        : '<option value="">This member has no uploaded videos</option>';
    }

    function syncScope() {
      const scope = scopeSel.value;
      userSel.hidden = scope === 'all';
      postSel.hidden = scope !== 'video';
    }

    function syncPlacement() {
      const onCover = placementSel.value === 'cover';
      const videoOpt = scopeSel.querySelector('option[value="video"]');
      videoOpt.hidden = onCover;
      videoOpt.disabled = onCover;
      if (onCover && scopeSel.value === 'video') scopeSel.value = 'all';
      scopeSel.options[0].textContent = onCover ? 'Play on all profile covers' : 'Play in all member videos';
      scopeSel.options[1].textContent = onCover ? "Play on one member's cover" : 'Play in all videos from one member';
      syncScope();
    }

    scopeSel.addEventListener('change', () => {
      syncScope();
      if (scopeSel.value !== 'all') fillMemberVideos();
    });
    placementSel.addEventListener('change', syncPlacement);
    userSel.addEventListener('change', () => {
      if (scopeSel.value !== 'all') fillMemberVideos();
    });
    syncPlacement();

    body.querySelector('#adminAdUpload').addEventListener('click', async () => {
      if (state.adsMissing) return showToast('Run 026_create_ads.sql in Supabase, then try again', 'error', 6000);
      if (!pickedAdFile) return showToast('Choose an ad image or video first', 'error');
      const isVideo = String(pickedAdFile.type || '').startsWith('video/');
      if (isVideo && pickedAdFile.size > 100 * 1024 * 1024) return showToast('Videos must be 100 MB or smaller', 'error', 5000);
      if (!isVideo && pickedAdFile.size > 20 * 1024 * 1024) return showToast('Photos must be 20 MB or smaller', 'error', 5000);

      const scope = scopeSel.value;
      const onCover = placementSel.value === 'cover';
      const target = {
        target_user_id: null,
        target_post_id: null,
        target_label: onCover ? 'All profile covers' : 'All member videos'
      };
      if (scope !== 'all') {
        const member = members.find(u => String(u.id) === String(userSel.value));
        if (!member) return showToast(onCover ? "Choose the member whose cover plays this ad" : 'Choose the member whose videos play this ad', 'error');
        target.target_user_id = member.id;
        target.target_label = onCover ? `${nameOf(member)} · profile cover` : `${nameOf(member)} · all their videos`;
        if (scope === 'video') {
          const post = memberVideos.find(p => String(p.id) === String(postSel.value));
          if (!post) return showToast('Choose the video that plays this ad', 'error');
          target.target_post_id = post.id;
          target.target_label = `${nameOf(member)} · ${videoPostLabel(post)}`;
        }
      }

      const btn = body.querySelector('#adminAdUpload');
      btn.disabled = true;
      btn.textContent = 'Uploading…';
      try {
        const payload = isVideo ? pickedAdFile : await shrinkImage(pickedAdFile, 1600).catch(() => pickedAdFile);
        const url = await cloudinaryUpload(payload);
        if (!url) throw new Error('image hosting is not connected');
        const title = body.querySelector('#adminAdTitle').value.trim();
        const { error } = await sb.from('ads').insert([{
          title: title || 'Sponsored',
          media_url: url,
          media_type: (onCover ? 'cover_' : '') + (isVideo ? 'video' : 'image'),
          status: 'pending',
          is_active: true,
          created_by: me.id,
          ...target
        }]);
        if (error) throw error;
        showToast('Ad uploaded — approve it to start the ad break', 'success');
        await refresh();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Upload ad';
        toastError(e);
      }
    });

    body.querySelectorAll('[data-ad-review]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const approve = btn.dataset.adReview === 'approve';
        btn.disabled = true;
        try {
          const { error } = await sb.rpc('admin_review_ad', {
            p_admin_id: me.id, p_ad_id: Number(btn.dataset.ad), p_approve: approve
          });
          if (error) throw error;
          showToast(approve ? 'Ad approved — it now plays in member videos' : 'Ad rejected', 'success');
          if (window.Ads) window.Ads.refresh();
          await refresh();
        } catch (e) {
          btn.disabled = false;
          toastError(e);
        }
      });
    });

    body.querySelectorAll('[data-ad-active]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const play = btn.dataset.adActive === 'play';
        btn.disabled = true;
        try {
          const { error } = await sb.rpc('admin_set_ad_active', {
            p_admin_id: me.id, p_ad_id: Number(btn.dataset.ad), p_active: play
          });
          if (error) throw error;
          showToast(play ? 'Ad is back in the rotation' : 'Ad paused', 'success');
          if (window.Ads) window.Ads.refresh();
          await refresh();
        } catch (e) {
          btn.disabled = false;
          toastError(e);
        }
      });
    });

    body.querySelectorAll('[data-del-ad]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this ad?')) return;
        try {
          const { error } = await sb.from('ads').delete().eq('id', btn.dataset.delAd);
          if (error) throw error;
          showToast('Ad deleted', 'success');
          if (window.Ads) window.Ads.refresh();
          await refresh();
        } catch (e) {
          toastError(e);
        }
      });
    });
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
              <strong>${fbEscape(sender ? nameOf(sender) : (String(m.sender_id || '').startsWith('guest:') ? '@' + String(m.sender_id).slice(6) : 'Unknown'))}</strong>
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
    const overlayBtn = state.settings.overlay_button !== 'false';
    const coverVideo = state.settings.cover_video !== 'false';
    const videoPosts = state.settings.video_posts !== 'false';
    const guestSend = state.settings.guest_chat_send !== 'false';
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
            <div class="admin-setting-name">Profile overlay button</div>
            <div class="admin-setting-desc">The Overlay button lets members lay a photo or clip over their profile. Turn it off and the button disappears from every profile.</div>
          </div>
          <button class="admin-switch${overlayBtn ? ' on' : ''}" id="adminOverlayToggle" type="button" role="switch" aria-checked="${overlayBtn}" aria-label="Show the profile overlay button"><i></i></button>
        </div>
        <div class="admin-setting">
          <div>
            <div class="admin-setting-name">Video profile covers</div>
            <div class="admin-setting-desc">Members can use a cover video up to 30 seconds long. Turn it off and a cover accepts pictures only.</div>
          </div>
          <button class="admin-switch${coverVideo ? ' on' : ''}" id="adminCoverVideoToggle" type="button" role="switch" aria-checked="${coverVideo}" aria-label="Allow uploaded cover videos"><i></i></button>
        </div>
        <div class="admin-setting">
          <div>
            <div class="admin-setting-name">Video posts</div>
            <div class="admin-setting-desc">Members can attach a video to a post. Turn it off and the Video button disappears from every composer.</div>
          </div>
          <button class="admin-switch${videoPosts ? ' on' : ''}" id="adminVideoPostToggle" type="button" role="switch" aria-checked="${videoPosts}" aria-label="Allow video posts"><i></i></button>
        </div>
        <div class="admin-setting">
          <div>
            <div class="admin-setting-name">Guest sending in group chats</div>
            <div class="admin-setting-desc">Guests who join a group through an invite link can send links, photos, videos, files and text replies. Turn it off and a guest device can read what is shared but not send.</div>
          </div>
          <button class="admin-switch${guestSend ? ' on' : ''}" id="adminGuestSendToggle" type="button" role="switch" aria-checked="${guestSend}" aria-label="Allow guests to send in group chats"><i></i></button>
        </div>
        <div class="admin-setting">
          <div>
            <div class="admin-setting-name">Message moderation</div>
            <div class="admin-setting-desc">Admins can read every message from the Messages tab and delete a message from all devices.</div>
          </div>
          <span class="admin-badge admin-badge-active">Always on</span>
        </div>
      </section>

      <section class="admin-card" id="adminStorage">
        <div class="admin-toolbar">
          <div class="admin-toolbar-title">☁️ Storage</div>
          <span class="admin-badge" id="driveBadge">Checking…</span>
        </div>
        <div class="admin-setting">
          <div>
            <div class="admin-setting-name">Google Drive</div>
            <div class="admin-setting-desc">New photos and videos are saved in your own Google account, so they use your Google One storage. Cloudinary is the fallback when Drive is not connected.</div>
          </div>
        </div>
        <div id="driveBody"></div>
      </section>`;

    body.querySelector('#adminRefresh').addEventListener('click', refresh);

    bindSwitch(body, '#adminApprovalToggle', 'require_media_approval',
      'Media approval is on', 'Media approval is off — new media goes live at once');
    bindSwitch(body, '#adminOverlayToggle', 'overlay_button',
      'Overlay button is on', 'Overlay button is hidden from profiles',
      '020_add_overlay_button_setting.sql');
    bindSwitch(body, '#adminCoverVideoToggle', 'cover_video',
      'Members can use a cover video', 'Cover pictures only — video covers are off',
      '021_add_cover_video_and_video_post_settings.sql');
    bindSwitch(body, '#adminVideoPostToggle', 'video_posts',
      'Members can post videos', 'Video posts are off — the Video button is gone',
      '021_add_cover_video_and_video_post_settings.sql');
    bindSwitch(body, '#adminGuestSendToggle', 'guest_chat_send',
      'Guests can send in group chats', 'Guest sending is off — guests can read only',
      '024_add_guest_chat_setting.sql');

    renderStorageCard(body);
  }

  // Google Drive storage — the account is connected and held by the app server
  async function renderStorageCard(body) {
    const badge = body.querySelector('#driveBadge');
    const target = body.querySelector('#driveBody');
    if (!badge || !target) return;
    let status = { configured: false, connected: false };
    try {
      const res = await fetch('/api/drive/status');
      if (res.ok) status = await res.json();
    } catch { /* a server without Drive support */ }
    badge.textContent = status.connected ? 'Connected' : 'Not connected';
    badge.className = 'admin-badge ' + (status.connected ? 'admin-badge-active' : 'admin-badge-pending');

    if (status.connected) {
      target.innerHTML = `
        <p class="admin-hint">Uploads are saved in ${fbEscape(status.email || 'your Google Drive')}.</p>
        <div class="admin-me-actions">
          <button class="admin-tool" id="driveDisconnect" type="button">Disconnect Google Drive</button>
        </div>`;
      target.querySelector('#driveDisconnect').addEventListener('click', async () => {
        if (!confirm('Stop saving uploads to Google Drive?')) return;
        try {
          const res = await fetch('/api/drive/disconnect', { method: 'POST' });
          if (!res.ok) throw new Error('Could not disconnect Google Drive');
          showToast('Google Drive disconnected', 'success');
        } catch (e) {
          showToast(e.message || 'Could not disconnect Google Drive', 'error');
        }
        renderStorageCard(body);
      });
      return;
    }

    if (!status.configured) {
      const redirectUri = status.redirectUri || location.origin + '/oauth/google/callback';
      target.innerHTML = `
        <p class="admin-hint">Google sign-in is not set up yet. In Google Cloud Console, enable the Google Drive API and create an OAuth client of type “Web application”, add this authorized redirect URI, then set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for the app:</p>
        <p class="admin-hint"><code class="admin-redirect">${fbEscape(redirectUri)}</code></p>`;
      return;
    }

    // Vercel keeps no disk, so the connection needs a place to be saved
    if (status.store === false) {
      target.innerHTML = `
        <p class="admin-hint">Add SUPABASE_SERVICE_ROLE_KEY to your hosting environment variables so the connection can be saved, then reload this page.</p>`;
      return;
    }

    target.innerHTML = `
      <p class="admin-hint">Sign in with the Google account whose storage you want to use. Only the files this app creates are visible to it.</p>
      <div class="admin-me-actions">
        <a class="admin-approve" href="/oauth/google/start">Connect Google Drive</a>
      </div>`;
  }

  // ===================== My profile =====================

  function renderMyProfile(body) {
    const picked = state.users.find(u => String(u.id) === String(state.profileMemberId)) || null;
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
      </section>

      <section class="admin-card mp-card">
        <h3 class="pi-title">Search a member</h3>
        <p class="admin-hint">Find any member by name or username to open their details.</p>
        <div id="adminMemberPicker"></div>
        ${picked ? `<div class="mp-selected-head">
          <span>Showing details for <strong>${fbEscape(nameOf(picked))}</strong> (@${fbEscape(picked.username || '')})</span>
          <button class="mp-back" id="mpBack" type="button">Back to my details</button>
        </div>` : ''}
      </section>

      <div id="adminMeInfo" class="admin-me-info"></div>`;

    if (window.AdminMemberPicker) {
      AdminMemberPicker.render(body.querySelector('#adminMemberPicker'), {
        users: state.users.filter(u => statusOf(u) !== 'deleted'),
        selectedId: picked ? picked.id : '',
        onSelect: (user) => {
          state.profileMemberId = user.id;
          renderBody();
        }
      });
    }

    const back = body.querySelector('#mpBack');
    if (back) back.addEventListener('click', () => {
      state.profileMemberId = null;
      renderBody();
    });

    // The same Personal Information form the member sees on My Profile
    if (window.PersonalInfo) {
      PersonalInfo.render(body.querySelector('#adminMeInfo'), picked || me, {
        onSaved: picked ? null : renderBody
      });
    }
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

    // Coming back from Google: open the storage card and say what happened
    const driveResult = new URLSearchParams(location.search).get('drive');
    if (driveResult) {
      history.replaceState(null, '', location.pathname + location.hash);
      state.tab = 'settings';
      if (driveResult === 'connected') showToast('Google Drive connected', 'success');
      else if (driveResult === 'error') showToast('Google Drive was not connected', 'error', 6000);
    }

    await loadAll();
    renderPage(el);
  };
})();

window.Pages = Pages;
