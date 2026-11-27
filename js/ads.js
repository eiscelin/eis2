// Ad breaks inside member videos.
// An approved ad plays like a YouTube ad: a few seconds into a member's video
// the ad suddenly covers it, the member's video pauses while the ad runs, and
// when the ad ends (or is skipped) the video continues from the same second.
window.Ads = (function () {
  const BREAK_AFTER_MS = 4000;       // the member's video plays this long before the break
  const IMAGE_AD_MS = 6000;          // an image ad stays on screen this long
  const DEFAULT_SKIP_SECONDS = 5;    // how long until Skip appears
  const VIDEO_SELECTOR = 'video.fb-post-media-el';

  let loading = null;
  let pool = [];
  let enabled = false;
  let cursor = 0;
  let active = null;                 // the ad break on screen right now
  const pending = new WeakMap();     // member video -> its scheduled break timer

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function adsQuery(columns) {
    return sb.from('ads').select(columns)
      .eq('status', 'approved')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
  }

  // Before 027_ad_targeting.sql runs the target columns are missing, so the
  // ads keep playing everywhere instead of stopping
  function fetchAds() {
    return adsQuery('id, title, media_url, media_type, skip_seconds, target_user_id, target_post_id')
      .then(result => (result && result.error)
        ? adsQuery('id, title, media_url, media_type, skip_seconds')
        : result);
  }

  // The ads that may play, and the admin's on/off switch, read once per page
  function load() {
    if (loading) return loading;
    // `sb` is a top-level const in supabase.js, so it is not a window property
    if (typeof sb === 'undefined' || !sb) return Promise.resolve();
    loading = Promise.all([
      sb.from('app_settings').select('value').eq('key', 'video_ads').maybeSingle(),
      fetchAds()
    ]).then(([setting, ads]) => {
      enabled = !(setting && setting.data && setting.data.value === 'false');
      pool = (ads && !ads.error && ads.data) || [];
    }).catch(() => {
      pool = [];
    });
    return loading;
  }

  // An ad with no target plays everywhere, one with a member plays only in that
  // member's videos, one with a video plays only in that exact uploaded video
  function eligible(video) {
    const postId = video.dataset.postId || '';
    const userId = video.dataset.postUser || '';
    return pool.filter(ad => {
      if (ad.target_post_id != null) return !!postId && String(ad.target_post_id) === postId;
      if (ad.target_user_id != null) return !!userId && String(ad.target_user_id) === userId;
      return true;
    });
  }

  function nextAd(video) {
    const list = eligible(video);
    if (!list.length) return null;
    const ad = list[cursor % list.length];
    cursor += 1;
    return ad;
  }

  function cancelPending(video) {
    const timer = pending.get(video);
    if (timer) clearTimeout(timer);
    pending.delete(video);
  }

  // Only one clip makes sound: every other video on the page stops
  function pauseOthers(video) {
    document.querySelectorAll('video').forEach(other => {
      if (other === video || other.paused || other.closest('.fb-ad')) return;
      other.pause();
    });
  }

  function startBreak(video) {
    if (active || !video.isConnected) return;
    const ad = nextAd(video);
    const holder = video.parentElement;
    if (!ad || !holder) return;

    const mediaType = ad.media_type === 'video' ? 'video' : 'image';
    const skipSeconds = Math.max(0, Number(ad.skip_seconds));
    const waitBeforeSkip = ad.skip_seconds == null ? DEFAULT_SKIP_SECONDS : skipSeconds;

    pauseOthers(video);
    video.pause();

    const overlay = document.createElement('div');
    overlay.className = 'fb-ad';
    overlay.setAttribute('role', 'group');
    overlay.setAttribute('aria-label', 'Advertisement');
    overlay.innerHTML = `
      <div class="fb-ad-media">
        ${mediaType === 'video'
          ? '<video class="fb-ad-video" playsinline autoplay preload="auto"></video>'
          : `<img class="fb-ad-image" src="${escapeHtml(ad.media_url)}" alt="${escapeHtml(ad.title || 'Advertisement')}">`}
      </div>
      <div class="fb-ad-bar">
        <span class="fb-ad-tag">Ad</span>
        <span class="fb-ad-title">${escapeHtml(ad.title || 'Sponsored')}</span>
        <span class="fb-ad-time" aria-hidden="true"></span>
        <button class="fb-ad-skip" type="button" hidden>Skip ad</button>
      </div>`;
    holder.classList.add('fb-post-media-ad');
    holder.appendChild(overlay);

    const skipBtn = overlay.querySelector('.fb-ad-skip');
    const timeEl = overlay.querySelector('.fb-ad-time');
    const adVideo = overlay.querySelector('.fb-ad-video');
    if (adVideo) adVideo.src = ad.media_url;

    const breakState = { video, overlay, adVideo, done: false, ticker: 0, skipTimer: 0, endTimer: 0 };
    active = breakState;

    function stopTimers() {
      clearInterval(breakState.ticker);
      clearTimeout(breakState.skipTimer);
      clearTimeout(breakState.endTimer);
    }

    // The member's video continues from the second the ad interrupted it
    function finish() {
      if (breakState.done) return;
      breakState.done = true;
      stopTimers();
      if (adVideo) {
        adVideo.pause();
        adVideo.removeAttribute('src');
      }
      overlay.remove();
      holder.classList.remove('fb-post-media-ad');
      if (active === breakState) active = null;
      if (video.isConnected) video.play().catch(() => {});
    }

    function showSkip() {
      skipBtn.hidden = false;
    }

    function countdown(until) {
      const left = Math.max(0, (until - Date.now()) / 1000);
      timeEl.textContent = Math.max(1, Math.ceil(left)) + 's';
      if (left <= 0) clearInterval(breakState.ticker);
    }

    skipBtn.addEventListener('click', finish);
    if (waitBeforeSkip <= 0) showSkip();
    else breakState.skipTimer = setTimeout(showSkip, waitBeforeSkip * 1000);

    if (mediaType === 'video') {
      adVideo.addEventListener('ended', finish);
      adVideo.addEventListener('error', finish);
      adVideo.addEventListener('loadedmetadata', () => {
        if (!isFinite(adVideo.duration)) return;
        const until = Date.now() + adVideo.duration * 1000;
        clearInterval(breakState.ticker);
        breakState.ticker = setInterval(() => countdown(until), 500);
        countdown(until);
      });
      const attempt = adVideo.play();
      if (attempt && attempt.catch) {
        // A browser that blocks sound still shows the ad, played silently
        attempt.catch(() => {
          adVideo.muted = true;
          adVideo.play().catch(finish);
        });
      }
    } else {
      const until = Date.now() + IMAGE_AD_MS;
      timeEl.textContent = Math.ceil(IMAGE_AD_MS / 1000) + 's';
      breakState.ticker = setInterval(() => countdown(until), 500);
      breakState.endTimer = setTimeout(finish, IMAGE_AD_MS);
    }
  }

  // A member video that starts playing earns an ad break a few seconds in
  document.addEventListener('play', event => {
    const video = event.target;
    if (!video || !video.matches || !video.matches(VIDEO_SELECTOR)) return;
    if (video.closest('.fb-ad')) return;
    // A feed repaint can take the ad away with its post: never leave the
    // player stuck behind an ad that is no longer on the page
    if (active && (!active.video.isConnected || !active.overlay.isConnected)) {
      if (active.adVideo) active.adVideo.pause();
      active = null;
    }
    load().then(() => {
      if (!enabled || active) return;
      if (video.paused || video.dataset.adBreakShown === '1') return;
      if (!eligible(video).length) return;
      cancelPending(video);
      const timer = setTimeout(() => {
        pending.delete(video);
        if (video.paused || !video.isConnected) return;
        video.dataset.adBreakShown = '1';
        startBreak(video);
      }, BREAK_AFTER_MS);
      pending.set(video, timer);
    });
  }, true);

  // Pausing before the break cancels it; a clip that ends may earn a new one
  document.addEventListener('pause', event => {
    const video = event.target;
    if (!video || !video.matches || !video.matches(VIDEO_SELECTOR)) return;
    if (active && active.video === video) return;
    cancelPending(video);
  }, true);

  document.addEventListener('ended', event => {
    const video = event.target;
    if (video && video.matches && video.matches(VIDEO_SELECTOR)) delete video.dataset.adBreakShown;
  }, true);

  return {
    load,
    // Called after the admin changes an ad, so the next video uses the new list
    refresh() {
      loading = null;
      pool = [];
      return load();
    }
  };
})();
