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
      <a class="fb-logo" href="#/" title="${fbEscape(brand.name)}" aria-label="${fbEscape(brand.name)}">${fbBrandMark()}</a>
      ${viewer
        ? '<a class="fb-btn fb-btn-secondary" href="#/App">Open app</a>'
        : '<a class="fb-btn fb-btn-primary" href="#/Login">Log in</a>'}
    </div>`;

  el.innerHTML = `<div class="fb-public">${bar}<div class="loading" style="padding:2rem;text-align:center;">Loading profile…</div></div>`;

  // Only the public columns are read — never the password
  let person = null;
  if (sb) {
    const publicColumns = 'id, username, full_name, role, created_at, avatar_url, cover_url, background_url, status, deleted_at';
    const overlayColumns = ', overlay_image_url, overlay_video_url, overlay_media, overlay_opacity, overlay_volume';
    let { data, error } = await sb.from('users')
      .select(publicColumns + overlayColumns)
      .eq('username', username)
      .limit(1);
    // Profiles still load before the optional migrations have run
    if (error) {
      ({ data } = await sb.from('users')
        .select('id, username, full_name, role, avatar_url, cover_url')
        .eq('username', username)
        .limit(1));
    }
    person = (data || [])[0] || null;
  }

  if (person && (person.deleted_at || person.status === 'deleted' || person.status === 'suspended')) {
    person = null;
  }

  // Age is optional: the profile still loads before 009_add_profile_details.sql runs.
  // Its query runs alongside the friend state so the page (and the overlay clip)
  // paints a round trip sooner.
  let ageReady = null;
  if (person && sb) {
    ageReady = sb.from('users').select('id, age').eq('id', person.id).limit(1);
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

  // Friend requests: the button follows the state between the two members
  let friendState = 'none';
  if (viewer && window.Friends) {
    try { await Friends.load(viewer); } catch { /* friend requests are optional */ }
    friendState = Friends.statusWith(person.id);
  }

  // Friends are followers: the count beside the name is the accepted requests
  let followerCount = 0;
  if (window.Friends) {
    try { followerCount = await Friends.countFollowers(person.id); } catch { /* count stays 0 */ }
  }

  let age = null;
  if (ageReady) {
    const { data: ageRows } = await ageReady;
    if (ageRows && ageRows[0]) age = ageRows[0].age;
  }

  const name = person.full_name || person.username || 'Member';

  const cover = person.cover_url || '';
  const coverIsVideo = upIsVideo(cover);
  const avatar = person.avatar_url || '';
  const avatarIsVideo = upIsVideo(avatar);
  const link = fbProfileLink(person.username);
  const joined = person.created_at
    ? new Date(person.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : '';

  el.innerHTML = `<div class="fb-public">
    ${bar}
    <div class="fb-profile">
      <div class="fb-cover${cover ? ' fb-cover--media' : ' fb-cover--default'}" id="upCover">
        ${cover
          ? coverIsVideo
            ? `<video class="fb-cover-media" src="${fbEscape(cover)}" autoplay muted loop playsinline></video>`
            : `<img class="fb-cover-media" src="${fbEscape(cover)}" alt="">`
          : `<img class="fb-cover-media" src="${FB_DEFAULT_COVER}" alt="">`}
        ${coverIsVideo
          ? '<button class="fb-cover-expand" id="upExpand" type="button" aria-label="Play the whole video with sound" title="Play the whole video with sound">⤢</button>'
          : ''}
        ${cover && window.AdminModerate ? AdminModerate.mediaButton('cover', person.id) : ''}
      </div>

      <div class="fb-profile-head">
        <div class="fb-avatar fb-profile-avatar">${avatar
          ? avatarIsVideo
            ? `<video class="fb-avatar-img" src="${fbEscape(avatar)}" autoplay muted loop playsinline></video>`
            : `<img class="fb-avatar-img" src="${fbEscape(avatar)}" alt="${fbEscape(name)}">`
          : fbBrandMark()}${avatar && window.AdminModerate ? AdminModerate.mediaButton('avatar', person.id) : ''}</div>
        <div class="fb-profile-id">
          <h1 class="fb-profile-name">${fbEscape(name)}</h1>
          <div class="fb-profile-meta">${fbEscape(fbRoleLabel(person.role))} · @${fbEscape(person.username)} · <span id="upFollowerCount">${fbEscape(fbFollowerLabel(followerCount))}</span></div>
        </div>
        <div class="fb-profile-actions">
          ${viewer && window.Friends
            ? `<button class="fb-btn fb-btn-primary" id="upFriend" type="button"${Friends.isLocked(friendState) ? ' disabled' : ''}>${fbEscape(Friends.label(friendState))}</button>`
            : ''}
          ${viewer && window.fbChat
            ? '<button class="fb-btn fb-btn-secondary" id="upMessage" type="button">Message</button>'
            : ''}
          <button class="fb-btn fb-btn-secondary" id="upCopy" type="button">Copy link</button>
        </div>
      </div>
    </div>

    <div class="fb-profile-cols">
      <div class="fb-col">
        <section class="fb-card" id="upAbout">
          <div class="fb-card-head"><h3>Personal details</h3></div>
          <ul class="fb-detail-list">
            <li><span class="ico" aria-hidden="true">📛</span><span class="k">Name:</span> ${fbEscape(name)}</li>
            <li><span class="ico" aria-hidden="true">👤</span><span class="k">Username:</span> @${fbEscape(person.username)}</li>
            <li><span class="ico" aria-hidden="true">🏷️</span><span class="k">Role:</span> ${fbEscape(fbRoleLabel(person.role))}</li>
            ${age ? `<li><span class="ico" aria-hidden="true">🎂</span><span class="k">Age:</span> ${fbEscape(age)}</li>` : ''}
            ${joined ? `<li><span class="ico" aria-hidden="true">📅</span><span class="k">Joined:</span> ${fbEscape(joined)}</li>` : ''}
          </ul>
        </section>
      </div>
      <div class="fb-col">
        <section class="fb-card" id="upPosts">
          <div class="fb-card-head"><h3>Posts</h3></div>
          <div id="upFeed"><div class="loading" style="padding:1rem;">Loading posts…</div></div>
        </section>
      </div>
    </div>
  </div>`;

  el.querySelector('#upCopy').addEventListener('click', () => fbShareLink(link, name));
  const friendBtn = el.querySelector('#upFriend');
  if (friendBtn) {
    friendBtn.addEventListener('click', async () => {
      friendBtn.disabled = true;
      try {
        const result = await Friends.act(person.id);
        if (result === 'sent') showToast('Friend request sent to ' + name, 'success');
        if (result === 'accepted') showToast('You are now friends with ' + name, 'success');
        const state = Friends.statusWith(person.id);
        friendBtn.textContent = Friends.label(state);
        friendBtn.disabled = Friends.isLocked(state);
      } catch (err) {
        friendBtn.disabled = false;
        showToast(err.message, 'error', 6000);
      }
    });
  }
  if (window.AdminModerate) AdminModerate.wire(el, { media: () => Pages.userProfile(el, username) });
  const message = el.querySelector('#upMessage');
  if (message) message.addEventListener('click', () => window.fbChat.openWith(person.id));
  const expand = el.querySelector('#upExpand');
  if (expand) expand.addEventListener('click', () => fbPlayFullVideo(cover));
  if (cover && upIsVideo(cover)) upApplyFraming(el.querySelector('#upCover'));
  // This member's posts, with their reactions and comments
  if (window.Posts) {
    Posts.mount(el.querySelector('#upFeed'), {
      viewer: viewer,
      authorId: person.id,
      limit: 20,
      emptyHtml: '<div class="empty-state" style="padding:1.5rem;">No posts yet.</div>'
    });
  }
  ProfileOverlay.paint(el.querySelector('.fb-profile'), person, { sound: true });
  // The account's own picture is the page background, signed in or not
  fbPaintPageBackground(person.background_url || '');
};
