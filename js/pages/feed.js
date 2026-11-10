// Home tab — My Day stories + post composer + the shared feed
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
  const storyFile = document.createElement('input');
  storyFile.type = 'file';
  storyFile.accept = 'image/*';
  storyFile.hidden = true;
  main.appendChild(storyFile);

  let posts = [];
  let storyGroups = [];
  let storyViewer = null;

  const initialOf = (value) => (String(value || '?').trim()[0] || '?').toUpperCase();

  // ---------- My Day stories ----------

  // One card per member; each member's stories play oldest first
  function groupStories(rows) {
    const groups = [];
    const byAuthor = new Map();
    rows.forEach(s => {
      const key = String(s.user_id || s.author_name || 'member');
      if (!byAuthor.has(key)) {
        const group = { name: s.author_name || 'Member', stories: [] };
        byAuthor.set(key, group);
        groups.push(group);
      }
      byAuthor.get(key).stories.push(s);
    });
    groups.forEach(g => g.stories.reverse());
    return groups;
  }

  function storyAge(createdAt) {
    const mins = Math.round((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (!isFinite(mins) || mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm';
    return Math.round(mins / 60) + 'h';
  }

  function renderStories(groups) {
    storyGroups = groups;
    storyRow.innerHTML = `
      <button class="fb-story fb-story-create" type="button" id="storyCreate" aria-label="Create story">
        <span class="fb-story-thumb">${fbAvatar(name, 'fb-story-thumb-pic')}</span>
        <span class="fb-story-plus" aria-hidden="true">+</span>
        <span class="fb-story-create-label">Create story</span>
      </button>
      ${groups.map((group, i) => {
        const cover = group.stories[group.stories.length - 1];
        return `<button class="fb-story fb-story-open" type="button" data-group="${i}" aria-label="View ${fbEscape(group.name)}'s story">
          <img class="fb-story-media" src="${fbEscape(cover.image)}" alt="">
          <span class="fb-story-badge">${fbAvatar(group.name, 'fb-story-badge-avatar')}</span>
          <span class="fb-story-name">${fbEscape(group.name)}</span>
        </button>`;
      }).join('')}
    `;
  }

  async function loadStories() {
    if (!sb) return;
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await sb.from('stories').select('*').gte('created_at', since).order('created_at', { ascending: false });
      renderStories(groupStories(data || []));
    } catch {
      renderStories([]);
    }
  }

  // Shrink the photo in the browser before saving it
  function imageToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('that file is not an image'));
      };
      img.src = objectUrl;
    });
  }

  async function addStory(file) {
    if (!sb) return showToast('Stories need a connected database', 'error');
    try {
      const image = await imageToDataUrl(file);
      const { error } = await sb.from('stories').insert([{
        user_id: user.id,
        author_name: name,
        image
      }]);
      if (error) throw error;
      showToast('Story added to your day', 'success');
      loadStories();
    } catch (e) {
      showToast('Could not add your story: ' + e.message, 'error');
    }
  }

  function closeStoryViewer() {
    if (!storyViewer) return;
    clearTimeout(storyViewer.timer);
    document.removeEventListener('keydown', storyViewer.keys);
    storyViewer.el.remove();
    storyViewer = null;
    document.body.style.overflow = '';
  }

  // Fullscreen story player: progress bars, tap sides to move, auto-advance
  function openStoryViewer(groups, startGroup) {
    closeStoryViewer();
    const items = [];
    groups.forEach((group, gi) => group.stories.forEach(story => items.push({ group, gi, story })));
    if (!items.length) return;

    const el = document.createElement('div');
    el.className = 'fb-story-viewer';
    el.innerHTML = `
      <div class="fb-story-frame">
        <div class="fb-story-bars" id="storyBars"></div>
        <div class="fb-story-head">
          <span class="fb-avatar fb-avatar-sm" id="storyHeadAvatar"></span>
          <div class="fb-story-head-text">
            <div class="fb-story-head-name" id="storyHeadName"></div>
            <div class="fb-story-head-time" id="storyHeadTime"></div>
          </div>
          <button class="fb-story-close" type="button" aria-label="Close story">✕</button>
        </div>
        <img class="fb-story-full" id="storyFull" alt="">
        <button class="fb-story-zone fb-story-zone-prev" type="button" aria-label="Previous story"></button>
        <button class="fb-story-zone fb-story-zone-next" type="button" aria-label="Next story"></button>
      </div>`;
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';

    const bars = el.querySelector('#storyBars');
    const full = el.querySelector('#storyFull');
    const headAvatar = el.querySelector('#storyHeadAvatar');
    const headName = el.querySelector('#storyHeadName');
    const headTime = el.querySelector('#storyHeadTime');

    const viewer = { el, timer: null, index: 0 };
    storyViewer = viewer;

    function show(index) {
      const item = items[index];
      if (!item) return closeStoryViewer();
      viewer.index = index;
      const position = item.group.stories.indexOf(item.story);
      bars.innerHTML = item.group.stories.map((_, i) =>
        `<span class="fb-story-bar${i < position ? ' filled' : i === position ? ' active' : ''}"><i></i></span>`
      ).join('');
      headAvatar.textContent = initialOf(item.group.name);
      headName.textContent = item.group.name;
      headTime.textContent = storyAge(item.story.created_at);
      full.src = item.story.image;
      clearTimeout(viewer.timer);
      const fill = bars.querySelector('.fb-story-bar.active i');
      if (fill) {
        fill.style.animation = 'none';
        void fill.offsetWidth;
        fill.style.animation = 'fbStoryFill 5s linear forwards';
      }
      viewer.timer = setTimeout(() => step(1), 5000);
    }

    function step(direction) {
      const next = viewer.index + direction;
      if (next < 0) return show(0);
      if (next >= items.length) return closeStoryViewer();
      show(next);
    }

    viewer.step = step;
    viewer.keys = (e) => {
      if (e.key === 'Escape') closeStoryViewer();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', viewer.keys);
    el.querySelector('.fb-story-close').addEventListener('click', closeStoryViewer);
    el.querySelector('.fb-story-zone-prev').addEventListener('click', () => step(-1));
    el.querySelector('.fb-story-zone-next').addEventListener('click', () => step(1));

    show(Math.max(0, items.findIndex(item => item.gi === startGroup)));
  }

  storyRow.addEventListener('click', (e) => {
    const open = e.target.closest('[data-group]');
    if (open) return openStoryViewer(storyGroups, Number(open.dataset.group));
    if (e.target.closest('#storyCreate')) storyFile.click();
  });
  storyFile.addEventListener('change', () => {
    const file = storyFile.files && storyFile.files[0];
    storyFile.value = '';
    if (file) addStory(file);
  });

  // ---------- Posts ----------

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
