// Read-only profile page reached from a shared link: #/u/<username>
var Pages = window.Pages || {};

function upIsVideo(url) {
  return /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(String(url));
}

// Shows the part of a cover the owner framed (#f=x,y,w,h)
function upApplyFraming(cover) {
  const media = cover && cover.querySelector('.fb-cover-media');
  const match = media && String(media.getAttribute('src')).match(/#f=([\d.]+),([\d.]+),([\d.]+),([\d.]+)/);
  if (!match) return;
  const rect = { x: +match[1], y: +match[2], w: +match[3], h: +match[4] };
  const apply = () => {
    const naturalW = media.videoWidth || media.naturalWidth;
    const naturalH = media.videoHeight || media.naturalHeight;
    const frameW = cover.clientWidth;
    const frameH = cover.clientHeight;
    if (!naturalW || !naturalH || !frameW || !frameH) return;
    const scale = Math.max(frameW / (rect.w * naturalW), frameH / (rect.h * naturalH));
    const width = naturalW * scale;
    const height = naturalH * scale;
    const left = Math.min(0, Math.max(frameW - width, -(rect.x * width) - (rect.w * width - frameW) / 2));
    const top = Math.min(0, Math.max(frameH - height, -(rect.y * height) - (rect.h * height - frameH) / 2));
    media.style.position = 'absolute';
    media.style.objectFit = 'fill';
    media.style.width = (width / frameW * 100) + '%';
    media.style.height = (height / frameH * 100) + '%';
    media.style.left = (left / frameW * 100) + '%';
    media.style.top = (top / frameH * 100) + '%';
  };
  if (media.tagName === 'VIDEO') {
    if (media.readyState >= 1) apply();
    else media.addEventListener('loadedmetadata', apply, { once: true });
  } else if (media.complete) {
    apply();
  } else {
    media.addEventListener('load', apply, { once: true });
  }
}

Pages.userProfile = async function (el, username) {
  const viewer = Auth.isLoggedIn() ? Auth.currentUser : null;
  // Your own link opens your profile page in the app, not a read-only copy
  if (viewer && String(viewer.username || '').toLowerCase() === String(username).toLowerCase()) {
    location.replace('#/App/Profile');
    return;
  }
  const brand = fbBrand();
  const bar = `<div class="fb-public-bar">
      <a class="fb-logo" href="#/" title="${fbEscape(brand.name)}" aria-label="${fbEscape(brand.name)}">${fbEscape(brand.initial)}</a>
      <div class="fb-public-actions">
        ${Theme.toggleButtonHTML('fb-btn fb-btn-secondary')}
        ${viewer
          ? '<a class="fb-btn fb-btn-secondary" href="#/App">Open app</a>'
          : '<a class="fb-btn fb-btn-primary" href="#/Login">Log in</a>'}
      </div>
    </div>`;

  el.innerHTML = `<div class="fb-public">${bar}<div class="loading" style="padding:2rem;text-align:center;">Loading profile…</div></div>`;

  // Only the public columns are read — never the password
  let person = null;
  let people = [];
  let posts = [];
  if (sb) {
    const { data } = await sb.from('users')
      .select('id, username, full_name, role, avatar_url, cover_url')
      .eq('username', username)
      .limit(1);
    person = (data || [])[0] || null;

    if (person) {
      const [peopleRes, postsRes] = await Promise.all([
        sb.from('users').select('id, username, full_name, role').order('username', { ascending: true }),
        sb.from('announcements').select('*').order('created_at', { ascending: false })
      ]);
      people = (peopleRes.data || []).filter(u => String(u.id) !== String(person.id));
      posts = postsRes.data || [];
    }
  }

  if (!person) {
    el.innerHTML = `<div class="fb-public">${bar}
      <section class="fb-card" style="margin:1rem;padding:2rem;text-align:center;">
        <h2>Profile not found</h2>
        <p style="margin-top:0.5rem;color:var(--fb-muted);">No member is using @${fbEscape(username)}.</p>
      </section>
    </div>`;
    return;
  }

  const name = person.full_name || person.username || 'Member';
  const initial = (name.trim()[0] || '?').toUpperCase();
  const cover = person.cover_url || '';
  const coverIsVideo = upIsVideo(cover);
  const avatar = person.avatar_url || '';
  const avatarIsVideo = upIsVideo(avatar);
  const link = fbProfileLink(person.username);
  const role = fbRoleLabel(person.role);
  const friendTile = p => {
    const pname = p.full_name || p.username || 'Member';
    return `<a class="fb-friend" href="#/u/${encodeURIComponent(p.username)}">
      <div class="fb-friend-img">${fbEscape((pname.trim()[0] || '?').toUpperCase())}</div>
      <div class="fb-friend-name">${fbEscape(pname)}</div>
      <div class="fb-friend-meta">${fbEscape(fbRoleLabel(p.role))}</div>
    </a>`;
  };

  el.innerHTML = `<div class="fb-public">
    ${bar}
    <div class="fb-profile">
      <div class="fb-cover${cover ? ' fb-cover--media' : ''}" id="upCover">
        ${cover
          ? coverIsVideo
            ? `<video class="fb-cover-media" src="${fbEscape(cover)}" autoplay muted loop playsinline></video>`
            : `<img class="fb-cover-media" src="${fbEscape(cover)}" alt="">`
          : ''}
        ${coverIsVideo
          ? '<button class="fb-cover-expand" id="upExpand" type="button" aria-label="Play the whole video with sound" title="Play the whole video with sound">⤢</button>'
          : ''}
      </div>

      <div class="fb-profile-head">
        <div class="fb-avatar fb-profile-avatar">${avatar
          ? avatarIsVideo
            ? `<video class="fb-avatar-img" src="${fbEscape(avatar)}" autoplay muted loop playsinline></video>`
            : `<img class="fb-avatar-img" src="${fbEscape(avatar)}" alt="${fbEscape(name)}">`
          : fbEscape(initial)}</div>
        <div class="fb-profile-id">
          <h1 class="fb-profile-name">${fbEscape(name)}</h1>
          <div class="fb-profile-meta">${fbEscape(role)} · @${fbEscape(person.username)} · ${people.length} friend${people.length === 1 ? '' : 's'}</div>
        </div>
        <div class="fb-profile-actions">
          ${viewer && window.fbChat
            ? '<button class="fb-btn fb-btn-primary" id="upMessage" type="button">Message</button>'
            : ''}
          <button class="fb-btn fb-btn-secondary" id="upCopy" type="button">Copy link</button>
        </div>
      </div>

      <div class="fb-profile-cols">
        <div class="fb-col fb-col-left">
          <section class="fb-card" id="upAbout">
            <div class="fb-card-head"><h3>Personal details</h3><span aria-hidden="true">🌐</span></div>
            <ul class="fb-detail-list">
              <li><span class="ico" aria-hidden="true">🏷️</span><span class="k">Role:</span> ${fbEscape(role)}</li>
              <li><span class="ico" aria-hidden="true">👤</span><span class="k">Username:</span> @${fbEscape(person.username)}</li>
              <li><span class="ico" aria-hidden="true">🔗</span><span class="k">Profile link:</span> <a href="#/u/${encodeURIComponent(person.username)}">#/u/${fbEscape(person.username)}</a></li>
              <li><span class="ico" aria-hidden="true">🌐</span><span class="k">App:</span> ${fbEscape(brand.name)}</li>
            </ul>
          </section>

          <section class="fb-card" id="upFriends">
            <div class="fb-card-head"><h3>Friends</h3><span style="color:var(--fb-muted);font-size:0.88rem;">${people.length}</span></div>
            <div class="fb-friends-grid">
              ${people.length
                ? people.map(friendTile).join('')
                : '<div class="empty-state" style="grid-column:1/-1;padding:1rem;">No friends yet.</div>'}
            </div>
          </section>
        </div>

        <div class="fb-col fb-col-right">
          <section class="fb-card" id="upPosts">
            <div class="fb-card-head"><h3>Posts</h3></div>
            ${posts.length
              ? posts.map(p => `
                <article class="fb-post">
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
              : '<div class="empty-state" style="padding:1.5rem;">No posts yet.</div>'}
          </section>
        </div>
      </div>
    </div>
  </div>`;

  el.querySelector('#upCopy').addEventListener('click', () => fbShareLink(link, name));
  const message = el.querySelector('#upMessage');
  if (message) message.addEventListener('click', () => window.fbChat.openWith(person.id));
  const expand = el.querySelector('#upExpand');
  if (expand) expand.addEventListener('click', () => fbPlayFullVideo(cover));
  if (cover && upIsVideo(cover)) upApplyFraming(el.querySelector('#upCover'));
};
