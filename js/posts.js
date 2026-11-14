// Member posts — text with a photo or video, Facebook-style reactions and comments
var Posts = window.Posts || {};

const POST_VIDEO_MAX = 100 * 1024 * 1024;
const POST_IMAGE_MAX = 20 * 1024 * 1024;

const FB_REACTIONS = {
  like: { label: 'Like', color: '#1877f2' },
  love: { label: 'Love', color: '#f02849' },
  haha: { label: 'Haha', color: '#f7b125' },
  wow: { label: 'Wow', color: '#f7b125' },
  sad: { label: 'Sad', color: '#f7b125' },
  angry: { label: 'Angry', color: '#e9710f' }
};
const REACTION_ORDER = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];

// A member can turn their own photo or video into a reaction,
// saved as "face:<image url>" or "vid:<video url>"
const REACTION_VIDEO_MAX = 5; // seconds

// Each comment in the feed gets its own turn in a looping spotlight
const COMMENT_SPOTLIGHT_MS = 10000; // 10 seconds per comment

function postFaceUrl(type) {
  const match = /^face:(.+)$/.exec(String(type || ''));
  return match ? match[1] : '';
}

function postVidUrl(type) {
  const match = /^vid:(.+)$/.exec(String(type || ''));
  return match ? match[1] : '';
}

// A face or a video the member uploaded themselves
function postOwnReaction(type) {
  return !!postFaceUrl(type) || !!postVidUrl(type);
}

function postReactionLabel(type) {
  if (postVidUrl(type)) return 'Video';
  if (postFaceUrl(type)) return 'Face';
  return (FB_REACTIONS[type] || {}).label || 'Like';
}

function postReactionColor(type) {
  if (postOwnReaction(type)) return '#1877f2';
  return (FB_REACTIONS[type] || {}).color || '#1877f2';
}

function postIsVideo(url) {
  return /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(String(url || ''));
}

function postTimeAgo(value) {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (!isFinite(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + 'm';
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours + 'h';
  const days = Math.round(hours / 24);
  if (days === 1) return 'a day ago';
  if (days < 7) return days + ' days ago';
  return fmtDate(value);
}

function postCount(n) {
  const value = Number(n) || 0;
  if (value >= 1000000) return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (value >= 1000) return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(value);
}

function postAvatar(member, name, cls) {
  const label = String(name || 'Member').trim();
  const url = (member && member.avatar_url) || '';
  const inner = url
    ? (postIsVideo(url)
      ? `<video class="fb-avatar-img" src="${fbEscape(url)}" autoplay muted loop playsinline></video>`
      : `<img class="fb-avatar-img" src="${fbEscape(url)}" alt="" loading="lazy" decoding="async">`)
    : fbEscape((label[0] || '?').toUpperCase());
  return `<span class="fb-avatar ${cls || ''}">${inner}</span>`;
}

function postProfileHref(username) {
  return username ? '#/u/' + encodeURIComponent(username) : '#/App';
}

function postReactionGroups(rows) {
  const counts = {};
  const order = [];
  (rows || []).forEach(r => {
    const type = String(r.type || '');
    if (!postOwnReaction(type) && !FB_REACTIONS[type]) return;
    if (!counts[type]) order.push(type);
    counts[type] = (counts[type] || 0) + 1;
  });
  const known = REACTION_ORDER.filter(t => counts[t]);
  const faces = order.filter(t => postOwnReaction(t));
  return known.concat(faces).map(t => ({
    type: t, label: postReactionLabel(t), count: counts[t]
  }));
}

// A member can stop the face growing/wiggling on one post; kept in this browser
function faceAnimOffKey(postId) {
  return 'meday.faceAnimOff.' + postId;
}

function faceAnimOff(postId) {
  try {
    return localStorage.getItem(faceAnimOffKey(postId)) === '1';
  } catch (err) {
    return false;
  }
}

function setFaceAnimOff(postId, off) {
  try {
    if (off) localStorage.setItem(faceAnimOffKey(postId), '1');
    else localStorage.removeItem(faceAnimOffKey(postId));
  } catch (err) { /* a blocked store only loses the preference */ }
}

function postFaceAnimSwitch(postId, off) {
  return `<label class="fb-face-anim-switch" title="Grow face reactions">
    <input type="checkbox" data-act="toggle-face-anim"${off ? '' : ' checked'} aria-label="Grow face reactions">
    <span class="fb-face-anim-track" aria-hidden="true"></span>
  </label>`;
}

// Video reactions are silent by default. A member can switch the sound on for
// one post; that choice is kept in this browser.
function rxSoundOnKey(postId) {
  return 'meday.rxSoundOn.' + postId;
}

function rxSoundOn(postId) {
  try {
    return localStorage.getItem(rxSoundOnKey(postId)) === '1';
  } catch (err) {
    return false;
  }
}

function setRxSoundOn(postId, on) {
  try {
    if (on) localStorage.setItem(rxSoundOnKey(postId), '1');
    else localStorage.removeItem(rxSoundOnKey(postId));
  } catch (err) { /* a blocked store only loses the preference */ }
}

// One place that decides whether a post's reaction videos can be heard, so the
// switch and the play loop can never disagree. Volume 0 as well, so a video
// that was already playing falls silent the instant the switch goes off.
function applyRxSound(root, on) {
  if (!root) return;
  root.querySelectorAll('.fb-rx-video video').forEach(video => {
    video.muted = !on;
    video.volume = on ? 1 : 0;
  });
}

function postRxSoundSwitch(postId, on) {
  return `<label class="fb-face-anim-switch" title="Reaction sound">
    <input type="checkbox" data-act="toggle-rx-sound"${on ? ' checked' : ''} aria-label="Reaction sound">
    <span class="fb-rx-sound-icon" aria-hidden="true">${on ? '🔊' : '🔇'}</span>
  </label>`;
}

// Each uploaded reaction — a face or a video — shakes in its own turn instead
// of all of them growing at once
function postFaceSlots(groups) {
  const ownCount = groups.filter(g => postOwnReaction(g.type)).length;
  let slot = 0;
  // One stack: a post with uploads shows the standard emoji in a stack of their
  // own, so an uploaded face never hides an emoji beside it
  return `<span class="fb-reaction-group">${groups.map(g => {
    const own = postOwnReaction(g.type);
    const icon = Posts.reactionIcon(g.type, own ? slot++ : 0, ownCount);
    return `<span${own ? ' class="fb-rx-face-slot"' : ''} title="${g.label}">${icon}</span>`;
  }).join('')}</span>`;
}

function postReactionPicker(media) {
  // A member's own uploads sit in the choices with a delete badge, so the
  // reaction can be taken back out by the member who put it there
  const own = (media || []).map(item => {
    const video = item.kind === 'video';
    const type = (video ? 'vid:' : 'face:') + item.image_url;
    const label = video ? 'Your video reaction' : 'Your face reaction';
    return `<span class="fb-reaction-own">
      <button class="fb-reaction-option" type="button" data-react="${fbEscape(type)}" title="${label}" aria-label="Use ${label.toLowerCase()}">${Posts.reactionIcon(type)}</button>
      <button class="fb-reaction-remove" type="button" data-act="remove-face" data-url="${fbEscape(item.image_url)}"${item.id ? ` data-id="${fbEscape(item.id)}"` : ''} title="Delete this reaction" aria-label="Delete ${label.toLowerCase()}">×</button>
    </span>`;
  }).join('');
  return `<div class="fb-reaction-picker">
    ${REACTION_ORDER.map(t =>
      `<button class="fb-reaction-option" type="button" data-react="${t}" title="${FB_REACTIONS[t].label}" aria-label="${FB_REACTIONS[t].label}">${Posts.reactionIcon(t)}</button>`
    ).join('')}${own}
    <button class="fb-reaction-add" type="button" data-act="add-face" title="Upload your own face or a video up to 5 seconds" aria-label="Upload your own face or a short video as a reaction">+</button>
  </div>`;
}

function postMediaHtml(post) {
  if (!post.media_url) return '';
  return `<div class="fb-post-media">${post.media_type === 'video'
    ? `<video class="fb-post-media-el" src="${fbEscape(post.media_url)}" controls playsinline preload="metadata"></video>`
    : `<img class="fb-post-media-el" src="${fbEscape(post.media_url)}" alt="" loading="lazy" decoding="async">`}</div>`;
}

const POST_AUDIENCES = {
  public: { icon: '🌐', label: 'Public' },
  friends: { icon: '👥', label: 'Friends' },
  only_me: { icon: '🔒', label: 'Only me' }
};

function postAudience(post) {
  return POST_AUDIENCES[post && post.audience] || POST_AUDIENCES.public;
}

// The original post shown inside a shared post
function postSharedHtml(shared, users) {
  if (!shared) return '';
  const member = users ? users.get(String(shared.user_id)) : null;
  const name = (member && (member.full_name || member.username)) || shared.author_name || 'Member';
  const username = (member && member.username) || shared.author_username || '';
  return `<div class="fb-share-embed">
    <div class="fb-share-embed-head">
      <a class="fb-share-embed-avatar" href="${postProfileHref(username)}" aria-label="${fbEscape(name)}">${postAvatar(member, name, 'fb-avatar-xs')}</a>
      <div>
        <a class="fb-share-embed-name" href="${postProfileHref(username)}">${fbEscape(name)}</a>
        <div class="fb-share-embed-time">${fbEscape(postTimeAgo(shared.created_at))}</div>
      </div>
    </div>
    ${shared.content ? `<div class="fb-share-embed-text">${fbEscape(shared.content)}</div>` : ''}
    ${postMediaHtml(shared)}
  </div>`;
}

// Replies are keyed by the comment they answer, so a thread can be painted to
// any depth: every comment carries its own Reply button.
function postCommentChildren(comments) {
  const map = new Map();
  comments.forEach(c => {
    if (!c.parent_id) return;
    const key = String(c.parent_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(c);
  });
  return id => map.get(String(id)) || [];
}

function postCommentHtml(comment, ctx, childrenOf) {
  const viewer = ctx.viewer || {};
  const member = ctx.users ? ctx.users.get(String(comment.user_id)) : null;
  const name = (member && (member.full_name || member.username)) || comment.user_name || 'Member';
  const username = (member && member.username) || '';
  const rows = (ctx.commentReactions && ctx.commentReactions.get(String(comment.id))) || [];
  const groups = postReactionGroups(rows);
  const mine = rows.find(r => String(r.user_id) === String(viewer.id));
  const own = String(comment.user_id) === String(viewer.id);
  // The comment's writer, the member who posted it, or an admin can remove it
  const admin = typeof AdminModerate !== 'undefined' && AdminModerate.can();
  const canDelete = own || admin || (ctx.postOwnerId !== undefined
    && String(ctx.postOwnerId) === String(viewer.id));

  return `<div class="fb-comment" data-comment="${fbEscape(comment.id)}">
    <a class="fb-comment-avatar" href="${postProfileHref(username)}" aria-label="${fbEscape(name)}">${postAvatar(member, name, 'fb-avatar-xs')}</a>
    <div class="fb-comment-main">
      <div class="fb-comment-bubble">
        <a class="fb-comment-name" href="${postProfileHref(username)}">${fbEscape(name)}</a>
        <div class="fb-comment-body">${fbEscape(comment.body)}</div>
        ${groups.length
          ? `<span class="fb-comment-reactions">${groups.map(g => `${Posts.reactionIcon(g.type)}<b>${postCount(g.count)}</b>`).join('')}</span>`
          : ''}
      </div>
      <div class="fb-comment-meta">
        <div class="fb-react-wrap${ctx.openPicker === ctx.postId + ':' + comment.id ? ' open' : ''}">
          <button class="fb-comment-act${mine ? ' active' : ''}" type="button" data-act="react-comment"${mine ? ` style="color:${postReactionColor(mine.type)}"` : ''}>${mine ? postReactionLabel(mine.type) : 'Like'}</button>
          <button class="fb-react-more" type="button" data-act="react-picker" aria-label="Choose a reaction">▴</button>
          ${postReactionPicker(ctx.faces)}
        </div>
        <span class="fb-comment-time">${fbEscape(postTimeAgo(comment.created_at))}</span>
        ${comment.edited_at ? '<span class="fb-comment-edited">Edited</span>' : ''}
        ${own ? `<button class="fb-comment-act" type="button" data-act="edit-comment">Edit</button>` : ''}
        ${canDelete ? `<button class="fb-comment-act" type="button" data-act="delete-comment">Delete</button>` : ''}
        <button class="fb-comment-act" type="button" data-act="reply-comment">Reply</button>
      </div>
      ${childrenOf && childrenOf(comment.id).length
        ? `<div class="fb-comment-replies">${childrenOf(comment.id)
          .map(r => postCommentHtml(r, ctx, childrenOf)).join('')}</div>`
        : ''}
    </div>
  </div>`;
}

// One Facebook-style post card
Posts.card = function (post, ctx) {
  const viewer = ctx.viewer || {};
  const author = ctx.author || null;
  const authorName = (author && (author.full_name || author.username)) || post.author_name || 'Member';
  const authorUsername = (author && author.username) || post.author_username || '';
  const reactions = ctx.reactions || [];
  const comments = ctx.comments || [];
  const groups = postReactionGroups(reactions);
  const mine = reactions.find(r => String(r.user_id) === String(viewer.id));
  const totalReactions = groups.reduce((sum, g) => sum + g.count, 0);
  const shares = Number(post.share_count) || 0;
  const viewerName = viewer.full_name || viewer.username || 'Member';
  const audience = postAudience(post);
  const hasFaces = groups.some(g => postOwnReaction(g.type));
  const faceOff = hasFaces && faceAnimOff(post.id);
  // When a post carries uploaded reactions, the standard emoji leave the pile
  // and sit in the free space between the reactions and the comment count
  const faceGroups = groups.filter(g => postOwnReaction(g.type));
  const emojiGroups = groups.filter(g => !postOwnReaction(g.type));
  const children = postCommentChildren(comments);
  // A friend's post on the home feed can be hidden, and restored later
  const canHideAuthor = !!ctx.friendsOnly && !!viewer.id
    && String(post.user_id) !== String(viewer.id)
    && !!ctx.friendIds && ctx.friendIds.has(String(post.user_id));

  return `<article class="fb-card fb-post-card" data-post="${fbEscape(post.id)}">
    <div class="fb-post-head">
      <a class="fb-post-avatar" href="${postProfileHref(authorUsername)}" aria-label="${fbEscape(authorName)}">${postAvatar(author, authorName)}</a>
      <div class="fb-post-id">
        <a class="fb-post-name" href="${postProfileHref(authorUsername)}">${fbEscape(authorName)}</a>
        <div class="fb-post-time">${fbEscape(postTimeAgo(post.created_at))} · <span title="${audience.label}" aria-label="${audience.label}">${audience.icon}</span></div>
      </div>
      ${(canHideAuthor || hasFaces) ? `<span class="fb-post-toggles">
        ${canHideAuthor ? `<button class="fb-post-hide" type="button" data-act="hide-author" data-author="${fbEscape(post.user_id)}" title="Hide posts from ${fbEscape(authorName)}" aria-label="Hide posts from ${fbEscape(authorName)}">✕</button>` : ''}
        ${hasFaces ? `${postFaceAnimSwitch(post.id, faceOff)}${postRxSoundSwitch(post.id, rxSoundOn(post.id))}` : ''}
      </span>` : ''}
    </div>
    ${post.content ? `<div class="fb-post-text">${fbEscape(post.content)}</div>` : ''}
    ${ctx.shared ? postSharedHtml(ctx.shared, ctx.users) : ''}
    ${postMediaHtml(post)}
    ${totalReactions || comments.length || shares
      ? `<div class="fb-post-stats">
          <span class="fb-post-summary">${totalReactions
            ? `<span class="fb-reaction-icons${faceOff ? ' fb-face-anim-off' : ''}">${postFaceSlots(faceGroups.length ? faceGroups : groups)}</span>${postCount(totalReactions)}`
            : ''}</span>
          ${faceGroups.length && emojiGroups.length
            ? `<span class="fb-post-emoji fb-reaction-icons">${postFaceSlots(emojiGroups)}</span>`
            : ''}
          <span class="fb-post-counts">
            ${comments.length ? `<button type="button" data-act="focus-comment">${postCount(comments.length)} comment${comments.length === 1 ? '' : 's'}</button>` : ''}
            ${shares ? `<span>${postCount(shares)} share${shares === 1 ? '' : 's'}</span>` : ''}
          </span>
        </div>`
      : ''}
    <div class="fb-post-actions">
      <div class="fb-react-wrap${ctx.openPicker === String(post.id) ? ' open' : ''}">
        <button class="fb-post-act${mine ? ' active' : ''}" type="button" data-act="react"${mine ? ` style="color:${postReactionColor(mine.type)}"` : ''}>
          ${Posts.reactionIcon(mine ? mine.type : 'like')}<span>${mine ? postReactionLabel(mine.type) : 'Like'}</span>
        </button>
        <button class="fb-react-more" type="button" data-act="react-picker" aria-label="Choose a reaction">▴</button>
        ${postReactionPicker(ctx.faces)}
      </div>
      <button class="fb-post-act" type="button" data-act="focus-comment"><span aria-hidden="true">💬</span><span>Comment</span></button>
      <button class="fb-post-act" type="button" data-act="share"><span aria-hidden="true">↗</span><span>Share</span></button>
    </div>
    <div class="fb-comments">
      ${comments.filter(c => !c.parent_id).map(c => postCommentHtml(c, ctx, children)).join('')}
      ${ctx.locked
        ? `<div class="fb-composer-locked"><span aria-hidden="true">🔒</span><span>Commenting unlocks once an admin approves your profile picture or video.</span></div>`
        : `<div class="fb-comment-form">
        ${postAvatar(viewer, viewerName, 'fb-avatar-xs')}
        <div class="fb-comment-box">
          <input class="fb-comment-input" type="text" data-comment-input placeholder="Write a comment…" aria-label="Write a comment">
          <button class="fb-comment-send" type="button" data-act="send-comment" aria-label="Send comment">➤</button>
        </div>
      </div>`}
    </div>
  </article>`;
};

// Composer: text plus one photo or video
Posts.composerMarkup = function (viewer, placeholder) {
  const name = (viewer && (viewer.full_name || viewer.username)) || 'Member';
  // A member waiting for approval reads the feed but cannot upload or post yet
  if (ReadOnlyMode.active()) {
    return `<div class="fb-composer-locked"><span aria-hidden="true">🔒</span><span>Uploading and posting unlock once an admin approves your profile picture or video.</span></div>`;
  }
  return `<div class="fb-posts-composer" data-composer>
    <div class="fb-composer">
      ${postAvatar(viewer, name, 'fb-avatar-sm')}
      <input type="text" data-post-text placeholder="${fbEscape(placeholder || "What's on your mind?")}" aria-label="Write a post">
    </div>
    <div class="fb-composer-preview" data-preview hidden></div>
    <div class="fb-composer-upload" data-upload hidden>
      <div class="fb-composer-upload-track"><i data-upload-bar></i></div>
      <span class="fb-composer-upload-label" data-upload-label></span>
    </div>
    <div class="fb-composer-foot">
      <div class="fb-composer-tools">
        <button class="fb-composer-tool" type="button" data-pick="image"><span aria-hidden="true">🖼️</span> Photo</button>
        <button class="fb-composer-tool" type="button" data-pick="video"><span aria-hidden="true">🎬</span> Video</button>
      </div>
      <button class="fb-btn fb-btn-primary" type="button" data-post-submit>Post</button>
    </div>
  </div>`;
};

Posts.composer = function (root, opts) {
  const options = opts || {};
  const viewer = options.viewer || {};
  const wrap = root.matches('[data-composer]') ? root : root.querySelector('[data-composer]');
  if (!wrap) return;
  const textEl = wrap.querySelector('[data-post-text]');
  const preview = wrap.querySelector('[data-preview]');
  const submit = wrap.querySelector('[data-post-submit]');
  const uploadEl = wrap.querySelector('[data-upload]');
  const uploadBar = wrap.querySelector('[data-upload-bar]');
  const uploadLabel = wrap.querySelector('[data-upload-label]');
  let file = null;
  let busy = false;

  // The line that fills while the file travels, so a big video answers the
  // moment it is picked instead of looking stuck until it lands
  function beginUpload(kind) {
    const noun = kind === 'video' ? 'video' : 'photo';
    uploadEl.hidden = false;
    uploadBar.style.width = '0%';
    uploadLabel.textContent = 'Uploading ' + noun + '…';
    submit.textContent = 'Uploading…';
    return {
      progress(fraction) {
        const pct = Math.max(0, Math.min(100, Math.round(fraction * 100)));
        uploadBar.style.width = pct + '%';
        // The last chunk is still being processed by the host after it arrives
        if (pct >= 100) {
          uploadLabel.textContent = 'Finishing ' + noun + '…';
          submit.textContent = 'Posting…';
          return;
        }
        uploadLabel.textContent = 'Uploading ' + noun + ' ' + pct + '%';
        submit.textContent = pct + '%';
      },
      done() {
        uploadEl.hidden = true;
        submit.textContent = 'Post';
      }
    };
  }

  function paintPreview() {
    if (!file) {
      preview.hidden = true;
      preview.innerHTML = '';
      return;
    }
    const url = URL.createObjectURL(file);
    const isVideo = String(file.type || '').startsWith('video/');
    preview.hidden = false;
    preview.innerHTML = `${isVideo
      ? `<video class="fb-composer-media" src="${url}" muted playsinline controls></video>`
      : `<img class="fb-composer-media" src="${url}" alt="">`}
      <button class="fb-composer-remove" type="button" data-clear aria-label="Remove attachment">✕</button>`;
  }

  wrap.querySelectorAll('[data-pick]').forEach(button => {
    const kind = button.dataset.pick;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = kind === 'video' ? 'video/*' : 'image/*';
    input.hidden = true;
    wrap.appendChild(input);
    button.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      const picked = input.files && input.files[0];
      input.value = '';
      if (!picked) return;
      const isVideo = String(picked.type || '').startsWith('video/');
      if (isVideo && picked.size > POST_VIDEO_MAX) return showToast('Videos must be 100 MB or smaller', 'error', 5000);
      if (!isVideo && picked.size > POST_IMAGE_MAX) return showToast('Photos must be 20 MB or smaller', 'error', 5000);
      file = picked;
      paintPreview();
    });
  });

  wrap.addEventListener('click', e => {
    if (e.target.closest('[data-clear]')) {
      file = null;
      paintPreview();
    }
  });

  async function send() {
    if (busy) return;
    const content = textEl.value.trim();
    if (!content && !file) return showToast('Write something or add a photo or video', 'error');
    if (!sb) return showToast('Posting needs a connected database', 'error');
    busy = true;
    submit.disabled = true;
    let upload = null;
    try {
      let mediaUrl = '';
      let mediaType = '';
      if (file) {
        const isVideo = String(file.type || '').startsWith('video/');
        upload = beginUpload(isVideo ? 'video' : 'photo');
        const payload = isVideo ? file : await shrinkImage(file, 1600).catch(() => file);
        mediaUrl = await cloudinaryUpload(payload, fraction => upload.progress(fraction));
        if (!mediaUrl) throw new Error('image hosting is not connected');
        mediaType = isVideo ? 'video' : 'image';
      }
      const { error } = await sb.from('posts').insert([{
        user_id: viewer.id,
        author_name: viewer.full_name || viewer.username,
        author_username: viewer.username,
        content,
        media_url: mediaUrl || null,
        media_type: mediaType || null
      }]);
      if (error) throw error;
      textEl.value = '';
      file = null;
      paintPreview();
      showToast('Posted', 'success');
      if (options.onPosted) options.onPosted();
    } catch (err) {
      const message = String((err && err.message) || '');
      showToast(/relation|Could not find the table/i.test(message)
        ? 'Run supabase/migrations/012_create_posts.sql in Supabase first'
        : 'Could not post: ' + message, 'error', 6000);
    } finally {
      if (upload) upload.done();
      busy = false;
      submit.disabled = false;
    }
  }

  submit.addEventListener('click', send);
  textEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  });
};

// Mounts a list of member posts: loads data, renders cards and handles every interaction
Posts.mount = function (listEl, opts) {
  const options = opts || {};
  const viewer = options.viewer || (window.Auth && Auth.currentUser) || {};

  // Friends whose posts the member chose to stop seeing on the home feed.
  // Kept in this browser, so the feed remembers the choice next time.
  function hiddenFriends() {
    try {
      const list = JSON.parse(localStorage.getItem('meday.hiddenFriends.' + (viewer.id || 'guest')) || '[]');
      return Array.isArray(list) ? list.filter(h => h && h.id) : [];
    } catch {
      return [];
    }
  }

  function saveHiddenFriends(list) {
    try {
      localStorage.setItem('meday.hiddenFriends.' + (viewer.id || 'guest'), JSON.stringify(list));
    } catch { /* a blocked store only loses the choice */ }
  }

  const hiddenAtStart = hiddenFriends();

  const state = {
    posts: [],
    users: new Map(),
    reactions: new Map(),
    comments: new Map(),
    commentReactions: new Map(),
    shared: new Map(),
    friendIds: null,
    hidden: hiddenAtStart,
    hiddenIds: new Set(hiddenAtStart.map(h => String(h.id))),
    faces: [],
    // Which reaction picker stays open until a reaction is clicked
    openPicker: null,
    query: ''
  };

  function mapPush(map, key, value) {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  }

  function findPost(id) {
    return state.posts.find(p => String(p.id) === String(id));
  }

  function closePickers() {
    state.openPicker = null;
    listEl.querySelectorAll('.fb-react-wrap.open').forEach(w => w.classList.remove('open'));
  }

  // Repaints every reaction picker so an upload or a delete shows up in all of
  // them, not only on the post that was used last
  function refreshReactionPickers() {
    listEl.querySelectorAll('.fb-react-wrap > .fb-reaction-picker').forEach(picker => {
      picker.outerHTML = postReactionPicker(state.faces);
    });
  }

  // Identifies one reaction picker so it can survive a card re-render
  function pickerKeyFor(wrap) {
    const postEl = wrap && wrap.closest('[data-post]');
    if (!postEl) return null;
    const commentEl = wrap.closest('[data-comment]');
    return String(postEl.dataset.post) + (commentEl ? ':' + commentEl.dataset.comment : '');
  }

  function sharedFor(post) {
    if (!post.shared_post_id) return null;
    return state.shared.get(String(post.shared_post_id))
      || state.posts.find(p => String(p.id) === String(post.shared_post_id))
      || null;
  }

  function ctxFor(post) {
    return {
      viewer,
      users: state.users,
      author: state.users.get(String(post.user_id)),
      shared: sharedFor(post),
      reactions: state.reactions.get(String(post.id)) || [],
      comments: state.comments.get(String(post.id)) || [],
      commentReactions: state.commentReactions,
      faces: state.faces || [],
      openPicker: state.openPicker,
      postId: String(post.id),
      postOwnerId: String(post.user_id),
      friendsOnly: !!options.friendsOnly,
      friendIds: state.friendIds,
      locked: ReadOnlyMode.active()
    };
  }

  // "Only me" stays private, "Friends" shows to accepted friends of the author
  function visibleToViewer(post) {
    const audience = post.audience || 'public';
    const authorId = String(post.user_id);
    const own = !!viewer.id && authorId === String(viewer.id);
    // The home feed shows the member's own posts and their friends' posts only,
    // minus the friends whose posts they chose to hide
    if (options.friendsOnly && viewer.id && !own) {
      if (!state.friendIds || !state.friendIds.has(authorId)) return false;
      if (state.hiddenIds.has(authorId)) return false;
    }
    if (audience === 'public' || own) return true;
    if (audience === 'friends') {
      // A visitor who is not signed in only sees public posts
      if (!viewer.id) return false;
      return state.friendIds ? state.friendIds.has(String(post.user_id)) : true;
    }
    return false;
  }

  // ---------- Comment spotlight ----------
  // Only the post on screen gets the spotlight: its comments are highlighted
  // one at a time in a loop, 10 seconds each. A post without comments shows
  // nothing, and scrolling onto another post hands it the turn.
  const SPOTLIGHT_TOP_BAR = 72; // height of the sticky top bar
  let spotlightTimer = 0;
  let spotlightScrollTimer = 0;
  let spotlightIgnoreScrollUntil = 0;
  let spotlightPost = null; // the post on screen that owns the highlight
  let spotlightIndex = 0;
  let spotlightCommentId = ''; // the comment lit right now
  let spotlightEndsAt = 0;     // when its turn ends
  // The page never pans by itself before the visitor scrolls: arriving on a
  // profile keeps the bar, the logo and the cover on screen
  let spotlightUserScrolled = false;
  ['wheel', 'touchmove', 'keydown'].forEach(type => {
    window.addEventListener(type, () => { spotlightUserScrolled = true; }, { passive: true });
  });

  // The post being viewed: the first one starting in the upper part of the
  // screen. When none starts there (only the tail of a previous post shows),
  // the post at the middle of the screen wins.
  function focusedPost() {
    const cards = Array.from(listEl.querySelectorAll('.fb-post-card[data-post]'));
    const line = SPOTLIGHT_TOP_BAR + (window.innerHeight - SPOTLIGHT_TOP_BAR) * 0.35;
    const starting = cards.find(card => {
      const top = card.getBoundingClientRect().top;
      return top >= SPOTLIGHT_TOP_BAR && top <= line;
    });
    if (starting) return starting;
    const middle = SPOTLIGHT_TOP_BAR + (window.innerHeight - SPOTLIGHT_TOP_BAR) / 2;
    let best = null;
    let bestDistance = Infinity;
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      if (rect.bottom < SPOTLIGHT_TOP_BAR) return; // scrolled past
      if (rect.top <= middle && rect.bottom >= middle) {
        best = card;
        bestDistance = 0;
        return;
      }
      const distance = rect.top > middle ? rect.top - middle : middle - rect.bottom;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = card;
      }
    });
    return best;
  }

  // The spotlit comment is lifted to the first line of its thread so it never
  // stays buried; it drops back into its own place when its turn is over.
  let spotlightLifted = null; // { el, homePrev }

  function lowerSpotlightComment() {
    if (!spotlightLifted) return;
    const { el, homePrev } = spotlightLifted;
    spotlightLifted = null;
    if (!el.isConnected || !el.parentNode) return;
    if (homePrev && homePrev.isConnected && homePrev.parentNode === el.parentNode) {
      homePrev.after(el);
    } else {
      el.parentNode.prepend(el);
    }
  }

  function liftSpotlightComment(comment) {
    const thread = comment.parentNode;
    const firstComment = thread ? thread.querySelector('.fb-comment') : null;
    if (!firstComment || firstComment === comment) return;
    spotlightLifted = { el: comment, homePrev: comment.previousElementSibling };
    thread.insertBefore(comment, firstComment);
  }

  function clearSpotlightMark() {
    listEl.querySelectorAll('.fb-comment-spotlight')
      .forEach(el => el.classList.remove('fb-comment-spotlight'));
    lowerSpotlightComment();
  }

  // The page only moves when the lit comment is actually out of view, and a
  // downward scroll stops as soon as the post's own top reaches the top bar —
  // so the author, the text and the action buttons stay put on screen.
  function keepSpotlightVisible(comment) {
    const card = comment.closest('.fb-post-card') || spotlightPost;
    const topLimit = SPOTLIGHT_TOP_BAR + 8;
    const bottomLimit = window.innerHeight - 8;
    const rect = comment.getBoundingClientRect();
    // Already in view: leave the page completely still
    if (rect.top >= topLimit && rect.bottom <= bottomLimit) return;
    let delta = rect.bottom > bottomLimit ? rect.bottom - bottomLimit : rect.top - topLimit;
    if (delta > 0 && card) {
      // Never shove the post's own top — and the member who wrote it — away
      const room = card.getBoundingClientRect().top - topLimit;
      delta = Math.min(delta, Math.max(0, room));
    }
    if (delta) window.scrollBy({ top: delta, behavior: 'smooth' });
  }

  function clearSpotlight() {
    clearTimeout(spotlightTimer);
    spotlightTimer = 0;
    spotlightCommentId = '';
    spotlightEndsAt = 0;
    clearSpotlightMark();
  }

  function spotlightNext() {
    spotlightTimer = 0;
    // The feed was replaced (tab change), so the loop has nothing left to show
    if (!listEl.isConnected) return clearSpotlight();
    // The turns keep coming while the member is writing or editing a comment —
    // only the automatic scroll waits, so the page never jumps under them
    const active = document.activeElement;
    const typing = !!(active && listEl.contains(active)
      && active.closest('.fb-comment-form, .fb-comment-edit'));
    if (!spotlightPost || !spotlightPost.isConnected) spotlightPost = focusedPost();
    clearSpotlightMark();
    // A post without comments has nothing to highlight — just wait for one.
    // Only the top-level comments take turns; replies stay unlit under them.
    const comments = spotlightPost
      ? Array.from(spotlightPost.querySelectorAll('.fb-comments > .fb-comment'))
      : [];
    if (!comments.length) {
      spotlightTimer = setTimeout(spotlightNext, COMMENT_SPOTLIGHT_MS);
      return;
    }
    if (spotlightIndex >= comments.length) spotlightIndex = 0;
    const comment = comments[spotlightIndex];
    comment.classList.add('fb-comment-spotlight');
    // Move it to the first line of the thread while it is lit
    liftSpotlightComment(comment);
    spotlightCommentId = String(comment.dataset.comment);
    spotlightEndsAt = Date.now() + COMMENT_SPOTLIGHT_MS;
    // Keep the lit comment readable without scrolling the post away: the page
    // only moves if the comment is out of view. The scroll it causes must not
    // be mistaken for the member choosing another post.
    if (!typing && spotlightUserScrolled) {
      spotlightIgnoreScrollUntil = Date.now() + 1200;
      keepSpotlightVisible(comment);
    }
    spotlightIndex = (spotlightIndex + 1) % comments.length;
    spotlightTimer = setTimeout(spotlightNext, COMMENT_SPOTLIGHT_MS);
  }

  // Called after the feed repaints (a new comment, a reaction). A card that was
  // rebuilt must not interrupt the lit comment's turn: it is put back on the
  // repainted card and keeps the time it has left.
  function startCommentSpotlight() {
    clearTimeout(spotlightTimer);
    spotlightTimer = 0;
    const left = spotlightEndsAt - Date.now();
    const lit = spotlightCommentId && left > 0
      ? listEl.querySelector('.fb-comment[data-comment="' + spotlightCommentId + '"]')
      : null;
    if (lit) {
      listEl.querySelectorAll('.fb-comment-spotlight').forEach(el => {
        if (el !== lit) el.classList.remove('fb-comment-spotlight');
      });
      lit.classList.add('fb-comment-spotlight');
      // Its old node is gone with the repaint, so the lift starts over
      if (spotlightLifted && !spotlightLifted.el.isConnected) spotlightLifted = null;
      liftSpotlightComment(lit);
      spotlightPost = lit.closest('[data-post]') || spotlightPost;
      spotlightTimer = setTimeout(spotlightNext, left);
      return;
    }
    clearSpotlight();
    spotlightTimer = setTimeout(spotlightNext, 600);
  }

  // Scrolling onto another post hands it the spotlight right away
  if (!listEl.dataset.spotlightScroll) {
    listEl.dataset.spotlightScroll = '1';
    window.addEventListener('scroll', () => {
      if (!listEl.isConnected) return;
      if (Date.now() < spotlightIgnoreScrollUntil) return;
      clearTimeout(spotlightScrollTimer);
      spotlightScrollTimer = setTimeout(() => {
        const post = focusedPost();
        if (post === spotlightPost) return;
        spotlightPost = post;
        spotlightIndex = 0;
        clearSpotlight();
        spotlightNext();
      }, 150);
    }, { passive: true });
  }

  // ---------- Hiding and restoring a friend's posts ----------

  function hideAuthorPosts(postId) {
    const post = findPost(postId);
    if (!post) return;
    const authorId = String(post.user_id);
    const member = state.users.get(authorId);
    const name = (member && (member.full_name || member.username)) || post.author_name || 'this friend';
    if (!state.hiddenIds.has(authorId)) {
      state.hiddenIds.add(authorId);
      state.hidden.push({ id: authorId, name });
      saveHiddenFriends(state.hidden);
    }
    renderAll();
    showToast(`Hiding ${name}'s posts — restore them at the top of your feed`, 'success', 4000);
  }

  function showAuthorPosts(authorId) {
    const id = String(authorId);
    const row = state.hidden.find(h => String(h.id) === id);
    state.hidden = state.hidden.filter(h => String(h.id) !== id);
    state.hiddenIds.delete(id);
    saveHiddenFriends(state.hidden);
    renderAll();
    showToast(`${(row && row.name) || 'That friend'}'s posts are back`, 'success');
  }

  // The "restore" list that sits at the top of the home feed
  function hiddenStrip() {
    if (!options.friendsOnly || !state.hidden.length) return '';
    return `<div class="fb-card fb-hidden-strip">
      <span class="fb-hidden-strip-label">Hidden friends (${state.hidden.length})</span>
      <span class="fb-hidden-strip-list">${state.hidden.map(h => `
        <button type="button" data-act="show-author" data-author="${fbEscape(h.id)}" title="See ${fbEscape(h.name)}'s posts again">↩ ${fbEscape(h.name)}</button>
      `).join('')}</span>
    </div>`;
  }

  const emptyFeedHtml = options.friendsOnly
    ? '<div class="fb-card fb-feed-empty">No posts from your friends yet. Add friends from the Friends tab to see their posts here.</div>'
    : '';

  function renderAll() {
    const q = state.query.trim().toLowerCase();
    const shown = state.posts.filter(visibleToViewer).filter(p => !q
      || `${p.content || ''} ${p.author_name || ''}`.toLowerCase().includes(q));
    // Stop the videos of the cards being replaced: a detached video keeps
    // playing its sound until it is paused by name
    stopVideoReactions();
    listEl.innerHTML = hiddenStrip() + (shown.length
      ? shown.map(p => Posts.card(p, ctxFor(p))).join('')
      : (options.emptyHtml || emptyFeedHtml));
    startVideoReactions();
    startCommentSpotlight();
  }

  // A video reaction plays with its own sound while the one-by-one loop gives
  // it its growing and wiggling turn, then stops once the video's maximum play
  // time is done (or the video itself ends). Turning a post's switch off stops
  // it right away
  const videoTimers = [];

  function stopVideoReactions() {
    videoTimers.splice(0).forEach(clearTimeout);
    listEl.querySelectorAll('.fb-post-summary .fb-rx-video').forEach(holder => {
      clearTimeout(holder.rxStop);
      holder.rxPlaying = false;
      const video = holder.querySelector('video');
      if (video) video.pause();
    });
  }

  function playVideoReaction(holder) {
    const video = holder.querySelector('video');
    if (!video) return;
    clearTimeout(holder.rxStop);
    video.pause();
    if (video.currentTime) video.currentTime = 0;
    const card = holder.closest('[data-post]');
    // Silent unless the member switched this post's sound on
    const soundOn = card ? rxSoundOn(card.dataset.post) : false;
    video.muted = !soundOn;
    video.volume = soundOn ? 1 : 0;
    holder.rxPlaying = true;
    const attempt = video.play();
    if (attempt && attempt.catch) attempt.catch(() => {
      // A browser that blocks sound still shows the video, played silently
      video.muted = true;
      video.play().catch(() => {});
    });
    // It plays its full maximum on its turn and then stops, sound included
    holder.rxStop = setTimeout(() => {
      holder.rxPlaying = false;
      video.pause();
    }, REACTION_VIDEO_MAX * 1000);
  }

  function startVideoReactions() {
    stopVideoReactions();
    listEl.querySelectorAll('.fb-post-summary .fb-rx-video').forEach(holder => {
      const video = holder.querySelector('video');
      if (!video) return;
      if (!holder.rxEndHooked) {
        holder.rxEndHooked = '1';
        video.addEventListener('ended', () => { holder.rxPlaying = false; });
      }
      // No turn loop here (switch off, or a small screen): just play it once
      const looping = getComputedStyle(holder).animationName !== 'none';
      const turn = (parseFloat(holder.style.animationDelay) || 0) * 1000;
      const period = (parseFloat(holder.style.animationDuration) || 0) * 1000;
      if (!looping || !period) {
        playVideoReaction(holder);
        return;
      }
      // Each turn starts a full play; a turn that arrives while the video is
      // still playing its maximum leaves it running instead of cutting it off
      const tick = () => {
        if (!holder.rxPlaying) playVideoReaction(holder);
        videoTimers.push(setTimeout(tick, period));
      };
      videoTimers.push(setTimeout(tick, turn));
    });
  }

  async function load() {
    if (!sb) {
      state.posts = [];
      renderAll();
      return;
    }
    state.users = new Map();
    state.reactions = new Map();
    state.comments = new Map();
    state.commentReactions = new Map();
    state.shared = new Map();
    // Friends and reaction faces are only needed to paint, so they load next to
    // the posts instead of costing extra round trips before the feed shows
    const friendsPromise = loadFriendIds();
    const facesPromise = loadReactionMedia();

    // The home feed drops non-friends' posts, so it reads a little deeper
    let query = sb.from('posts').select('*').order('created_at', { ascending: false })
      .limit(options.limit || (options.friendsOnly ? 60 : 30));
    if (options.authorId) query = query.eq('user_id', options.authorId);
    const { data: rows, error } = await query;
    state.friendIds = await friendsPromise;
    state.faces = await facesPromise;
    if (error) {
      state.posts = [];
      listEl.innerHTML = options.emptyHtml || '';
      return;
    }
    state.posts = rows || [];
    if (!state.posts.length) {
      renderAll();
      return;
    }

    // The posts behind a share may sit outside this list, so load them for the
    // preview. Comments, reactions and those originals are independent reads,
    // so they go out together rather than one round trip after another.
    const loadedIds = new Set(state.posts.map(p => String(p.id)));
    const sharedIds = Array.from(new Set(
      state.posts.map(p => p.shared_post_id).filter(Boolean).map(String)
    )).filter(id => !loadedIds.has(id));

    const postIds = state.posts.map(p => p.id);
    const [commentsRes, reactionsRes, originalsRes] = await Promise.all([
      sb.from('post_comments').select('*').in('post_id', postIds).order('created_at', { ascending: true }),
      sb.from('post_reactions').select('*').in('post_id', postIds),
      sharedIds.length
        ? sb.from('posts').select('*').in('id', sharedIds)
        : Promise.resolve({ data: [] })
    ]);
    const comments = commentsRes.data;
    (originalsRes.data || []).forEach(p => state.shared.set(String(p.id), p));
    (comments || []).forEach(c => mapPush(state.comments, String(c.post_id), c));
    (reactionsRes.data || []).forEach(r => mapPush(state.reactions, String(r.post_id), r));

    const peopleIds = Array.from(new Set(
      state.posts.map(p => p.user_id)
        .concat(Array.from(state.shared.values()).map(p => p.user_id))
        .concat((comments || []).map(c => c.user_id))
        .filter(Boolean)
    ));
    const commentIds = (comments || []).map(c => c.id);
    // The writers and the comment reactions are independent too
    const [peopleRes, commentReactionsRes] = await Promise.all([
      peopleIds.length
        ? sb.from('users').select('id, username, full_name, avatar_url').in('id', peopleIds)
        : Promise.resolve({ data: [] }),
      commentIds.length
        ? sb.from('comment_reactions').select('*').in('comment_id', commentIds)
        : Promise.resolve({ data: [] })
    ]);
    (peopleRes.data || []).forEach(p => state.users.set(String(p.id), p));
    (commentReactionsRes.data || []).forEach(r => mapPush(state.commentReactions, String(r.comment_id), r));

    renderAll();
  }

  // Reloads one post's reactions and comments, then repaints just that card
  async function refreshCard(postId) {
    const post = findPost(postId);
    if (!post) return;
    const key = String(postId);
    // One request pair instead of a queue, so a tapped button settles quickly
    const [reactionsRes, commentsRes] = await Promise.all([
      sb.from('post_reactions').select('*').eq('post_id', postId),
      sb.from('post_comments').select('*').eq('post_id', postId).order('created_at', { ascending: true })
    ]);
    const reactions = reactionsRes.data;
    const comments = commentsRes.data;
    state.reactions.set(key, reactions || []);
    state.comments.set(key, comments || []);
    (comments || []).forEach(c => state.commentReactions.delete(String(c.id)));
    if (comments && comments.length) {
      const { data: commentReactions } = await sb.from('comment_reactions')
        .select('*').in('comment_id', comments.map(c => c.id));
      (commentReactions || []).forEach(r => mapPush(state.commentReactions, String(r.comment_id), r));
    }
    const el = listEl.querySelector(`[data-post="${key}"]`);
    if (el) el.outerHTML = Posts.card(post, ctxFor(post));
    startVideoReactions();
    startCommentSpotlight();
  }

  async function setReaction(postId, type) {
    const key = String(postId);
    const existing = (state.reactions.get(key) || []).find(r => String(r.user_id) === String(viewer.id));
    let error = null;
    if (existing && existing.type === type) {
      ({ error } = await sb.from('post_reactions').delete().eq('id', existing.id));
    } else if (existing) {
      ({ error } = await sb.from('post_reactions').update({ type }).eq('id', existing.id));
    } else {
      ({ error } = await sb.from('post_reactions').insert([{
        post_id: postId,
        user_id: viewer.id,
        user_name: viewer.full_name || viewer.username,
        type
      }]));
    }
    if (error) return showToast('Could not save your reaction', 'error');
    await refreshCard(postId);
  }

  async function setCommentReaction(postId, commentId, type) {
    const rows = state.commentReactions.get(String(commentId)) || [];
    const existing = rows.find(r => String(r.user_id) === String(viewer.id));
    let error = null;
    if (existing && existing.type === type) {
      ({ error } = await sb.from('comment_reactions').delete().eq('id', existing.id));
    } else if (existing) {
      ({ error } = await sb.from('comment_reactions').update({ type }).eq('id', existing.id));
    } else {
      ({ error } = await sb.from('comment_reactions').insert([{
        comment_id: commentId,
        user_id: viewer.id,
        user_name: viewer.full_name || viewer.username,
        type
      }]));
    }
    if (error) return showToast('Could not save your reaction', 'error');
    await refreshCard(postId);
  }

  // The reply box of one comment, never one belonging to a reply inside it
  const REPLY_BOX = ':scope > .fb-comment-main > .fb-comment-reply-form';

  // Opens a small reply box under the comment the member answered
  function openReplyBox(commentEl) {
    const open = commentEl.querySelector(REPLY_BOX);
    if (open) {
      open.querySelector('input').focus();
      return;
    }
    const form = document.createElement('div');
    form.className = 'fb-comment-form fb-comment-reply-form';
    form.innerHTML = `<div class="fb-comment-box">
        <input class="fb-comment-input" type="text" data-reply-input placeholder="Write a reply…" aria-label="Write a reply">
        <button class="fb-comment-send" type="button" data-act="send-reply" aria-label="Send reply">➤</button>
      </div>`;
    commentEl.querySelector('.fb-comment-main').appendChild(form);
    form.querySelector('input').focus();
  }

  async function addComment(postId, input, parentId) {
    const body = input.value.trim();
    if (!body) return;
    if (!viewer.id) return showToast('Log in to comment', '', 4000);
    const row = {
      post_id: postId,
      user_id: viewer.id,
      user_name: viewer.full_name || viewer.username,
      body
    };
    if (parentId) row.parent_id = parentId;
    const { error } = await sb.from('post_comments').insert([row]);
    if (error) return showToast('Could not add your comment', 'error');
    await refreshCard(postId);
    if (parentId) return;
    const fresh = listEl.querySelector(`[data-post="${postId}"] [data-comment-input]`);
    if (fresh) fresh.focus();
  }

  function editComment(postId, commentEl) {
    const commentId = commentEl.dataset.comment;
    const bodyEl = commentEl.querySelector('.fb-comment-body');
    const comment = (state.comments.get(String(postId)) || []).find(c => String(c.id) === String(commentId));
    if (!bodyEl || !comment) return;
    bodyEl.innerHTML = `<input class="fb-comment-edit" type="text" value="${fbEscape(comment.body)}" aria-label="Edit comment">`;
    const input = bodyEl.querySelector('input');
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    let done = false;
    input.addEventListener('keydown', async e => {
      if (done) return;
      if (e.key === 'Escape') {
        done = true;
        refreshCard(postId);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const value = input.value.trim();
        if (!value) return showToast('A comment cannot be empty', 'error');
        done = true;
        const { error } = await sb.from('post_comments')
          .update({ body: value, edited_at: new Date().toISOString() }).eq('id', commentId);
        if (error) showToast('Could not save your comment', 'error');
        else showToast('Comment updated', 'success');
        await refreshCard(postId);
      }
    });
    input.addEventListener('blur', () => {
      if (!done) {
        done = true;
        refreshCard(postId);
      }
    });
  }

  async function deleteComment(postId, commentId) {
    if (!confirm('Delete this comment?')) return;
    const { error } = await sb.from('post_comments').delete().eq('id', commentId);
    if (error) return showToast('Could not delete the comment', 'error');
    showToast('Comment deleted', 'success');
    await refreshCard(postId);
  }

  // Accepted friends of the signed-in member, used for the "Friends" audience
  async function loadFriendIds() {
    if (!sb || !viewer.id) return null;
    const { data, error } = await sb.from('friend_requests')
      .select('sender_id, receiver_id')
      .eq('status', 'accepted')
      .or(`sender_id.eq.${viewer.id},receiver_id.eq.${viewer.id}`);
    if (error) return null;
    const ids = new Set();
    (data || []).forEach(row => {
      ids.add(String(String(row.sender_id) === String(viewer.id) ? row.receiver_id : row.sender_id));
    });
    return ids;
  }

  // Faces and videos this member has uploaded, so they can reuse them.
  // The database row is what lets an admin see who owns the reaction;
  // this browser copy keeps them usable if that table is not there yet.
  function faceStoreKey() {
    return 'meday.reactionFaces.' + (viewer.id || 'guest');
  }

  function readReactionStore() {
    try {
      const raw = JSON.parse(localStorage.getItem(faceStoreKey()) || '[]');
      return (Array.isArray(raw) ? raw : []).map(item =>
        (typeof item === 'string'
          ? { url: item, kind: 'face' }
          : { url: item && item.url, kind: (item && item.kind) || 'face' })
      ).filter(m => m.url);
    } catch (err) {
      return [];
    }
  }

  function saveReactionStore(media) {
    try {
      localStorage.setItem(faceStoreKey(), JSON.stringify(media));
    } catch (err) { /* a full or blocked store only costs the saved list */ }
  }

  function reactionMediaFrom(media) {
    return media.map(m => ({ id: m.id || '', image_url: m.url, kind: m.kind }));
  }

  async function loadReactionMedia() {
    const local = readReactionStore();
    if (!sb || !viewer.id) return reactionMediaFrom(local);
    const { data, error } = await sb.from('reaction_media').select('id, url, kind').eq('user_id', viewer.id);
    if (error || !data) return reactionMediaFrom(local);
    const media = data.map(row => ({ id: row.id, url: row.url, kind: row.kind || 'face' }));
    if (media.length) saveReactionStore(media);
    return reactionMediaFrom(media);
  }

  function openShare(post) {
    Posts.share(post, {
      viewer,
      async onShare({ audience, message }) {
        if (!sb) throw new Error('Sharing needs a connected database');
        const base = {
          user_id: viewer.id,
          author_name: viewer.full_name || viewer.username,
          author_username: viewer.username,
          content: message || ''
        };
        let { error } = await sb.from('posts').insert([{ ...base, audience, shared_post_id: post.id }]);
        if (error && /column|schema cache/i.test(error.message || '')) {
          // The share columns are not in the database yet: still post the message
          ({ error } = await sb.from('posts').insert([base]));
          if (!error) showToast('Shared — run supabase/migrations/013_add_post_sharing.sql for post previews and audience', 'error', 8000);
        }
        if (error) throw new Error(error.message || 'Could not share the post');
        await sb.from('posts').update({ share_count: (Number(post.share_count) || 0) + 1 }).eq('id', post.id);
        showToast('Shared', 'success');
        await load();
      }
    });
  }

  // The picked photo is cropped to a square so it sits cleanly inside a circle
  async function postFaceSquare(file) {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    canvas.getContext('2d').drawImage(
      bitmap,
      (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side,
      0, 0, 240, 240
    );
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  }

  function pickReactionFile() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,video/*';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        input.remove();
        resolve(file || null);
      });
      input.click();
    });
  }

  // How long the picked video runs, read before it is uploaded
  function reactionVideoSeconds(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const probe = document.createElement('video');
      probe.preload = 'metadata';
      const done = seconds => {
        URL.revokeObjectURL(url);
        resolve(seconds);
      };
      probe.onloadedmetadata = () => {
        if (isFinite(probe.duration) && probe.duration > 0) return done(probe.duration);
        // Some recordings report no length until the browser seeks past the end
        probe.ondurationchange = () => {
          if (isFinite(probe.duration) && probe.duration > 0) done(probe.duration);
        };
        probe.currentTime = 1e101;
      };
      probe.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('that video could not be read'));
      };
      probe.src = url;
    });
  }

  // Uploads a face or a video reaction (5 seconds at most), remembers it for
  // next time and for the admin list, then reacts with it
  async function addOwnReaction(postId, commentId) {
    const file = await pickReactionFile();
    if (!file) return;
    if (!sb || !viewer.id) return showToast('Sign in to save your own reaction', 'error');
    const type = String(file.type || '');
    const video = type.startsWith('video/');
    if (!video && !type.startsWith('image/')) {
      return showToast('Choose a photo or a video of 5 seconds or less', 'error');
    }
    try {
      let kind = 'face';
      let blob = file;
      if (video) {
        const seconds = await reactionVideoSeconds(file);
        if (!(seconds > 0) || seconds > REACTION_VIDEO_MAX + 0.1) {
          return showToast('A reaction video must be 5 seconds or shorter', 'error', 6000);
        }
        kind = 'video';
        showToast('Uploading your video reaction…', '', 6000);
      } else {
        showToast('Uploading your face…', '', 6000);
        blob = await postFaceSquare(file).catch(() => file);
      }
      const url = await cloudinaryUpload(blob);
      if (!url) throw new Error('media hosting is not connected');
      const media = readReactionStore();
      if (!media.some(m => m.url === url)) media.push({ url, kind });
      saveReactionStore(media);
      state.faces = reactionMediaFrom(media);
      refreshReactionPickers();
      const typeName = (kind === 'video' ? 'vid:' : 'face:') + url;
      // Stored with its owner so the admin member list shows who it belongs to
      const { error } = await sb.from('reaction_media').insert([{ user_id: viewer.id, kind, url }]);
      if (error) {
        showToast('Saved in this browser — run supabase/migrations/014_create_reaction_media.sql so admins can see it', 'error', 8000);
      } else {
        // Re-read so the new choice carries the row id its delete badge needs
        state.faces = await loadReactionMedia();
        refreshReactionPickers();
      }
      showToast(kind === 'video' ? 'Your video reaction is ready' : 'Your face reaction is ready', 'success');
      if (commentId) await setCommentReaction(postId, commentId, typeName);
      else await setReaction(postId, typeName);
    } catch (err) {
      const message = String((err && err.message) || '');
      showToast('Could not save your reaction: ' + message, 'error', 6000);
    }
  }

  // Only the member who uploaded a reaction can take it out of the choices
  async function removeOwnReaction(el) {
    const url = el.dataset.url;
    if (!url || !viewer.id) return;
    const id = el.dataset.id;
    const store = readReactionStore().filter(m => m.url !== url);
    saveReactionStore(store);
    if (sb) {
      let query = sb.from('reaction_media').delete().eq('user_id', viewer.id);
      query = id ? query.eq('id', id) : query.eq('url', url);
      const { error } = await query;
      if (error) showToast('Removed in this browser only — run supabase/migrations/014_create_reaction_media.sql first', 'error', 8000);
    }
    // Drop it from the choices here too, in case the database delete could not run
    state.faces = (state.faces || []).filter(m => m.image_url !== url);
    refreshReactionPickers();
    showToast('Reaction deleted', 'success');
  }

  // Hovering only previews the options: the picker stays open until a reaction is clicked
  listEl.addEventListener('mouseover', e => {
    const wrap = e.target.closest('.fb-react-wrap');
    if (!wrap || wrap.classList.contains('open')) return;
    listEl.querySelectorAll('.fb-react-wrap.open').forEach(w => w.classList.remove('open'));
    wrap.classList.add('open');
    state.openPicker = pickerKeyFor(wrap);
  });

  // The reaction shelf goes away when the member clicks away, swipes/scrolls
  // off it, or presses Escape
  if (!listEl.dataset.pickerDismiss) {
    listEl.dataset.pickerDismiss = '1';
    document.addEventListener('click', e => {
      if (!state.openPicker) return;
      if (e.target.closest('.fb-react-wrap.open')) return;
      closePickers();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closePickers();
    });
    window.addEventListener('scroll', () => {
      if (state.openPicker) closePickers();
    }, { passive: true, capture: true });
  }

  listEl.addEventListener('change', e => {
    const box = e.target.closest('[data-act="toggle-face-anim"]');
    if (box) {
      const postEl = box.closest('[data-post]');
      if (!postEl) return;
      setFaceAnimOff(postEl.dataset.post, !box.checked);
      const icons = postEl.querySelector('.fb-reaction-icons');
      if (icons) icons.classList.toggle('fb-face-anim-off', !box.checked);
      // A video reaction only plays while its turn loop runs
      if (box.checked) startVideoReactions();
      else stopVideoReactions();
      return;
    }
    const sound = e.target.closest('[data-act="toggle-rx-sound"]');
    if (!sound) return;
    const postEl = sound.closest('[data-post]');
    if (!postEl) return;
    const on = sound.checked;
    setRxSoundOn(postEl.dataset.post, on);
    const icon = sound.parentElement.querySelector('.fb-rx-sound-icon');
    if (icon) icon.textContent = on ? '🔊' : '🔇';
    // Applies to every video of this post, playing or about to play
    applyRxSound(postEl, on);
  });

  listEl.addEventListener('click', async e => {
    // Visitors who are not signed in can read posts and their reactions, not add to them.
    // The grow/sound switches are local display settings, so they keep working.
    const guarded = e.target.closest('[data-act], .fb-reaction-option');
    if (!viewer.id && guarded && !/^toggle-/.test(guarded.dataset.act || '')) {
      e.preventDefault();
      showToast('Log in to react and comment', '', 4000);
      return;
    }
    // A member waiting for approval reads the feed, but cannot react, comment or share
    const actName = guarded ? (guarded.dataset.act || '') : '';
    const readOnlyAct = guarded && !guarded.classList.contains('fb-reaction-option')
      && (/^toggle-/.test(actName) || actName === 'focus-comment' || actName === 'show-author');
    if (guarded && !readOnlyAct && ReadOnlyMode.block('Reacting, commenting and sharing')) {
      e.preventDefault();
      return;
    }
    const option = e.target.closest('.fb-reaction-option');
    if (option) {
      e.preventDefault();
      const postEl = option.closest('[data-post]');
      if (!postEl) return;
      const commentEl = option.closest('[data-comment]');
      closePickers();
      if (commentEl) await setCommentReaction(postEl.dataset.post, commentEl.dataset.comment, option.dataset.react);
      else await setReaction(postEl.dataset.post, option.dataset.react);
      return;
    }

    const act = e.target.closest('[data-act]');
    if (!act) return;
    // The restore list lives above the posts, outside any post card
    if (act.dataset.act === 'show-author') return showAuthorPosts(act.dataset.author);
    const postEl = act.closest('[data-post]');
    if (!postEl) return;
    const postId = postEl.dataset.post;
    const commentEl = act.closest('[data-comment]');
    const kind = act.dataset.act;

    if (kind === 'hide-author') return hideAuthorPosts(postId);

    if (kind === 'add-face') return addOwnReaction(postId, commentEl ? commentEl.dataset.comment : null);
    if (kind === 'remove-face') return removeOwnReaction(act);
    if (kind === 'react-picker') {
      const wrap = act.closest('.fb-react-wrap');
      if (wrap) {
        const willOpen = !wrap.classList.contains('open');
        closePickers();
        wrap.classList.toggle('open', willOpen);
        state.openPicker = willOpen ? pickerKeyFor(wrap) : null;
      }
      return;
    }
    if (kind === 'react') {
      const mine = (state.reactions.get(String(postId)) || []).find(r => String(r.user_id) === String(viewer.id));
      return setReaction(postId, mine ? mine.type : 'like');
    }
    if (kind === 'react-comment' && commentEl) {
      const rows = state.commentReactions.get(String(commentEl.dataset.comment)) || [];
      const mine = rows.find(r => String(r.user_id) === String(viewer.id));
      return setCommentReaction(postId, commentEl.dataset.comment, mine ? mine.type : 'like');
    }
    if (kind === 'focus-comment') {
      const input = postEl.querySelector('[data-comment-input]');
      if (input) input.focus();
      return;
    }
    if (kind === 'send-comment') {
      const input = postEl.querySelector('[data-comment-input]');
      if (input) await addComment(postId, input);
      return;
    }
    if (kind === 'reply-comment' && commentEl) return openReplyBox(commentEl);
    if (kind === 'send-reply' && commentEl) {
      const input = commentEl.querySelector(REPLY_BOX + ' [data-reply-input]');
      if (input) await addComment(postId, input, commentEl.dataset.comment);
      return;
    }
    if (kind === 'edit-comment' && commentEl) return editComment(postId, commentEl);
    if (kind === 'delete-comment' && commentEl) return deleteComment(postId, commentEl.dataset.comment);
    if (kind === 'share') {
      const post = findPost(postId);
      if (post) openShare(post);
    }
  });

  listEl.addEventListener('keydown', e => {
    const input = e.target.closest('[data-comment-input]');
    if (!input) return;
    const postEl = input.closest('[data-post]');
    const commentEl = input.closest('[data-comment]');
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!postEl) return;
      if (input.hasAttribute('data-reply-input') && commentEl) {
        addComment(postEl.dataset.post, input, commentEl.dataset.comment);
      } else {
        addComment(postEl.dataset.post, input);
      }
    } else if (e.key === 'Escape') {
      input.value = '';
      input.blur();
    }
  });

  load();

  return {
    reload: load,
    setQuery(q) {
      state.query = q || '';
      renderAll();
    }
  };
};

window.Posts = Posts;
