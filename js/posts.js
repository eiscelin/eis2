// Member posts — text with a photo or video, Facebook-style reactions and comments
var Posts = window.Posts || {};

const POST_VIDEO_MAX = 100 * 1024 * 1024;
const POST_IMAGE_MAX = 20 * 1024 * 1024;

const FB_REACTIONS = {
  like: { emoji: '👍', label: 'Like', color: '#2d88ff' },
  love: { emoji: '❤️', label: 'Love', color: '#f5533d' },
  haha: { emoji: '😆', label: 'Haha', color: '#f7b125' },
  wow: { emoji: '😮', label: 'Wow', color: '#f7b125' },
  sad: { emoji: '😢', label: 'Sad', color: '#f7b125' },
  angry: { emoji: '😡', label: 'Angry', color: '#e9710f' }
};
const REACTION_ORDER = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];

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
      : `<img class="fb-avatar-img" src="${fbEscape(url)}" alt="">`)
    : fbEscape((label[0] || '?').toUpperCase());
  return `<span class="fb-avatar ${cls || ''}">${inner}</span>`;
}

function postProfileHref(username) {
  return username ? '#/u/' + encodeURIComponent(username) : '#/App';
}

function postReactionGroups(rows) {
  const counts = {};
  (rows || []).forEach(r => {
    if (FB_REACTIONS[r.type]) counts[r.type] = (counts[r.type] || 0) + 1;
  });
  return REACTION_ORDER.filter(t => counts[t]).map(t => ({
    type: t, emoji: FB_REACTIONS[t].emoji, label: FB_REACTIONS[t].label, count: counts[t]
  }));
}

function postReactionPicker() {
  return `<div class="fb-reaction-picker">
    ${REACTION_ORDER.map(t =>
      `<button class="fb-reaction-option" type="button" data-react="${t}" title="${FB_REACTIONS[t].label}" aria-label="${FB_REACTIONS[t].label}">${FB_REACTIONS[t].emoji}</button>`
    ).join('')}
  </div>`;
}

function postMediaHtml(post) {
  if (!post.media_url) return '';
  return `<div class="fb-post-media">${post.media_type === 'video'
    ? `<video class="fb-post-media-el" src="${fbEscape(post.media_url)}" controls playsinline preload="metadata"></video>`
    : `<img class="fb-post-media-el" src="${fbEscape(post.media_url)}" alt="">`}</div>`;
}

function postCommentHtml(comment, ctx) {
  const viewer = ctx.viewer || {};
  const member = ctx.users ? ctx.users.get(String(comment.user_id)) : null;
  const name = (member && (member.full_name || member.username)) || comment.user_name || 'Member';
  const username = (member && member.username) || '';
  const rows = (ctx.commentReactions && ctx.commentReactions.get(String(comment.id))) || [];
  const groups = postReactionGroups(rows);
  const mine = rows.find(r => String(r.user_id) === String(viewer.id));
  const mineType = mine ? FB_REACTIONS[mine.type] : null;
  const own = String(comment.user_id) === String(viewer.id);

  return `<div class="fb-comment" data-comment="${fbEscape(comment.id)}">
    <a class="fb-comment-avatar" href="${postProfileHref(username)}" aria-label="${fbEscape(name)}">${postAvatar(member, name, 'fb-avatar-xs')}</a>
    <div class="fb-comment-main">
      <div class="fb-comment-bubble">
        <a class="fb-comment-name" href="${postProfileHref(username)}">${fbEscape(name)}</a>
        <div class="fb-comment-body">${fbEscape(comment.body)}</div>
        ${groups.length
          ? `<span class="fb-comment-reactions">${groups.map(g => `${g.emoji}<b>${postCount(g.count)}</b>`).join('')}</span>`
          : ''}
      </div>
      <div class="fb-comment-meta">
        <div class="fb-react-wrap">
          <button class="fb-comment-act${mineType ? ' active' : ''}" type="button" data-act="react-comment"${mineType ? ` style="color:${mineType.color}"` : ''}>${mineType ? mineType.label : 'Like'}</button>
          <button class="fb-react-more" type="button" data-act="react-picker" aria-label="Choose a reaction">▴</button>
          ${postReactionPicker()}
        </div>
        <span class="fb-comment-time">${fbEscape(postTimeAgo(comment.created_at))}</span>
        ${comment.edited_at ? '<span class="fb-comment-edited">Edited</span>' : ''}
        ${own
          ? `<button class="fb-comment-act" type="button" data-act="edit-comment">Edit</button>
             <button class="fb-comment-act" type="button" data-act="delete-comment">Delete</button>`
          : ''}
      </div>
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
  const mineType = mine ? FB_REACTIONS[mine.type] : null;
  const totalReactions = groups.reduce((sum, g) => sum + g.count, 0);
  const shares = Number(post.share_count) || 0;
  const viewerName = viewer.full_name || viewer.username || 'Member';

  return `<article class="fb-card fb-post-card" data-post="${fbEscape(post.id)}">
    <div class="fb-post-head">
      <a class="fb-post-avatar" href="${postProfileHref(authorUsername)}" aria-label="${fbEscape(authorName)}">${postAvatar(author, authorName)}</a>
      <div class="fb-post-id">
        <a class="fb-post-name" href="${postProfileHref(authorUsername)}">${fbEscape(authorName)}</a>
        <div class="fb-post-time">${fbEscape(postTimeAgo(post.created_at))} · <span aria-label="Public">🌐</span></div>
      </div>
    </div>
    ${post.content ? `<div class="fb-post-text">${fbEscape(post.content)}</div>` : ''}
    ${postMediaHtml(post)}
    ${totalReactions || comments.length || shares
      ? `<div class="fb-post-stats">
          <span class="fb-post-summary">${totalReactions
            ? `<span class="fb-reaction-icons">${groups.map(g => `<span title="${g.label}">${g.emoji}</span>`).join('')}</span>${postCount(totalReactions)}`
            : ''}</span>
          <span class="fb-post-counts">
            ${comments.length ? `<button type="button" data-act="focus-comment">${postCount(comments.length)} comment${comments.length === 1 ? '' : 's'}</button>` : ''}
            ${shares ? `<span>${postCount(shares)} share${shares === 1 ? '' : 's'}</span>` : ''}
          </span>
        </div>`
      : ''}
    <div class="fb-post-actions">
      <div class="fb-react-wrap">
        <button class="fb-post-act${mineType ? ' active' : ''}" type="button" data-act="react"${mineType ? ` style="color:${mineType.color}"` : ''}>
          <span aria-hidden="true">${mineType ? mineType.emoji : '👍'}</span><span>${mineType ? mineType.label : 'Like'}</span>
        </button>
        <button class="fb-react-more" type="button" data-act="react-picker" aria-label="Choose a reaction">▴</button>
        ${postReactionPicker()}
      </div>
      <button class="fb-post-act" type="button" data-act="focus-comment"><span aria-hidden="true">💬</span><span>Comment</span></button>
      <button class="fb-post-act" type="button" data-act="share"><span aria-hidden="true">↗</span><span>Share</span></button>
    </div>
    <div class="fb-comments">
      ${comments.map(c => postCommentHtml(c, ctx)).join('')}
      <div class="fb-comment-form">
        ${postAvatar(viewer, viewerName, 'fb-avatar-xs')}
        <div class="fb-comment-box">
          <input class="fb-comment-input" type="text" data-comment-input placeholder="Write a comment…" aria-label="Write a comment">
          <button class="fb-comment-send" type="button" data-act="send-comment" aria-label="Send comment">➤</button>
        </div>
      </div>
    </div>
  </article>`;
};

// Composer: text plus one photo or video
Posts.composerMarkup = function (viewer, placeholder) {
  const name = (viewer && (viewer.full_name || viewer.username)) || 'Member';
  return `<div class="fb-posts-composer" data-composer>
    <div class="fb-composer">
      ${postAvatar(viewer, name, 'fb-avatar-sm')}
      <input type="text" data-post-text placeholder="${fbEscape(placeholder || "What's on your mind?")}" aria-label="Write a post">
    </div>
    <div class="fb-composer-preview" data-preview hidden></div>
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
  let file = null;
  let busy = false;

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
    try {
      let mediaUrl = '';
      let mediaType = '';
      if (file) {
        const isVideo = String(file.type || '').startsWith('video/');
        showToast(isVideo ? 'Uploading your video…' : 'Uploading your photo…', '', 6000);
        const payload = isVideo ? file : await shrinkImage(file, 1600).catch(() => file);
        mediaUrl = await cloudinaryUpload(payload);
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
  const state = {
    posts: [],
    users: new Map(),
    reactions: new Map(),
    comments: new Map(),
    commentReactions: new Map(),
    query: ''
  };

  function mapPush(map, key, value) {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  }

  function findPost(id) {
    return state.posts.find(p => String(p.id) === String(id));
  }

  function ctxFor(post) {
    return {
      viewer,
      users: state.users,
      author: state.users.get(String(post.user_id)),
      reactions: state.reactions.get(String(post.id)) || [],
      comments: state.comments.get(String(post.id)) || [],
      commentReactions: state.commentReactions
    };
  }

  function renderAll() {
    const q = state.query.trim().toLowerCase();
    const shown = q
      ? state.posts.filter(p => `${p.content || ''} ${p.author_name || ''}`.toLowerCase().includes(q))
      : state.posts;
    listEl.innerHTML = shown.length
      ? shown.map(p => Posts.card(p, ctxFor(p))).join('')
      : (options.emptyHtml || '');
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

    let query = sb.from('posts').select('*').order('created_at', { ascending: false }).limit(options.limit || 30);
    if (options.authorId) query = query.eq('user_id', options.authorId);
    const { data: rows, error } = await query;
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

    const postIds = state.posts.map(p => p.id);
    const { data: comments } = await sb.from('post_comments')
      .select('*').in('post_id', postIds).order('created_at', { ascending: true });
    (comments || []).forEach(c => mapPush(state.comments, String(c.post_id), c));

    const peopleIds = Array.from(new Set(
      state.posts.map(p => p.user_id).concat((comments || []).map(c => c.user_id)).filter(Boolean)
    ));
    if (peopleIds.length) {
      const { data: people } = await sb.from('users')
        .select('id, username, full_name, avatar_url').in('id', peopleIds);
      (people || []).forEach(p => state.users.set(String(p.id), p));
    }

    const { data: reactions } = await sb.from('post_reactions').select('*').in('post_id', postIds);
    (reactions || []).forEach(r => mapPush(state.reactions, String(r.post_id), r));

    const commentIds = (comments || []).map(c => c.id);
    if (commentIds.length) {
      const { data: commentReactions } = await sb.from('comment_reactions')
        .select('*').in('comment_id', commentIds);
      (commentReactions || []).forEach(r => mapPush(state.commentReactions, String(r.comment_id), r));
    }

    renderAll();
  }

  // Reloads one post's reactions and comments, then repaints just that card
  async function refreshCard(postId) {
    const post = findPost(postId);
    if (!post) return;
    const key = String(postId);
    const { data: reactions } = await sb.from('post_reactions').select('*').eq('post_id', postId);
    const { data: comments } = await sb.from('post_comments')
      .select('*').eq('post_id', postId).order('created_at', { ascending: true });
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

  async function addComment(postId, input) {
    const body = input.value.trim();
    if (!body) return;
    const { error } = await sb.from('post_comments').insert([{
      post_id: postId,
      user_id: viewer.id,
      user_name: viewer.full_name || viewer.username,
      body
    }]);
    if (error) return showToast('Could not add your comment', 'error');
    await refreshCard(postId);
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

  async function sharePost(post) {
    const link = location.origin + location.pathname + '#/App';
    await fbShareLink(link, 'Post by ' + (post.author_name || 'a member'));
    if (sb) await sb.from('posts').update({ share_count: (Number(post.share_count) || 0) + 1 }).eq('id', post.id);
    await refreshCard(post.id);
  }

  listEl.addEventListener('click', async e => {
    const option = e.target.closest('.fb-reaction-option');
    if (option) {
      e.preventDefault();
      const postEl = option.closest('[data-post]');
      if (!postEl) return;
      const commentEl = option.closest('[data-comment]');
      postEl.querySelectorAll('.fb-react-wrap.open').forEach(w => w.classList.remove('open'));
      if (commentEl) await setCommentReaction(postEl.dataset.post, commentEl.dataset.comment, option.dataset.react);
      else await setReaction(postEl.dataset.post, option.dataset.react);
      return;
    }

    const act = e.target.closest('[data-act]');
    if (!act) return;
    const postEl = act.closest('[data-post]');
    if (!postEl) return;
    const postId = postEl.dataset.post;
    const commentEl = act.closest('[data-comment]');
    const kind = act.dataset.act;

    if (kind === 'react-picker') {
      const wrap = act.closest('.fb-react-wrap');
      if (wrap) wrap.classList.toggle('open');
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
    if (kind === 'edit-comment' && commentEl) return editComment(postId, commentEl);
    if (kind === 'delete-comment' && commentEl) return deleteComment(postId, commentEl.dataset.comment);
    if (kind === 'share') {
      const post = findPost(postId);
      if (post) await sharePost(post);
    }
  });

  listEl.addEventListener('keydown', e => {
    const input = e.target.closest('[data-comment-input]');
    if (!input) return;
    const postEl = input.closest('[data-post]');
    if (e.key === 'Enter') {
      e.preventDefault();
      if (postEl) addComment(postEl.dataset.post, input);
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
