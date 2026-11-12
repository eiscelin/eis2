// Facebook-style "Share" dialog: say something, pick Feed + audience, then share
var Posts = window.Posts || {};

Posts.share = function (post, opts) {
  const options = opts || {};
  const viewer = options.viewer || {};
  const name = viewer.full_name || viewer.username || 'Member';
  const audiences = [
    { id: 'public', icon: '🌐', label: 'Public', hint: 'Anyone on MeDay' },
    { id: 'friends', icon: '👥', label: 'Friends', hint: 'Your friends on MeDay' },
    { id: 'only_me', icon: '🔒', label: 'Only me', hint: 'Only you can see this' }
  ];
  let audience = 'friends';
  let busy = false;

  const overlay = document.createElement('div');
  overlay.className = 'fb-share-overlay';
  overlay.innerHTML = `<div class="fb-share-modal" role="dialog" aria-modal="true" aria-label="Share">
    <div class="fb-share-head">
      <h3>Share</h3>
      <button class="fb-share-close" type="button" data-share-close aria-label="Close">✕</button>
    </div>
    <div class="fb-share-main">
      <div class="fb-share-user">
        ${postAvatar(viewer, name, 'fb-avatar-sm')}
        <div class="fb-share-user-txt">
          <span class="fb-share-name">${fbEscape(name)}</span>
          <div class="fb-share-pills">
            <span class="fb-share-pill">Feed</span>
            <div class="fb-share-aud">
              <button class="fb-share-pill fb-share-pill-btn" type="button" data-share-aud aria-haspopup="true">
                <span data-share-aud-icon>👥</span><span data-share-aud-label>Friends</span><span class="fb-share-caret" aria-hidden="true">▾</span>
              </button>
              <div class="fb-share-menu" data-share-menu hidden>
                ${audiences.map(a => `<button class="fb-share-opt" type="button" data-share-opt="${a.id}" aria-checked="${a.id === audience}">
                  <span class="fb-share-opt-icon" aria-hidden="true">${a.icon}</span>
                  <span class="fb-share-opt-txt">
                    <span class="fb-share-opt-label">${a.label}</span>
                    <span class="fb-share-opt-hint">${a.hint}</span>
                  </span>
                </button>`).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="fb-share-input-wrap">
        <textarea class="fb-share-input" data-share-text rows="3" placeholder="Say something about this..." aria-label="Say something about this post"></textarea>
        <button class="fb-share-emoji" type="button" data-share-emoji aria-label="Add an emoji">🙂</button>
      </div>
    </div>
    <div class="fb-share-foot">
      <button class="fb-share-now" type="button" data-share-now>Share now</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  const text = overlay.querySelector('[data-share-text]');
  const submit = overlay.querySelector('[data-share-now]');
  const menu = overlay.querySelector('[data-share-menu]');
  const audIcon = overlay.querySelector('[data-share-aud-icon]');
  const audLabel = overlay.querySelector('[data-share-aud-label]');

  function close() {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  }

  function onKey(e) {
    if (e.key !== 'Escape') return;
    if (menu.hidden) close();
    else menu.hidden = true;
  }
  document.addEventListener('keydown', onKey);

  async function submitShare() {
    if (busy) return;
    busy = true;
    submit.disabled = true;
    try {
      if (options.onShare) await options.onShare({ audience, message: text.value.trim() });
      close();
    } catch (err) {
      showToast(String((err && err.message) || 'Could not share the post'), 'error', 6000);
      busy = false;
      submit.disabled = false;
    }
  }

  overlay.addEventListener('click', e => {
    if (e.target === overlay || e.target.closest('[data-share-close]')) return close();
    if (!e.target.closest('.fb-share-aud') && !menu.hidden) menu.hidden = true;
    if (e.target.closest('[data-share-aud]')) {
      menu.hidden = !menu.hidden;
      return;
    }
    const option = e.target.closest('[data-share-opt]');
    if (option) {
      audience = option.dataset.shareOpt;
      const meta = audiences.find(a => a.id === audience);
      audIcon.textContent = meta.icon;
      audLabel.textContent = meta.label;
      overlay.querySelectorAll('[data-share-opt]').forEach(btn => {
        btn.setAttribute('aria-checked', String(btn === option));
      });
      menu.hidden = true;
      return;
    }
    if (e.target.closest('[data-share-emoji]')) {
      const pos = typeof text.selectionStart === 'number' ? text.selectionStart : text.value.length;
      const end = typeof text.selectionEnd === 'number' ? text.selectionEnd : pos;
      text.value = text.value.slice(0, pos) + '🙂' + text.value.slice(end);
      text.focus();
      text.setSelectionRange(pos + 2, pos + 2);
      return;
    }
    if (e.target.closest('[data-share-now]')) submitShare();
  });

  text.focus();
};
