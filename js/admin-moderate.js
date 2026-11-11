// Inline moderation for a signed-in administrator: a profile picture, cover,
// My Day story or post can be deleted from wherever it is displayed
window.AdminModerate = (function () {
  function me() {
    const user = typeof Auth !== 'undefined' ? Auth.currentUser : null;
    return user && user.role === 'admin' ? user : null;
  }

  function can() {
    return !!me();
  }

  function errorText(e) {
    const message = String((e && e.message) || e || 'Something went wrong');
    return /admin_delete_|could not find the function|does not exist|schema cache/i.test(message)
      ? 'Run 010_admin_delete_content.sql in Supabase, then try again'
      : message;
  }

  async function call(fn, args, success, onDone) {
    try {
      const { error } = await sb.rpc(fn, args);
      if (error) throw error;
      showToast(success, 'success');
      if (onDone) onDone();
    } catch (e) {
      showToast(errorText(e), 'error', 6000);
    }
  }

  function deleteMedia(userId, kind, onDone) {
    if (!confirm(kind === 'avatar' ? 'Delete this profile picture for everyone?' : 'Delete this cover for everyone?')) return;
    call('admin_delete_media', { p_admin_id: me().id, p_user_id: userId, p_kind: kind },
      kind === 'avatar' ? 'Profile picture deleted' : 'Cover deleted', onDone);
  }

  function deleteStory(storyId, onDone) {
    if (!confirm('Delete this My Day story for everyone?')) return;
    call('admin_delete_story', { p_admin_id: me().id, p_story_id: storyId }, 'Story deleted', onDone);
  }

  async function deletePost(postId, onDone) {
    if (!confirm('Delete this post for everyone?')) return;
    try {
      const { error } = await sb.from('announcements').delete().eq('id', postId);
      if (error) throw error;
      showToast('Post deleted', 'success');
      if (onDone) onDone();
    } catch (e) {
      showToast(errorText(e), 'error', 6000);
    }
  }

  function button(attrs, title, extra) {
    return `<button class="admin-act delete fb-mod-del${extra || ''}" type="button" ${attrs} title="${title}" aria-label="${title}">🗑️</button>`;
  }

  function mediaButton(kind, userId) {
    if (!can() || !userId) return '';
    const label = kind === 'avatar' ? 'Delete profile picture' : 'Delete cover';
    return button(`data-admin-media="${kind}" data-admin-user="${fbEscape(userId)}"`, label, ' fb-mod-del-float');
  }

  function storyButton(storyId) {
    if (!can() || !storyId) return '';
    return button(`data-admin-story="${fbEscape(storyId)}"`, 'Delete this story');
  }

  function postButton(postId) {
    if (!can() || !postId) return '';
    return button(`data-admin-post="${fbEscape(postId)}"`, 'Delete this post');
  }

  // Adds the click handlers for the delete buttons a page rendered
  function wire(root, handlers) {
    const scope = root || document;
    const done = handlers || {};
    const each = (selector, run) => {
      scope.querySelectorAll(selector).forEach(btn => {
        if (btn.dataset.adminWired) return;
        btn.dataset.adminWired = '1';
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          run(btn);
        });
      });
    };
    each('[data-admin-media]', btn => deleteMedia(btn.dataset.adminUser, btn.dataset.adminMedia, done.media));
    each('[data-admin-story]', btn => deleteStory(btn.dataset.adminStory, done.story));
    each('[data-admin-post]', btn => deletePost(btn.dataset.adminPost, done.post));
  }

  return { can, wire, mediaButton, storyButton, postButton };
})();
