// See-through media that floats in front of a whole profile page, like a spirit.
// The owner picks one image and one video, chooses which one shows, sets how
// see-through it is and how loud the video plays, so the profile underneath
// stays readable and clickable.
var ProfileOverlay = (function () {
  const MIN_OPACITY = 5;
  const MAX_OPACITY = 80;

  function clampOpacity(value) {
    const n = Number(value);
    if (!isFinite(n)) return 25;
    return Math.min(MAX_OPACITY, Math.max(MIN_OPACITY, Math.round(n)));
  }

  function clampVolume(value) {
    const n = Number(value);
    if (!isFinite(n)) return 60;
    return Math.min(100, Math.max(0, Math.round(n)));
  }

  function isVideo(url) {
    return /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(String(url || ''));
  }

  function reducesMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // Plays the overlay clip at the owner's volume. Browsers block autoplay with
  // sound until the visitor interacts, so it starts silent and the first tap or
  // key press brings the saved volume in.
  function playWithSound(video, volume) {
    const level = clampVolume(volume);
    video.volume = level / 100;
    video.muted = level === 0;
    const silently = () => {
      if (!video.isConnected) return;
      video.muted = true;
      video.play().catch(() => {});
      const resume = () => {
        document.removeEventListener('pointerdown', resume);
        document.removeEventListener('keydown', resume);
        if (!video.isConnected) return;
        video.volume = level / 100;
        video.muted = level === 0;
        video.play().catch(() => {});
      };
      document.addEventListener('pointerdown', resume);
      document.addEventListener('keydown', resume);
    };
    video.play().catch(silently);
  }

  // What the owner chose to show, when that media is actually stored
  function shown(profile) {
    const media = profile && profile.overlay_media;
    const url = media === 'video'
      ? profile.overlay_video_url
      : media === 'image'
        ? profile.overlay_image_url
        : '';
    return url ? { url, video: isVideo(url) } : null;
  }

  function layerHTML(profile) {
    const item = shown(profile);
    if (!item) return '';
    const still = reducesMotion();
    const asset = item.video
      ? `<video class="fb-overlay-asset" src="${fbEscape(item.url)}" loop playsinline preload="${still ? 'auto' : 'metadata'}"></video>`
      : `<img class="fb-overlay-asset" src="${fbEscape(item.url)}" alt="">`;
    return `<div class="fb-overlay-media" aria-hidden="true" style="opacity:${clampOpacity(profile.overlay_opacity) / 100}">${asset}</div>`;
  }

  // Draws (or clears) the layer inside a rendered profile page
  function paint(host, profile) {
    if (!host) return;
    host.querySelector('.fb-overlay-media')?.remove();
    const markup = layerHTML(profile);
    if (!markup) return;
    host.insertAdjacentHTML('afterbegin', markup);
    const video = host.querySelector('.fb-overlay-media video');
    if (video && !reducesMotion()) playWithSound(video, profile.overlay_volume);
  }

  // Owner editor: upload an image and a video, choose what shows, set the fade and volume
  function open(profile, save) {
    const state = {
      image: profile.overlay_image_url || '',
      video: profile.overlay_video_url || '',
      media: profile.overlay_media === 'image' || profile.overlay_media === 'video' ? profile.overlay_media : 'off',
      opacity: clampOpacity(profile.overlay_opacity),
      volume: clampVolume(profile.overlay_volume)
    };
    const picked = {};   // files chosen but not uploaded yet
    const previews = {}; // object URLs for those files
    const has = kind => !!(state[kind] || picked[kind]);
    let busy = false;

    const overlay = document.createElement('div');
    overlay.className = 'cover-editor overlay-editor';
    overlay.innerHTML = `
      <div class="cover-editor-box" role="dialog" aria-label="Profile overlay">
        <h3>Profile overlay</h3>
        <p class="overlay-editor-hint">A see-through image or video floats in front of your whole profile page.</p>
        <div class="overlay-editor-slots">
          <div class="overlay-slot-wrap">
            <button class="overlay-slot" type="button" data-slot="image"></button>
            <button class="overlay-slot-clear" type="button" data-clear="image" aria-label="Remove image">✕</button>
          </div>
          <div class="overlay-slot-wrap">
            <button class="overlay-slot" type="button" data-slot="video"></button>
            <button class="overlay-slot-clear" type="button" data-clear="video" aria-label="Remove video">✕</button>
          </div>
        </div>
        <div class="overlay-preview">
          <div class="overlay-preview-mock">
            <span class="overlay-preview-cover"></span>
            <span class="overlay-preview-name">Your profile stays readable</span>
            <span class="overlay-preview-line"></span>
            <span class="overlay-preview-line short"></span>
          </div>
          <div class="overlay-preview-layer"></div>
        </div>
        <div class="overlay-show">
          <span>Show:</span>
          <button class="overlay-show-btn" type="button" data-show="off">Off</button>
          <button class="overlay-show-btn" type="button" data-show="image">Image</button>
          <button class="overlay-show-btn" type="button" data-show="video">Video</button>
        </div>
        <div class="cover-editor-controls">
          <span aria-hidden="true">◐</span>
          <input id="oeOpacity" type="range" min="${MIN_OPACITY}" max="${MAX_OPACITY}" step="1" value="${state.opacity}" aria-label="Overlay transparency" title="Overlay transparency">
          <span id="oeOpacityLabel">${state.opacity}%</span>
        </div>
        <div class="cover-editor-controls overlay-volume" id="oeVolumeRow" hidden>
          <span aria-hidden="true">🔊</span>
          <input id="oeVolume" type="range" min="0" max="100" step="1" value="${state.volume}" aria-label="Video volume" title="Video volume">
          <span id="oeVolumeLabel">${state.volume}%</span>
        </div>
        <div class="cover-editor-actions">
          <button class="fb-btn fb-btn-secondary" id="oeCancel" type="button">Cancel</button>
          <button class="fb-btn fb-btn-primary" id="oeSave" type="button">Save overlay</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const layer = overlay.querySelector('.overlay-preview-layer');
    const pickers = { image: document.createElement('input'), video: document.createElement('input') };

    function paintSlots() {
      overlay.querySelectorAll('[data-slot]').forEach(btn => {
        const kind = btn.dataset.slot;
        const url = previews[kind] || state[kind];
        btn.classList.toggle('has-media', !!url);
        btn.innerHTML = url
          ? `${kind === 'video'
            ? `<video class="overlay-slot-media" src="${fbEscape(url)}" muted loop playsinline autoplay></video>`
            : `<img class="overlay-slot-media" src="${fbEscape(url)}" alt="">`}
             <span class="overlay-slot-label">${kind === 'video' ? 'Video' : 'Image'}</span>`
          : `<span class="overlay-slot-add" aria-hidden="true">＋</span>
             <span class="overlay-slot-label">Add ${kind}</span>`;
      });
      overlay.querySelectorAll('[data-clear]').forEach(btn => {
        btn.hidden = !has(btn.dataset.clear);
      });
      overlay.querySelectorAll('[data-show]').forEach(btn => {
        btn.classList.toggle('active', state.media === btn.dataset.show);
        btn.disabled = btn.dataset.show !== 'off' && !has(btn.dataset.show);
      });
    }

    function paintPreview() {
      layer.style.opacity = state.opacity / 100;
      const kind = state.media;
      const url = kind === 'off' ? '' : previews[kind] || state[kind];
      if (!url) {
        layer.innerHTML = '';
        return;
      }
      layer.innerHTML = kind === 'video'
        ? `<video src="${fbEscape(url)}" loop playsinline></video>`
        : `<img src="${fbEscape(url)}" alt="">`;
      const video = layer.querySelector('video');
      if (video) playWithSound(video, state.volume);
    }

    function render() {
      paintSlots();
      paintPreview();
      overlay.querySelector('#oeOpacityLabel').textContent = state.opacity + '%';
      overlay.querySelector('#oeVolumeRow').hidden = !has('video');
      overlay.querySelector('#oeVolumeLabel').textContent = state.volume + '%';
    }

    function close() {
      Object.keys(previews).forEach(kind => URL.revokeObjectURL(previews[kind]));
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
    const onKey = e => { if (e.key === 'Escape' && !busy) close(); };
    document.addEventListener('keydown', onKey);

    ['image', 'video'].forEach(kind => {
      const input = pickers[kind];
      input.type = 'file';
      input.accept = kind === 'video' ? 'video/*' : 'image/*';
      input.hidden = true;
      overlay.querySelector('.cover-editor-box').appendChild(input);
      input.addEventListener('change', () => {
        const file = input.files[0];
        input.value = '';
        if (!file) return;
        if (previews[kind]) URL.revokeObjectURL(previews[kind]);
        picked[kind] = file;
        previews[kind] = URL.createObjectURL(file);
        state.media = kind; // picking media shows it straight away
        render();
      });
    });

    overlay.addEventListener('click', e => {
      const clear = e.target.closest('[data-clear]');
      if (clear) {
        const kind = clear.dataset.clear;
        delete picked[kind];
        if (previews[kind]) { URL.revokeObjectURL(previews[kind]); delete previews[kind]; }
        state[kind] = '';
        if (state.media === kind) state.media = 'off';
        render();
        return;
      }
      const slot = e.target.closest('[data-slot]');
      if (slot) pickers[slot.dataset.slot].click();
      else if (e.target === overlay && !busy) close();
    });

    overlay.querySelectorAll('[data-show]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        state.media = btn.dataset.show;
        render();
      });
    });

    // Fade changes only touch the layer so the clip keeps playing while dragging
    overlay.querySelector('#oeOpacity').addEventListener('input', e => {
      state.opacity = clampOpacity(e.target.value);
      layer.style.opacity = state.opacity / 100;
      overlay.querySelector('#oeOpacityLabel').textContent = state.opacity + '%';
    });

    overlay.querySelector('#oeVolume').addEventListener('input', e => {
      state.volume = clampVolume(e.target.value);
      const video = layer.querySelector('video');
      if (video) {
        video.volume = state.volume / 100;
        video.muted = state.volume === 0;
      }
      overlay.querySelector('#oeVolumeLabel').textContent = state.volume + '%';
    });

    overlay.querySelector('#oeCancel').addEventListener('click', () => { if (!busy) close(); });

    const saveBtn = overlay.querySelector('#oeSave');
    saveBtn.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      try {
        for (const kind of ['image', 'video']) {
          const file = picked[kind];
          if (!file) continue;
          if (kind === 'video' && file.size > 100 * 1024 * 1024) throw new Error('that video is larger than 100 MB');
          let payload = file;
          if (kind === 'image') {
            // Phone photos the browser cannot decode (HEIC) go up as they are
            try { payload = await shrinkImage(file, 1600); } catch { payload = file; }
          }
          const url = await cloudinaryUpload(payload);
          if (!url) throw new Error('image hosting is not connected');
          state[kind] = url;
        }
        const media = has(state.media) ? state.media : 'off';
        await save({
          image: state.image || '',
          video: state.video || '',
          media,
          opacity: state.opacity,
          volume: state.volume
        });
        close();
      } catch (e) {
        busy = false;
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save overlay';
        showToast('Could not save your overlay: ' + (e.message || e), 'error', 6000);
      }
    });

    render();
  }

  return { html: layerHTML, paint, open };
})();
