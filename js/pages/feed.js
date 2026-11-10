// Home tab — post composer + the shared feed
var Pages = window.Pages || {};

Pages.feedTab = function (main, user) {
  const brand = fbBrand();
  const name = user.full_name || user.username;
  const firstName = String(name).split(' ')[0];

  main.innerHTML = `
    <div class="fb-feed">
      <section class="fb-card fb-composer-card">
        <div class="fb-composer">
          ${fbAvatar(name, 'fb-avatar-sm')}
          <input id="feedInput" type="text" placeholder="What's on your mind, ${fbEscape(firstName)}?" aria-label="Write a post">
        </div>
        <div class="fb-composer-foot">
          <button class="fb-btn fb-btn-primary" id="feedPostBtn" type="button">Post</button>
        </div>
      </section>
      <section class="fb-card fb-stories-card" aria-label="Stories">
        <div class="fb-stories" id="storyRow"></div>
      </section>
      <div id="feedList"></div>
    </div>
  `;

  const list = main.querySelector('#feedList');
  const input = main.querySelector('#feedInput');
  const storyRow = main.querySelector('#storyRow');
  let posts = [];

  // Story cards stand in for photos with a gradient cover per member
  const STORY_ART = [
    ['#1877f2', '#0a2f6b'],
    ['#8b5cf6', '#2e1065'],
    ['#f97316', '#7c2d12'],
    ['#10b981', '#064e3b'],
    ['#ec4899', '#500724'],
    ['#06b6d4', '#083344']
  ];

  function renderStories(people) {
    storyRow.innerHTML = `
      <div class="fb-story fb-story-create">
        <div class="fb-story-thumb">${fbAvatar(name, 'fb-story-thumb-pic')}</div>
        <span class="fb-story-plus" aria-hidden="true">+</span>
        <span class="fb-story-create-label">Create story</span>
      </div>
      ${people.map((p, i) => {
        const pname = p.full_name || p.username || 'Member';
        const art = STORY_ART[i % STORY_ART.length];
        return `<div class="fb-story">
          <div class="fb-story-media" style="background: radial-gradient(circle at 72% 18%, rgba(255, 255, 255, 0.3), transparent 55%), linear-gradient(165deg, ${art[0]}, ${art[1]})"></div>
          <span class="fb-story-badge">${fbAvatar(pname, 'fb-story-badge-avatar')}</span>
          <div class="fb-story-name">${fbEscape(pname)}</div>
        </div>`;
      }).join('')}
    `;
  }

  async function loadStories() {
    if (!sb) return;
    try {
      const { data } = await sb.from('users').select('*').order('username', { ascending: true });
      renderStories((data || []).filter(u => String(u.id) !== String(user.id)));
    } catch {
      renderStories([]);
    }
  }

  function renderPosts(query) {
    const q = query || '';
    const shown = posts.filter(p => !q || `${p.title || ''} ${p.content || ''}`.toLowerCase().includes(q));
    list.innerHTML = shown.length
      ? shown.map(p => `
        <article class="fb-card fb-post">
          <div class="fb-post-head">
            <span class="fb-avatar">${fbEscape(brand.initial)}</span>
            <div>
              <div class="fb-post-name">${fbEscape(brand.name)}</div>
              <div class="fb-post-time">${fbEscape(fmtDate(p.date || p.created_at))} · 🌐</div>
            </div>
          </div>
          <div class="fb-post-body">
            ${p.priority === 'high' ? '<span class="fb-post-tag">IMPORTANT</span>' : ''}
            <strong>${fbEscape(p.title || 'Post')}</strong>
            ${fbEscape(p.content || '')}
          </div>
        </article>`).join('')
      : `<div class="fb-card">${emptyState('📝', q ? 'No posts match your search.' : 'No posts yet. Share something first!')}</div>`;
  }

  async function loadPosts() {
    if (!sb) { posts = []; renderPosts(); return; }
    list.innerHTML = '<div class="fb-card"><div class="loading">Loading…</div></div>';
    try {
      const { data } = await sb.from('announcements').select('*').order('created_at', { ascending: false });
      posts = data || [];
    } catch {
      posts = [];
    }
    renderPosts();
  }

  async function submitPost() {
    const content = input.value.trim();
    if (!content) return showToast('Write something first', 'error');
    if (!sb) return showToast('Posting needs a connected database', 'error');
    try {
      await sb.from('announcements').insert([{
        title: content.length > 60 ? content.slice(0, 60) + '…' : content,
        content,
        priority: 'normal',
        is_active: true
      }]);
      input.value = '';
      showToast('Posted', 'success');
      loadPosts();
    } catch (e) {
      showToast('Failed to post: ' + e.message, 'error');
    }
  }

  main.querySelector('#feedPostBtn').addEventListener('click', submitPost);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitPost(); });

  window.__appSearchHandler = (q) => renderPosts(q);
  renderStories([]);
  loadStories();
  loadPosts();
};

window.Pages = Pages;
