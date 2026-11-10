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
      <div id="feedList"></div>
    </div>
  `;

  const list = main.querySelector('#feedList');
  const input = main.querySelector('#feedInput');
  let posts = [];

  function renderPosts(query) {
    const q = query || '';
    const shown = posts.filter(p => !q || `${p.title || ''} ${p.content || ''}`.toLowerCase().includes(q));
    list.innerHTML = shown.length
      ? shown.map(p => `
        <article class="fb-card fb-post">
          <div class="fb-post-head">
            ${fbBrandAvatar()}
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
  loadPosts();
};

window.Pages = Pages;
