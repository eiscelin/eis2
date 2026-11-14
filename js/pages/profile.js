// Facebook-style account page — shared "My Profile" tab for every dashboard
var Pages = window.Pages || {};

function fbRoleLabel(role) {
  return ({
    admin: 'Administrator',
    member: 'Member'
  })[role] || role || 'Member';
}

Pages.profileTab = function(main, user) {
  const name = user.full_name || user.username || 'Member';

  const role = fbRoleLabel(user.role);
  const brand = fbBrand();
  let avatarUrl = user.avatar_url || '';
  let coverUrl = user.cover_url || '';
  const isVideo = url => /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(String(url));

  // Tells the owner that a picture or video is waiting for an admin
  function paintMediaNote() {
    const note = main.querySelector('#pfMediaNote');
    if (!note) return;
    const lines = [];
    if (user.avatar_review_status === 'pending') lines.push('⏳ Profile picture waiting for admin approval');
    else if (user.avatar_review_status === 'rejected') lines.push('⚠️ Profile picture was declined — choose another');
    if (user.cover_review_status === 'pending') lines.push('⏳ Cover waiting for admin approval');
    else if (user.cover_review_status === 'rejected') lines.push('⚠️ Cover was declined — choose another');
    note.innerHTML = lines.map(line => `<span>${fbEscape(line)}</span>`).join('');
    note.hidden = !lines.length;
  }

  // A profile picture can be a photo or a short video
  function avatarMedia(video) {
    const isVid = video === undefined ? isVideo(avatarUrl) : video;
    if (!avatarUrl) return fbBrandMark();
    return isVid
      ? `<video class="fb-avatar-img" src="${fbEscape(avatarUrl)}" autoplay muted loop playsinline></video>`
      : `<img class="fb-avatar-img" src="${fbEscape(avatarUrl)}" alt="${fbEscape(name)}">`;
  }

  main.innerHTML = `
    <div class="fb-profile">
      <div class="fb-cover${coverUrl ? ' fb-cover--media' : ' fb-cover--default'}" id="pfCover">
        ${coverUrl
          ? isVideo(coverUrl)
            ? `<video class="fb-cover-media" src="${fbEscape(coverUrl)}" autoplay muted loop playsinline></video>`
            : `<img class="fb-cover-media" src="${fbEscape(coverUrl)}" alt="">`
          : `<img class="fb-cover-media" src="${FB_DEFAULT_COVER}" alt="">`}
        ${coverUrl && isVideo(coverUrl)
          ? `<button class="fb-cover-expand" id="pfCoverExpand" type="button" aria-label="Play the whole video with sound" title="Play the whole video with sound">⤢</button>`
          : ''}
      </div>

      <div class="fb-profile-head">
        <div class="fb-avatar fb-profile-avatar" id="pfAvatar">${avatarMedia()}<button class="fb-avatar-edit" id="pfAvatarEdit" type="button" title="Change profile picture" aria-label="Change profile picture">📷</button>
        </div>
        <div class="fb-profile-id">
          <h1 class="fb-profile-name">${fbEscape(name)}</h1>
          <div class="fb-profile-meta">
            ${fbEscape(role)} · @${fbEscape(user.username)} · <span id="pfFriendCount">…</span> friends
          </div>
          <div class="fb-media-note" id="pfMediaNote" hidden></div>
        </div>
        <div class="fb-profile-actions">
          <button class="fb-btn fb-btn-primary" id="pfEdit" type="button">✏️ Edit profile</button>
          <button class="fb-btn fb-btn-secondary" id="pfOverlay" type="button">✨ Overlay</button>
          <button class="fb-btn fb-btn-secondary" id="pfShare" type="button">↗ Share profile</button>
          <button class="fb-btn fb-btn-secondary" id="pfLogout" type="button">⎋ Log out</button>
        </div>
      </div>

      <nav class="fb-profile-tabs" aria-label="Profile sections">
        <button class="fb-profile-tab active" data-ptab="all" type="button">All</button>
        <button class="fb-profile-tab" data-ptab="about" type="button">About</button>
        <button class="fb-profile-tab" data-ptab="photos" type="button">Photos</button>
        <button class="fb-profile-tab" data-ptab="info" type="button">My Information</button>
        <button class="fb-profile-tab" data-ptab="friends" type="button">Friends</button>
        <button class="fb-profile-tab" data-ptab="posts" type="button">Posts</button>
      </nav>

      <div class="fb-profile-cols">
        <div class="fb-col fb-col-left">
          <section class="fb-card" data-section="about" id="pfAbout">
            <div class="fb-card-head"><h3>Personal details</h3><span aria-hidden="true">🔒</span></div>
            <ul class="fb-detail-list">
              <li><span class="ico" aria-hidden="true">🏷️</span><span class="k">Role:</span> ${fbEscape(role)}</li>
              <li><span class="ico" aria-hidden="true">👤</span><span class="k">Username:</span> @${fbEscape(user.username)}</li>
              <li><span class="ico" aria-hidden="true">🔗</span><span class="k">Profile link:</span> <a href="#/u/${fbEscape(user.username)}">#/u/${fbEscape(user.username)}</a></li>
              <li><span class="ico" aria-hidden="true">🌐</span><span class="k">App:</span> ${fbEscape(brand.name)}</li>
            </ul>
          </section>

          <div id="pfGallery" data-section="photos"></div>

          <div id="pfPersonal" data-section="info"></div>

          <section class="fb-card" data-section="friends" id="pfFriends">
            <div class="fb-card-head"><h3>Friends</h3></div>
            <div class="fb-friends-grid" id="pfFriendsGrid">
              <div class="loading" style="grid-column:1/-1;padding:1rem;">Loading…</div>
            </div>
          </section>
        </div>

        <div class="fb-col fb-col-right">
          <section class="fb-card" data-section="people" id="pfPeople">
            <div class="fb-card-head"><h3>People you may know</h3></div>
            <div class="fb-people-search">
              <input type="search" id="pfPeopleSearch" placeholder="Search by username…" aria-label="Search people by username" autocomplete="off">
            </div>
            <div class="fb-people-scroll" id="pfPeopleList">
              <div class="loading" style="padding:1rem;">Loading…</div>
            </div>
          </section>

          <section class="fb-card" data-section="posts" id="pfPosts">
            <div class="fb-card-head"><h3>Posts</h3></div>
            <div id="pfComposer"></div>
            <div id="pfFeed">
              <div class="loading" style="padding:1rem;">Loading…</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;

  const sectionMap = {
    all: null,
    about: ['about'],
    photos: ['photos'],
    info: ['info'],
    friends: ['friends', 'people'],
    posts: ['posts']
  };

  function showTab(tab) {
    const allowed = sectionMap[tab];
    main.querySelectorAll('[data-section]').forEach(section => {
      // Personal details / password live only in the My Information tab, never in All
      const isInfo = section.dataset.section === 'info';
      const show = tab === 'all'
        ? !isInfo
        : (!allowed || allowed.includes(section.dataset.section));
      section.style.display = show ? '' : 'none';
    });
    // My Information is a full-width form, so it spans both columns
    const cols = main.querySelector('.fb-profile-cols');
    if (cols) cols.classList.toggle('fb-cols-single', tab === 'info' || tab === 'photos');
    // The Photos tab shows the whole gallery, not just the first nine
    const galleryCard = main.querySelector('.fb-gallery-card');
    if (galleryCard) galleryCard.classList.toggle('is-expanded', tab === 'photos');
    main.querySelectorAll('.fb-profile-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ptab === tab);
    });
  }

  main.querySelectorAll('.fb-profile-tab').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.ptab));
  });

  main.querySelector('#pfEdit').addEventListener('click', () => {
    showTab('info');
    const personal = main.querySelector('#pfPersonal');
    personal.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const first = personal.querySelector('input');
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 350);
  });

  main.querySelector('#pfShare').addEventListener('click', () => {
    fbShareLink(fbProfileLink(user.username), name);
  });

  main.querySelector('#pfLogout').addEventListener('click', () => Auth.logout());

  // ---------- Personal information (details + password) ----------

  if (window.PersonalInfo) {
    PersonalInfo.render(main.querySelector('#pfPersonal'), user, {
      onSaved: saved => {
        const heading = main.querySelector('.fb-profile-name');
        if (heading) heading.textContent = saved.full_name || user.username;
      }
    });
  }

  // ---------- Translucent overlay in front of the whole profile ----------

  ProfileOverlay.paint(main.querySelector('.fb-profile'), user);

  main.querySelector('#pfOverlay').addEventListener('click', () => {
    ProfileOverlay.open(user, async values => {
      if (!sb) throw new Error('the database is not connected');
      const { error } = await sb.rpc('set_profile_overlay', {
        p_user_id: user.id,
        p_overlay_image_url: values.image || null,
        p_overlay_video_url: values.video || null,
        p_overlay_media: values.media,
        p_overlay_opacity: values.opacity,
        p_overlay_volume: values.volume
      });
      if (error) throw new Error(/set_profile_overlay/.test(error.message)
        ? 'Run 007_add_overlay_volume.sql in Supabase, then try again'
        : error.message);

      const saved = {
        overlay_image_url: values.image || null,
        overlay_video_url: values.video || null,
        overlay_media: values.media,
        overlay_opacity: values.opacity,
        overlay_volume: values.volume
      };
      Object.assign(user, saved);
      if (Auth.currentUser) {
        Object.assign(Auth.currentUser, saved);
        localStorage.setItem('chookee_user', JSON.stringify(Auth.currentUser));
      }
      ProfileOverlay.paint(main.querySelector('.fb-profile'), user);
      showToast(values.media === 'off' ? 'Profile overlay is off' : 'Profile overlay saved', 'success');
    });
  });

  // ---------- Profile picture + cover (image or video) ----------

  function paintAvatar(video) {
    main.querySelector('#pfAvatar').innerHTML = avatarMedia(video) +
      '<button class="fb-avatar-edit" id="pfAvatarEdit" type="button" title="Change profile picture" aria-label="Change profile picture">📷</button>';
  }

  function paintCover(video) {
    const cover = main.querySelector('#pfCover');
    cover.classList.toggle('fb-cover--media', !!coverUrl);
    cover.classList.toggle('fb-cover--default', !coverUrl);
    cover.querySelector('.fb-cover-media')?.remove();
    cover.querySelector('#pfCoverExpand')?.remove();
    if (!coverUrl) {
      cover.insertAdjacentHTML('afterbegin', `<img class="fb-cover-media" src="${FB_DEFAULT_COVER}" alt="">`);
      return;
    }
    const isVid = video === undefined ? isVideo(coverUrl) : video;
    cover.insertAdjacentHTML('afterbegin', isVid
      ? `<video class="fb-cover-media" src="${fbEscape(coverUrl)}" autoplay muted loop playsinline></video>`
      : `<img class="fb-cover-media" src="${fbEscape(coverUrl)}" alt="">`);
    if (isVid) {
      cover.insertAdjacentHTML('beforeend',
        '<button class="fb-cover-expand" id="pfCoverExpand" type="button" aria-label="Play the whole video with sound" title="Play the whole video with sound">⤢</button>');
    }

    const rect = framedRect(coverUrl);
    if (!rect) return;
    const media = cover.querySelector('.fb-cover-media');
    const apply = () => frameMedia(media, rect);
    if (isVid) {
      if (media.readyState >= 1) apply();
      else media.addEventListener('loadedmetadata', apply, { once: true });
    } else if (media.complete) {
      apply();
    } else {
      media.addEventListener('load', apply, { once: true });
    }
  }

  // Framing saved with a cover video: #f=x,y,w,h as fractions of the clip
  function framedRect(url) {
    const match = String(url).match(/#f=([\d.]+),([\d.]+),([\d.]+),([\d.]+)/);
    return match ? { x: +match[1], y: +match[2], w: +match[3], h: +match[4] } : null;
  }

  // Shows exactly the part of the video the owner framed
  function frameMedia(media, rect) {
    const cover = main.querySelector('#pfCover');
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
  }

  // Cloudinary crops the photo down to exactly what the owner framed
  function cloudinaryCrop(url, rect) {
    const transform = `c_crop,w_${Math.round(rect.w)},h_${Math.round(rect.h)},x_${Math.round(rect.x)},y_${Math.round(rect.y)}`;
    return String(url).replace('image/upload/', 'image/upload/' + transform + '/');
  }

  // Drag the photo or video to choose what shows and zoom to resize it
  async function openCoverEditor(file) {
    const video = file.type.startsWith('video/');
    let blob = file;
    if (!video) {
      try { blob = await shrinkImage(file, 2400); } catch { /* formats the browser cannot decode (HEIC) go up as they are */ }
    }
    const src = URL.createObjectURL(blob);

    const source = document.createElement(video ? 'video' : 'img');
    if (video) {
      source.muted = true;
      source.loop = true;
      source.playsInline = true;
      source.autoplay = true;
    }
    const decoded = await new Promise(resolve => {
      // a clip this browser cannot preview still uploads, just without framing
      const timer = setTimeout(() => resolve(false), 6000);
      const settle = ok => { clearTimeout(timer); resolve(ok); };
      if (video) source.onloadedmetadata = () => settle(true);
      else source.onload = () => settle(true);
      source.onerror = () => settle(false);
      source.src = src;
      if (video) source.play().catch(() => {});
    });
    const naturalW = video ? source.videoWidth : source.naturalWidth;
    const naturalH = video ? source.videoHeight : source.naturalHeight;
    if (!decoded || !naturalW || !naturalH) {
      URL.revokeObjectURL(src);
      return { blob: file };
    }

    const coverBox = main.querySelector('#pfCover');
    const ratio = (coverBox && coverBox.clientHeight) ? coverBox.clientWidth / coverBox.clientHeight : 3.1;
    const available = Math.min(((coverBox && coverBox.clientWidth) || 620), window.innerWidth - 64);
    const width = Math.max(240, Math.min(620, Math.round(available)));
    const height = Math.round(width / (ratio || 3.1));
    const base = Math.max(width / naturalW, height / naturalH);
    const zoomMax = 3;

    let zoom = 1;
    let dx = 0;
    let dy = 0;
    const size = () => ({ w: naturalW * base * zoom, h: naturalH * base * zoom });

    const overlay = document.createElement('div');
    overlay.className = 'cover-editor';
    overlay.innerHTML = `
      <div class="cover-editor-box">
        <h3>Position your cover</h3>
        <div class="cover-editor-frame" id="ceFrame" style="width:${width}px;height:${height}px"></div>
        <div class="cover-editor-controls">
          <span aria-hidden="true">−</span>
          <input id="ceZoom" type="range" min="1" max="${zoomMax}" step="0.01" value="1" aria-label="Zoom cover photo">
          <span aria-hidden="true">+</span>
        </div>
        <p class="cover-editor-hint">Drag to choose what shows, and zoom to resize it.</p>
        <div class="cover-editor-actions">
          <button class="fb-btn fb-btn-secondary" id="ceCancel" type="button">Cancel</button>
          <button class="fb-btn fb-btn-primary" id="ceSave" type="button">Save cover</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const frame = overlay.querySelector('#ceFrame');
    source.id = 'ceImg';
    frame.appendChild(source);
    const picture = source;

    function layout() {
      const { w, h } = size();
      dx = Math.min(0, Math.max(width - w, dx));
      dy = Math.min(0, Math.max(height - h, dy));
      picture.style.width = w + 'px';
      picture.style.height = h + 'px';
      picture.style.left = dx + 'px';
      picture.style.top = dy + 'px';
    }
    // start with the middle of the photo showing
    const start = size();
    dx = (width - start.w) / 2;
    dy = (height - start.h) / 2;
    layout();

    let grab = null;
    frame.addEventListener('pointerdown', e => {
      grab = { x: e.clientX - dx, y: e.clientY - dy };
      try { frame.setPointerCapture(e.pointerId); } catch { /* pointer capture is optional */ }
    });
    frame.addEventListener('pointermove', e => {
      if (!grab) return;
      dx = e.clientX - grab.x;
      dy = e.clientY - grab.y;
      layout();
    });
    const release = () => { grab = null; };
    frame.addEventListener('pointerup', release);
    frame.addEventListener('pointercancel', release);
    overlay.querySelector('#ceZoom').addEventListener('input', e => {
      // keep the middle of the frame in place while resizing
      const next = Number(e.target.value) || 1;
      const ratio = zoom / next;
      const keepX = (width / 2 - dx) * ratio;
      const keepY = (height / 2 - dy) * ratio;
      zoom = next;
      dx = width / 2 - keepX;
      dy = height / 2 - keepY;
      layout();
    });

    const finish = result => {
      overlay.remove();
      URL.revokeObjectURL(src);
      return result;
    };

    return new Promise(resolve => {
      overlay.querySelector('#ceCancel').addEventListener('click', () => resolve(finish(null)));
      overlay.querySelector('#ceSave').addEventListener('click', () => {
        const scale = base * zoom; // shown pixels per source pixel
        const rect = {
          x: Math.max(0, -dx / scale / naturalW),
          y: Math.max(0, -dy / scale / naturalH),
          w: Math.min(1, width / scale / naturalW),
          h: Math.min(1, height / scale / naturalH)
        };
        resolve(finish({ blob, crop: rect, size: { w: naturalW, h: naturalH } }));
      });
    });
  }

  async function saveMedia(kind, file, crop, cropSize) {
    if (!file) return;
    if (ReadOnlyMode.block('Uploading photos and videos')) return;
    const label = kind === 'avatar' ? 'profile picture' : 'cover';
    const video = String(file.type || '').startsWith('video/');
    const previous = kind === 'avatar' ? avatarUrl : coverUrl;
    const preview = URL.createObjectURL(file);

    // Show the picked file straight away so choosing it has a visible result
    if (kind === 'avatar') { avatarUrl = preview; paintAvatar(video); }
    else { coverUrl = preview; paintCover(video); }

    function restore() {
      if (kind === 'avatar') { avatarUrl = previous; paintAvatar(); }
      else { coverUrl = previous; paintCover(); }
    }

    if (!sb) {
      restore();
      return showToast('Connect the database to change your ' + label, 'error', 6000);
    }

    try {
      showToast('Updating ' + label + '…');
      if (video && file.size > 100 * 1024 * 1024) throw new Error('that video is larger than 100 MB');
      if (!video && file.size > 20 * 1024 * 1024) throw new Error('that image is larger than 20 MB');
      let payload = file;
      if (!video && !crop) {
        // Phone photos (HEIC etc.) the browser cannot decode are uploaded as they are
        try { payload = await shrinkImage(file, kind === 'cover' ? 1800 : 640); } catch { payload = file; }
      }
      const uploaded = await cloudinaryUpload(payload);
      if (!uploaded) throw new Error('image hosting is not connected');
      const url = !crop ? uploaded
        : video
          ? uploaded + '#f=' + [crop.x, crop.y, crop.w, crop.h].map(v => v.toFixed(4)).join(',')
          : cloudinaryCrop(uploaded, {
            x: crop.x * cropSize.w, y: crop.y * cropSize.h, w: crop.w * cropSize.w, h: crop.h * cropSize.h
          });

      // An admin reviews a new picture or video before it appears on the profile
      const { error } = await sb.rpc('submit_profile_media', {
        p_user_id: user.id,
        p_kind: kind,
        p_url: url
      });
      if (error) throw error;

      const { data: fresh } = await sb.from('users')
        .select('avatar_url, cover_url, avatar_pending_url, cover_pending_url, avatar_review_status, cover_review_status')
        .eq('id', user.id)
        .single();
      if (fresh) {
        avatarUrl = fresh.avatar_url || '';
        coverUrl = fresh.cover_url || '';
        Object.assign(user, fresh);
        if (Auth.currentUser) {
          Object.assign(Auth.currentUser, fresh);
          localStorage.setItem('chookee_user', JSON.stringify(Auth.currentUser));
        }
      }
      paintAvatar();
      paintCover();
      paintMediaNote();

      const review = fresh ? (kind === 'avatar' ? fresh.avatar_review_status : fresh.cover_review_status) : 'pending';
      showToast(review === 'approved'
        ? 'Your ' + label + ' is updated'
        : 'Your ' + label + ' was sent to an admin for approval', 'success', 5000);
    } catch (e) {
      restore();
      const message = String(e.message || e);
      showToast(/submit_profile_media|set_profile_media/.test(message)
        ? 'Run 008_add_admin_controls.sql in Supabase, then try again'
        : 'Could not update your ' + label + ': ' + message, 'error', 6000);
    } finally {
      URL.revokeObjectURL(preview);
    }
  }

  const avatarFile = document.createElement('input');
  avatarFile.type = 'file';
  avatarFile.accept = 'image/*,video/*';
  avatarFile.hidden = true;
  const coverFile = document.createElement('input');
  coverFile.type = 'file';
  coverFile.accept = 'image/*,video/*';
  coverFile.hidden = true;
  main.append(avatarFile, coverFile);

  // The picture and the whole banner open the picker; the expand button plays the clip instead
  main.querySelector('#pfAvatar').addEventListener('click', () => avatarFile.click());
  main.querySelector('#pfCover').addEventListener('click', e => {
    if (e.target.closest('#pfCoverExpand')) {
      fbPlayFullVideo(coverUrl);
      return;
    }
    coverFile.click();
  });
  avatarFile.addEventListener('change', () => {
    const file = avatarFile.files[0];
    avatarFile.value = '';
    saveMedia('avatar', file);
  });
  coverFile.addEventListener('change', async () => {
    const file = coverFile.files[0];
    coverFile.value = '';
    if (!file) return;
    const edited = await openCoverEditor(file);
    if (edited) saveMedia('cover', edited.blob, edited.crop, edited.size);
  });

  // a cover saved with framing shows that framing straight away
  if (framedRect(coverUrl)) paintCover();

  // People / friends (team directory)
  const loadPeople = async () => {
    const friendsGrid = main.querySelector('#pfFriendsGrid');
    const peopleList = main.querySelector('#pfPeopleList');
    if (!sb) {
      friendsGrid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:1rem;">No team members to show.</div>';
      peopleList.innerHTML = '<div class="empty-state" style="padding:1rem;">No suggestions right now.</div>';
      main.querySelector('#pfFriendCount').textContent = '0';
      return;
    }

    let people = [];

    // Search by username (or name) narrows the suggestions below
    const peopleSearch = main.querySelector('#pfPeopleSearch');

    function matchesQuery(p) {
      const q = (peopleSearch ? peopleSearch.value : '').trim().toLowerCase();
      if (!q) return true;
      return String(p.username || '').toLowerCase().includes(q) ||
        String(p.full_name || '').toLowerCase().includes(q);
    }

    // "People you may know": their picture or video, and Add Friend underneath
    function paintSuggestions() {
      const query = peopleSearch ? peopleSearch.value.trim() : '';
      const suggestions = people.filter(p =>
        (!window.Friends || Friends.statusWith(p.id) !== 'friends') && matchesQuery(p)
      );
      peopleList.innerHTML = suggestions.length
        ? suggestions.map(p => {
          const pname = p.full_name || p.username || 'Member';
          const state = window.Friends ? Friends.statusWith(p.id) : 'none';
          return `<div class="fb-person">
            <a class="fb-person-img" href="#/u/${encodeURIComponent(p.username || '')}" title="Open ${fbEscape(pname)}'s profile">
              ${window.Friends ? Friends.media(p) : fbEscape((pname.trim()[0] || '?').toUpperCase())}
            </a>
            <div class="fb-person-body">
              <div class="fb-person-name">${fbEscape(pname)}</div>
              <div class="fb-person-meta">${fbEscape(fbRoleLabel(p.role))}</div>
              <button class="fb-person-btn" type="button" data-friend="${fbEscape(p.id)}"${window.Friends && Friends.isLocked(state) ? ' disabled' : ''}>${window.Friends ? fbEscape(Friends.label(state)) : 'Add Friend'}</button>
            </div>
          </div>`;
        }).join('')
        : `<div class="empty-state" style="padding:1rem;">${query
            ? 'No username matches “' + fbEscape(query) + '”.'
            : 'No suggestions right now.'}</div>`;
    }

    if (peopleSearch) peopleSearch.addEventListener('input', paintSuggestions);

    // Add Friend sends a request; Confirm accepts the one they sent you
    peopleList.addEventListener('click', async e => {
      const btn = e.target.closest('[data-friend]');
      if (!btn || btn.disabled || !window.Friends) return;
      const person = people.find(p => String(p.id) === String(btn.dataset.friend));
      const pname = person ? (person.full_name || person.username || 'Member') : 'Member';
      btn.disabled = true;
      try {
        const result = await Friends.act(btn.dataset.friend);
        if (result === 'sent') showToast('Friend request sent to ' + pname, 'success');
        if (result === 'accepted') showToast('You are now friends with ' + pname, 'success');
      } catch (err) {
        showToast(err.message, 'error', 6000);
      }
      paintSuggestions();
    });

    // A request answered in the notification bell updates this rail too
    document.addEventListener('friends:changed', () => {
      if (peopleList.isConnected) paintSuggestions();
    });

    try {
      const [{ data }] = await Promise.all([
        sb.from('users').select('*').order('username', { ascending: true }),
        window.Friends ? Friends.load(user) : Promise.resolve()
      ]);
      people = (data || []).filter(u =>
        String(u.id) !== String(user.id) &&
        u.role !== 'admin' &&
        !u.deleted_at &&
        u.status !== 'deleted' &&
        u.status !== 'suspended'
      );
      main.querySelector('#pfFriendCount').textContent = people.length;

      friendsGrid.innerHTML = people.length
        ? people.map(p => {
          const pname = p.full_name || p.username || 'Member';
          // A member's picture or video, and the whole tile opens their profile
          const picture = window.Friends
            ? Friends.media(p)
            : fbEscape((pname.trim()[0] || '?').toUpperCase());
          return `<a class="fb-friend" href="#/u/${encodeURIComponent(p.username || '')}" title="Open ${fbEscape(pname)}'s profile">
            <div class="fb-friend-img">${picture}</div>
            <div class="fb-friend-name">${fbEscape(pname)}</div>
            <div class="fb-friend-meta">${fbEscape(fbRoleLabel(p.role))}</div>
          </a>`;
        }).join('')
        : '<div class="empty-state" style="grid-column:1/-1;padding:1rem;">No friends yet.</div>';

      paintSuggestions();
    } catch {
      friendsGrid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:1rem;">Could not load friends.</div>';
      peopleList.innerHTML = '<div class="empty-state" style="padding:1rem;">Could not load suggestions.</div>';
      main.querySelector('#pfFriendCount').textContent = '0';
    }
  };

  // Posts = this member's photo, video and text posts
  const profilePosts = Posts.mount(main.querySelector('#pfFeed'), {
    viewer: user,
    authorId: user.id,
    limit: 20,
    emptyHtml: '<div class="empty-state" style="padding:1.5rem;">No posts yet — share something above.</div>'
  });

  // Photo and video gallery, with the lock that hides it for privacy
  const gallery = window.ProfileGallery
    ? ProfileGallery.render(main.querySelector('#pfGallery'), user)
    : null;

  Posts.composer(main.querySelector('#pfComposer'), {
    viewer: user,
    onPosted: () => {
      profilePosts.reload();
      if (gallery) gallery.reload();
    }
  });

  showTab('all');
  paintMediaNote();
  loadPeople();
};

window.Pages = Pages;
