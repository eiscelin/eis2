// Photo and video gallery on a member's own home page, with a privacy lock
var ProfileGallery = {
  render(container, user) {
    if (!container || !user) return { reload() {} };

    let media = [];
    let loaded = false;

    // The lock follows the account when the database has the column, and the
    // device otherwise, so it works before the migration is run too
    const storageKey = 'chad_gallery_locked_' + user.id;
    let locked = typeof user.gallery_locked === 'boolean'
      ? user.gallery_locked
      : localStorage.getItem(storageKey) === '1';

    container.innerHTML = `<section class="fb-card fb-gallery-card">
      <div class="fb-card-head">
        <h3>Photos <span class="fb-gallery-count"></span></h3>
        <button class="fb-gallery-lock" type="button"></button>
      </div>
      <div class="fb-gallery-body"><div class="loading" style="padding:1rem;">Loading…</div></div>
    </section>`;

    const countEl = container.querySelector('.fb-gallery-count');
    const lockBtn = container.querySelector('.fb-gallery-lock');
    const body = container.querySelector('.fb-gallery-body');

    function tile(post, index) {
      const video = post.media_type === 'video';
      const thumb = video
        ? `<video src="${fbEscape(post.media_url)}#t=0.1" muted playsinline preload="metadata"></video>`
        : `<img src="${fbEscape(fbImageUrl(post.media_url, 400))}" alt="" loading="lazy" decoding="async">`;
      const when = post.created_at ? new Date(post.created_at).toLocaleDateString() : '';
      return `<button class="fb-gallery-tile" type="button" data-index="${index}"
        aria-label="Open ${video ? 'video' : 'photo'}${when ? ' from ' + fbEscape(when) : ''}">${thumb}
        ${video ? '<span class="fb-gallery-play" aria-hidden="true">▶</span>' : ''}</button>`;
    }

    function paintLock() {
      lockBtn.textContent = locked ? '🔓 Unlock gallery' : '🔒 Lock gallery';
      lockBtn.classList.toggle('is-locked', locked);
      lockBtn.title = locked
        ? 'Show your photos and videos again'
        : 'Hide your photos and videos for privacy';
      lockBtn.setAttribute('aria-pressed', locked ? 'true' : 'false');
    }

    function paintBody() {
      paintLock();
      if (!loaded) {
        body.innerHTML = '<div class="loading" style="padding:1rem;">Loading…</div>';
        return;
      }
      countEl.textContent = media.length ? '(' + media.length + ')' : '';
      if (locked) {
        body.innerHTML = `<div class="fb-gallery-locked">
          <span class="fb-gallery-locked-ico" aria-hidden="true">🔒</span>
          <strong>Your gallery is locked</strong>
          <p>Your photos and videos stay hidden for privacy. Unlock any time.</p>
        </div>`;
        return;
      }
      if (!media.length) {
        body.innerHTML = '<div class="fb-gallery-empty">No photos or videos yet — share one in a post and it shows up here.</div>';
        return;
      }
      const clamped = media.length > 9 ? ' is-clamped' : '';
      body.innerHTML = `<div class="fb-gallery-grid${clamped}">
          ${media.map(tile).join('')}
        </div>
        ${media.length > 9
          ? `<button class="fb-gallery-more" type="button">See all ${media.length} photos &amp; videos</button>`
          : ''}`;
    }

    async function load() {
      if (!sb) {
        loaded = true;
        media = [];
        if (container.isConnected) paintBody();
        return;
      }
      try {
        const { data, error } = await sb.from('posts')
          .select('id, media_url, media_type, content, created_at')
          .eq('user_id', user.id)
          .not('media_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(60);
        if (error) throw error;
        media = (data || []).filter(post => post.media_url);
      } catch {
        media = [];
      }
      loaded = true;
      if (container.isConnected) paintBody();
    }

    async function toggleLock() {
      locked = !locked;
      localStorage.setItem(storageKey, locked ? '1' : '0');
      user.gallery_locked = locked;
      if (Auth.currentUser && String(Auth.currentUser.id) === String(user.id)) {
        Auth.currentUser.gallery_locked = locked;
        localStorage.setItem('chookee_user', JSON.stringify(Auth.currentUser));
      }
      paintBody();
      showToast(locked ? 'Gallery locked — your photos and videos are hidden' : 'Gallery unlocked', 'success');
      if (!sb) return;
      const { error } = await sb.from('users').update({ gallery_locked: locked }).eq('id', user.id);
      if (error) {
        showToast('Saved on this device — run supabase/migrations/017_add_gallery_privacy.sql to keep the lock on your account', 'error', 9000);
      }
    }

    // ---------- Full-screen viewer ----------

    let keyHandler = null;

    function openViewer(start) {
      if (!media.length) return;
      let index = start;
      const overlay = document.createElement('div');
      overlay.className = 'fb-gallery-viewer';
      overlay.innerHTML = `<div class="fb-gallery-viewer-bar">
          <span class="fb-gallery-counter"></span>
          <button class="fb-gallery-close" type="button" aria-label="Close gallery">✕</button>
        </div>
        ${media.length > 1 ? '<button class="fb-gallery-nav fb-gallery-prev" type="button" aria-label="Previous">‹</button>' : ''}
        <div class="fb-gallery-stage"></div>
        ${media.length > 1 ? '<button class="fb-gallery-nav fb-gallery-next" type="button" aria-label="Next">›</button>' : ''}
        <p class="fb-gallery-caption"></p>`;
      document.body.appendChild(overlay);

      const stage = overlay.querySelector('.fb-gallery-stage');
      const counter = overlay.querySelector('.fb-gallery-counter');
      const caption = overlay.querySelector('.fb-gallery-caption');

      function paint() {
        const post = media[index];
        if (!post) return;
        counter.textContent = (index + 1) + ' / ' + media.length;
        stage.innerHTML = post.media_type === 'video'
          ? `<video src="${fbEscape(post.media_url)}" controls autoplay muted playsinline></video>`
          : `<img src="${fbEscape(post.media_url)}" alt="">`;
        caption.textContent = post.content || '';
      }

      function step(by) {
        index = (index + by + media.length) % media.length;
        paint();
      }

      function close() {
        overlay.remove();
        document.removeEventListener('keydown', keyHandler);
        keyHandler = null;
      }

      overlay.querySelector('.fb-gallery-close').addEventListener('click', close);
      overlay.querySelector('.fb-gallery-prev')?.addEventListener('click', () => step(-1));
      overlay.querySelector('.fb-gallery-next')?.addEventListener('click', () => step(1));
      overlay.addEventListener('click', e => {
        if (e.target === overlay) close();
      });

      keyHandler = e => {
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowLeft') step(-1);
        if (e.key === 'ArrowRight') step(1);
      };
      document.addEventListener('keydown', keyHandler);

      paint();
    }

    body.addEventListener('click', e => {
      const tileEl = e.target.closest('.fb-gallery-tile');
      if (tileEl) {
        openViewer(Number(tileEl.dataset.index) || 0);
        return;
      }
      if (e.target.closest('.fb-gallery-more')) {
        const grid = body.querySelector('.fb-gallery-grid');
        if (grid) grid.classList.remove('is-clamped');
        e.target.closest('.fb-gallery-more').remove();
      }
    });

    lockBtn.addEventListener('click', toggleLock);

    load();
    return { reload: load };
  }
};
