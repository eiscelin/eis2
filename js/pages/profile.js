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
  const initial = (name.trim()[0] || '?').toUpperCase();
  const role = fbRoleLabel(user.role);
  const brand = fbBrand();
  const canChat = !!window.fbChat;
  let avatarUrl = user.avatar_url || '';
  let coverUrl = user.cover_url || '';
  const isVideo = url => /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(String(url));

  main.innerHTML = `
    <div class="fb-profile">
      <div class="fb-cover${coverUrl ? ' fb-cover--media' : ''}" id="pfCover">
        ${coverUrl
          ? isVideo(coverUrl)
            ? `<video class="fb-cover-media" src="${fbEscape(coverUrl)}" autoplay muted loop playsinline></video>`
            : `<img class="fb-cover-media" src="${fbEscape(coverUrl)}" alt="">`
          : ''}
        <div class="fb-cover-text">${fbEscape(brand.name.toUpperCase())}</div>
        <span class="fb-cover-badge">${fbEscape(brand.name)}</span>
        <button class="fb-cover-edit" id="pfCoverEdit" type="button">📷 Edit cover</button>
      </div>

      <div class="fb-profile-head">
        <div class="fb-avatar fb-profile-avatar" id="pfAvatar">${avatarUrl
          ? `<img class="fb-avatar-img" src="${fbEscape(avatarUrl)}" alt="${fbEscape(name)}">`
          : fbEscape(initial)}<button class="fb-avatar-edit" id="pfAvatarEdit" type="button" title="Change profile picture" aria-label="Change profile picture">📷</button>
        </div>
        <div class="fb-profile-id">
          <h1 class="fb-profile-name">${fbEscape(name)}</h1>
          <div class="fb-profile-meta">
            ${fbEscape(role)} · @${fbEscape(user.username)} · <span id="pfFriendCount">…</span> friends
          </div>
        </div>
        <div class="fb-profile-actions">
          <button class="fb-btn fb-btn-primary" id="pfEdit" type="button">✏️ Edit profile</button>
          <button class="fb-btn fb-btn-secondary" id="pfShare" type="button">↗ Share profile</button>
          <button class="fb-btn fb-btn-secondary" id="pfLogout" type="button">⎋ Log out</button>
        </div>
      </div>

      <nav class="fb-profile-tabs" aria-label="Profile sections">
        <button class="fb-profile-tab active" data-ptab="all" type="button">All</button>
        <button class="fb-profile-tab" data-ptab="about" type="button">About</button>
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
              <li><span class="ico" aria-hidden="true">🌐</span><span class="k">App:</span> ${fbEscape(brand.name)}</li>
            </ul>
          </section>

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
            <div class="fb-people-scroll" id="pfPeopleList">
              <div class="loading" style="padding:1rem;">Loading…</div>
            </div>
          </section>

          <section class="fb-card" data-section="posts" id="pfPosts">
            <div class="fb-card-head"><h3>Posts</h3></div>
            <div class="fb-composer">
              <span class="fb-avatar fb-avatar-sm">${fbEscape(initial)}</span>
              <input id="pfComposerInput" type="text" placeholder="What's on your mind?">
              <button id="pfComposerPost" type="button">Post</button>
            </div>
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
    friends: ['friends', 'people'],
    posts: ['posts']
  };

  function showTab(tab) {
    main.querySelectorAll('[data-section]').forEach(section => {
      const allowed = sectionMap[tab];
      section.style.display = (!allowed || allowed.includes(section.dataset.section)) ? '' : 'none';
    });
    main.querySelectorAll('.fb-profile-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ptab === tab);
    });
  }

  main.querySelectorAll('.fb-profile-tab').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.ptab));
  });

  main.querySelector('#pfEdit').addEventListener('click', () => {
    showTab('about');
    const about = main.querySelector('#pfAbout');
    about.scrollIntoView({ behavior: 'smooth', block: 'center' });
    about.classList.remove('fb-flash');
    void about.offsetWidth;
    about.classList.add('fb-flash');
  });

  main.querySelector('#pfShare').addEventListener('click', () => {
    const link = location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link)
        .then(() => showToast('Profile link copied', 'success'))
        .catch(() => showToast('Profile link: ' + link));
    } else {
      showToast('Profile link: ' + link);
    }
  });

  main.querySelector('#pfLogout').addEventListener('click', () => Auth.logout());

  // ---------- Profile picture + cover (image or video) ----------

  function paintAvatar() {
    main.querySelector('#pfAvatar').innerHTML = avatarUrl
      ? `<img class="fb-avatar-img" src="${fbEscape(avatarUrl)}" alt="${fbEscape(name)}">`
      : fbEscape(initial);
    main.querySelector('#pfAvatar').insertAdjacentHTML('beforeend',
      '<button class="fb-avatar-edit" id="pfAvatarEdit" type="button" title="Change profile picture" aria-label="Change profile picture">📷</button>');
  }

  function paintCover() {
    const cover = main.querySelector('#pfCover');
    cover.classList.toggle('fb-cover--media', !!coverUrl);
    cover.querySelector('.fb-cover-media')?.remove();
    if (!coverUrl) return;
    cover.insertAdjacentHTML('afterbegin', isVideo(coverUrl)
      ? `<video class="fb-cover-media" src="${fbEscape(coverUrl)}" autoplay muted loop playsinline></video>`
      : `<img class="fb-cover-media" src="${fbEscape(coverUrl)}" alt="">`);
  }

  async function saveMedia(kind, file) {
    if (!file) return;
    const label = kind === 'avatar' ? 'profile picture' : 'cover';
    if (!sb) return showToast('Connect the database to change your ' + label, 'error');
    try {
      showToast('Updating ' + label + '…');
      const video = kind === 'cover' && file.type.startsWith('video/');
      if (video && file.size > 40 * 1024 * 1024) throw new Error('that video is larger than 40 MB');
      const url = video
        ? await cloudinaryUpload(file)
        : await cloudinaryUpload(await shrinkImage(file, kind === 'cover' ? 1800 : 640));
      if (!url) throw new Error('image hosting is not connected');

      const next = {
        avatar_url: kind === 'avatar' ? url : avatarUrl,
        cover_url: kind === 'cover' ? url : coverUrl
      };
      const { error } = await sb.rpc('set_profile_media', {
        p_user_id: user.id,
        p_avatar_url: next.avatar_url || null,
        p_cover_url: next.cover_url || null
      });
      if (error) throw error;

      avatarUrl = next.avatar_url;
      coverUrl = next.cover_url;
      Object.assign(user, next);
      if (Auth.currentUser) {
        Object.assign(Auth.currentUser, next);
        localStorage.setItem('chookee_user', JSON.stringify(Auth.currentUser));
      }
      paintAvatar();
      paintCover();
      showToast('Your ' + label + ' is updated', 'success');
    } catch (e) {
      const message = String(e.message || e);
      showToast(/set_profile_media/.test(message)
        ? 'Run 005_add_profile_media.sql in Supabase, then try again'
        : 'Could not update your ' + label + ': ' + message, 'error');
    }
  }

  const avatarFile = document.createElement('input');
  avatarFile.type = 'file';
  avatarFile.accept = 'image/*';
  avatarFile.hidden = true;
  const coverFile = document.createElement('input');
  coverFile.type = 'file';
  coverFile.accept = 'image/*,video/*';
  coverFile.hidden = true;
  main.append(avatarFile, coverFile);

  main.querySelector('#pfAvatar').addEventListener('click', e => {
    if (e.target.closest('#pfAvatarEdit')) avatarFile.click();
  });
  main.querySelector('#pfCover').addEventListener('click', e => {
    if (e.target.closest('#pfCoverEdit')) coverFile.click();
  });
  avatarFile.addEventListener('change', () => {
    const file = avatarFile.files[0];
    avatarFile.value = '';
    saveMedia('avatar', file);
  });
  coverFile.addEventListener('change', () => {
    const file = coverFile.files[0];
    coverFile.value = '';
    saveMedia('cover', file);
  });

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
    try {
      const { data } = await sb.from('users').select('*').order('username', { ascending: true });
      const people = (data || []).filter(u => String(u.id) !== String(user.id));
      main.querySelector('#pfFriendCount').textContent = people.length;

      friendsGrid.innerHTML = people.length
        ? people.slice(0, 9).map(p => {
          const pname = p.full_name || p.username || 'Member';
          return `<button class="fb-friend" type="button" data-uid="${fbEscape(p.id)}">
            <div class="fb-friend-img">${fbEscape((pname.trim()[0] || '?').toUpperCase())}</div>
            <div class="fb-friend-name">${fbEscape(pname)}</div>
            <div class="fb-friend-meta">${fbEscape(fbRoleLabel(p.role))}</div>
          </button>`;
        }).join('')
        : '<div class="empty-state" style="grid-column:1/-1;padding:1rem;">No friends yet.</div>';

      peopleList.innerHTML = people.length
        ? people.slice(0, 10).map(p => {
          const pname = p.full_name || p.username || 'Member';
          return `<div class="fb-person">
            <div class="fb-person-img">${fbEscape((pname.trim()[0] || '?').toUpperCase())}</div>
            <div class="fb-person-body">
              <div class="fb-person-name">${fbEscape(pname)}</div>
              <div class="fb-person-meta">${fbEscape(fbRoleLabel(p.role))}</div>
              ${canChat ? `<button class="fb-person-btn" type="button" data-uid="${fbEscape(p.id)}">Message</button>` : ''}
            </div>
          </div>`;
        }).join('')
        : '<div class="empty-state" style="padding:1rem;">No suggestions right now.</div>';

      if (canChat) {
        main.querySelectorAll('[data-uid]').forEach(el => {
          el.addEventListener('click', () => window.fbChat.openWith(el.dataset.uid));
        });
      }
    } catch {
      friendsGrid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:1rem;">Could not load friends.</div>';
      peopleList.innerHTML = '<div class="empty-state" style="padding:1rem;">Could not load suggestions.</div>';
      main.querySelector('#pfFriendCount').textContent = '0';
    }
  };

  // Posts = announcements from the main office
  const loadFeed = async () => {
    const feed = main.querySelector('#pfFeed');
    if (!sb) {
      feed.innerHTML = '<div class="empty-state" style="padding:1.5rem;">No posts yet.</div>';
      return;
    }
    try {
      const { data } = await sb.from('announcements').select('*').order('created_at', { ascending: false });
      const posts = data || [];
      feed.innerHTML = posts.length
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
        : '<div class="empty-state" style="padding:1.5rem;">No posts yet.</div>';
    } catch {
      feed.innerHTML = '<div class="empty-state" style="padding:1.5rem;">No posts yet.</div>';
    }
  };

  const composerPost = main.querySelector('#pfComposerPost');
  if (composerPost) {
    composerPost.addEventListener('click', async () => {
      const input = main.querySelector('#pfComposerInput');
      const content = input.value.trim();
      if (!content) return showToast('Write something first', 'error');
      try {
        await sb.from('announcements').insert([{
          title: content.length > 60 ? content.slice(0, 60) + '…' : content,
          content,
          priority: 'normal',
          is_active: true
        }]);
        input.value = '';
        showToast('Posted to the network', 'success');
        loadFeed();
      } catch (e) {
        showToast('Failed to post: ' + e.message, 'error');
      }
    });
  }

  showTab('all');
  loadPeople();
  loadFeed();
};

window.Pages = Pages;
