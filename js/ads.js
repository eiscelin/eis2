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
  let playedAds = new Map();         // ad id -> { count, lastAt } this session

  // A cover ad holds a phone's page still while it plays, so the device is not
  // asked to decode the ad and scroll at the same time. The hold ends with the
  // ad (or after HOLD_MAX_MS) and does not come back on the same page
  const HOLD_MAX_MS = 12000;      // a clip that never ends still lets go by then
  let holdUsed = false;
  let holdTimer = 0;
  let holdCover = null;           // the cover whose ad is holding the page
  let holdToken = null;           // the ad that put the hold there
  let goneTicks = 0;

  // Only the ad that holds may let go, so an ad left over from an earlier page
  // cannot free the page under the ad that is playing now
  function releaseScroll(token) {
    if (token && token !== holdToken) return;
    clearInterval(holdTimer);
    holdCover = null;
    holdToken = null;
    goneTicks = 0;
    document.documentElement.classList.remove('fb-ad-hold');
    document.body.classList.remove('fb-ad-hold');
  }

  // The page stands still while the ad plays, then scrolls again. A hold never
  // outlives its ad: once the page has no cover ad on it for half a second the
  // page is free again
  function holdScroll(token, cover, ms) {
    holdCover = cover;
    holdToken = token;
    goneTicks = 0;
    document.documentElement.classList.add('fb-ad-hold');
    document.body.classList.add('fb-ad-hold');
    const until = Date.now() + Math.min(ms > 0 ? ms : HOLD_MAX_MS, HOLD_MAX_MS);
    clearInterval(holdTimer);
    holdTimer = setInterval(() => {
      const adUp = !!document.querySelector('.fb-cover-ad');
      goneTicks = (!adUp && (!holdCover || !holdCover.isConnected)) ? goneTicks + 1 : 0;
      if (Date.now() >= until || goneTicks >= 2) releaseScroll();
    }, 250);
  }

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

  // Before 027_ad_targeting.sql, 028_ad_play_schedule.sql, 029_ad_contact.sql or
  // 030_ad_image_seconds.sql run their columns are missing, so the ads keep
  // playing (once, everywhere, without contact details, for the default six
  // seconds) instead of stopping
  const AD_COLUMNS = [
    'id, title, media_url, media_type, skip_seconds, created_by, play_limit, gap_minutes, target_user_id, target_post_id, contact_type, contact_value, image_seconds',
    'id, title, media_url, media_type, skip_seconds, created_by, play_limit, gap_minutes, target_user_id, target_post_id, contact_type, contact_value',
    'id, title, media_url, media_type, skip_seconds, created_by, play_limit, gap_minutes, target_user_id, target_post_id',
    'id, title, media_url, media_type, skip_seconds, created_by, target_user_id, target_post_id',
    'id, title, media_url, media_type, skip_seconds, created_by'
  ];

  function fetchAds() {
    function step(i) {
      return adsQuery(AD_COLUMNS[i]).then(result =>
        (result && result.error && i + 1 < AD_COLUMNS.length) ? step(i + 1) : result);
    }
    return step(0);
  }

  // The advertiser's Facebook page, whether the admin typed a page name or the
  // whole address
  function fbPageUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^(www\.)?(facebook\.com|fb\.com|m\.me)\//i.test(raw)) return 'https://' + raw;
    return 'https://www.facebook.com/' + raw.replace(/^@/, '');
  }

  // What an ad offers while it plays, in its bottom bar next to Skip: the
  // advertiser's phone number or Facebook page, and a Message button that opens
  // the chat of the member who placed the ad
  function adActions(ad, cls) {
    const parts = [];
    const value = String(ad.contact_value || '').trim();
    if (value && ad.contact_type === 'mobile') {
      const digits = value.replace(/[^\d+]/g, '');
      if (digits) {
        parts.push(`<a class="${cls}-btn" href="tel:${escapeHtml(digits)}" aria-label="Call the advertiser">📞 Call</a>`);
        parts.push(`<a class="${cls}-btn" href="sms:${escapeHtml(digits)}" aria-label="Send an SMS to the advertiser">💬 SMS</a>`);
      }
    } else if (value && ad.contact_type === 'facebook') {
      parts.push(`<a class="${cls}-btn" href="${escapeHtml(fbPageUrl(value))}" target="_blank" rel="noopener" aria-label="Open the advertiser's Facebook page">f Facebook page</a>`);
    }
    if (ad.owner) {
      const ownerName = ad.owner.role === 'admin'
        ? 'Support'
        : (ad.owner.full_name || ad.owner.username || 'the advertiser');
      parts.push(`<button class="${cls}-btn ${cls}-msg" type="button" data-ad-chat="${escapeHtml(ad.owner.id)}" data-ad-owner="${escapeHtml(ownerName)}">💬 Message</button>`);
    }
    return parts.length ? `<span class="${cls}">${parts.join('')}</span>` : '';
  }

  // Who each ad's Message button talks to: the member who placed the ad, or the
  // admin's support inbox for an ad the admin inserted, so the button is always
  // there while an ad plays (in a video or on a profile cover)
  function attachOwners(list) {
    if (!list.length || typeof sb === 'undefined' || !sb) return Promise.resolve();
    const ids = [...new Set(list.map(ad => ad.created_by).filter(id => id != null))];
    const placed = ids.length
      ? sb.from('users').select('id, username, full_name, role, status, deleted_at').in('id', ids)
      : Promise.resolve({ data: [] });
    return Promise.all([
      placed,
      sb.from('users').select('id, username, full_name, role, status, deleted_at').eq('role', 'admin').limit(1)
    ]).then(([placedResult, adminResult]) => {
      const byId = new Map((placedResult.data || []).map(user => [String(user.id), user]));
      const admin = (adminResult.data || []).find(user => !user.deleted_at
        && user.status !== 'deleted' && user.status !== 'suspended') || null;
      list.forEach(ad => {
        const owner = byId.get(String(ad.created_by));
        if (owner && !owner.deleted_at && owner.status !== 'deleted' && owner.status !== 'suspended') {
          ad.owner = owner;
        } else if (admin) {
          ad.owner = admin;
        }
      });
    }).catch(() => {});
  }

  // A click on the ad's Message button opens the chat of the ad's owner
  function bindChatButtons(scope) {
    scope.querySelectorAll('[data-ad-chat]').forEach(btn => {
      btn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (window.AdChat) window.AdChat.open(Number(btn.dataset.adChat), btn.dataset.adOwner);
      });
    });
  }

  // Where an ad is inserted rides along in media_type: a cover ad is stored as
  // 'cover_image' or 'cover_video', everything else plays inside member videos
  function isCoverAd(ad) {
    return String(ad.media_type || '').indexOf('cover') === 0;
  }

  function isVideoAd(ad) {
    return /video$/.test(String(ad.media_type || ''));
  }

  // An ad interrupts a video that is already playing, so it must be small and
  // ready: a lighter Cloudinary copy, a first-frame poster, and its bytes
  // pulled ahead of the break
  function adVideoSrc(ad) {
    return fbVideoUrl(ad.media_url, 1280);
  }

  function adPoster(ad) {
    return fbVideoPoster(ad.media_url, 960);
  }

  let warm = { adId: null, el: null };

  function releaseWarm() {
    if (!warm.el) return;
    warm.el.pause();
    warm.el.removeAttribute('src');
    try { warm.el.load(); } catch (e) { /* nothing left to release */ }
    warm = { adId: null, el: null };
  }

  function warmAd(ad) {
    if (!ad || !isVideoAd(ad)) return;
    if (warm.adId === String(ad.id) && warm.el) return;
    releaseWarm();
    const el = document.createElement('video');
    el.className = 'fb-ad-video';
    el.setAttribute('playsinline', '');
    el.preload = 'auto';
    el.muted = true;
    const poster = adPoster(ad);
    if (poster) el.setAttribute('poster', poster);
    el.src = adVideoSrc(ad);
    try { el.load(); } catch (e) { /* it still plays when the break starts */ }
    warm = { adId: String(ad.id), el };
  }

  // A fresh player every time, reading the bytes the warm-up already pulled:
  // a reused element that failed once would fail again and the ad would vanish
  function adVideoElement(overlay, ad, poster) {
    const box = overlay.querySelector('.fb-ad-media');
    if (!box) return null;
    releaseWarm();
    const el = document.createElement('video');
    el.className = 'fb-ad-video';
    el.setAttribute('playsinline', '');
    el.autoplay = true;
    el.preload = 'auto';
    el.muted = false;
    el.volume = 1;
    if (poster) el.setAttribute('poster', poster);
    el.src = adVideoSrc(ad);
    box.appendChild(el);
    return el;
  }

  // Every ad starts with its sound on. Phones refuse a sounding start until the
  // visitor touches the page, so the ad plays silently for that moment and the
  // first tap, touch (even the one that starts a scroll) or key press brings the
  // sound up
  const SOUND_UNLOCK_EVENTS = ['pointerdown', 'touchstart', 'keydown'];

  function playWithSound(el, opts) {
    const o = opts || {};
    el.muted = false;
    el.volume = 1;
    const attempt = el.play();
    if (!attempt || !attempt.catch) return;
    attempt.catch(() => {
      el.muted = true;
      el.play().catch(() => { if (o.onFail) o.onFail(); });
      if (o.onBlocked) o.onBlocked();
      const unlock = () => {
        SOUND_UNLOCK_EVENTS.forEach(name => document.removeEventListener(name, unlock, true));
        if (!el.isConnected) return;
        // A browser can stop a clip it was playing silently the moment it is
        // unmuted, so the sound is asked for again here and once more a moment
        // later; a browser that still refuses keeps the ad running silently
        // instead of freezing it
        const withSound = () => {
          el.muted = false;
          el.volume = 1;
          const played = el.play();
          if (played && played.catch) played.catch(() => {
            el.muted = true;
            el.play().catch(() => {});
            if (o.onBlocked) o.onBlocked();
          });
        };
        withSound();
        setTimeout(() => {
          if (el.isConnected && el.paused && !el.ended) withSound();
        }, 150);
        if (o.onUnmuted) o.onUnmuted();
      };
      SOUND_UNLOCK_EVENTS.forEach(name => document.addEventListener(name, unlock, true));
    });
  }

  // How many times an ad may play, and how long it waits before it plays again
  function playLimit(ad) {
    const limit = Number(ad.play_limit);
    if (ad.play_limit == null || !isFinite(limit)) return 1;
    return limit;
  }

  function gapMs(ad) {
    const minutes = Number(ad.gap_minutes);
    return isFinite(minutes) && minutes > 0 ? minutes * 60000 : 0;
  }

  // How long an image ad stays on screen: the admin sets it per ad. Until
  // 030_ad_image_seconds.sql has run the same number lives in skip_seconds,
  // which an image ad has no other use for
  function imageSeconds(ad) {
    const own = Number(ad.image_seconds);
    if (isFinite(own) && own > 0) return own;
    const stored = Number(ad.skip_seconds);
    if (isFinite(stored) && stored > 0) return stored;
    return IMAGE_AD_MS / 1000;
  }

  function imageMs(ad) {
    return imageSeconds(ad) * 1000;
  }

  function adState(ad) {
    return playedAds.get(String(ad.id)) || { count: 0, lastAt: 0 };
  }

  // 0 = may play right now, Infinity = done for this session
  function waitFor(ad) {
    const state = adState(ad);
    const limit = playLimit(ad);
    if (limit > 0 && state.count >= limit) return Infinity;
    return Math.max(0, state.lastAt + gapMs(ad) - Date.now());
  }

  function markPlayed(ad) {
    const state = adState(ad);
    playedAds.set(String(ad.id), { count: state.count + 1, lastAt: Date.now() });
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
      return attachOwners(pool);
    }).catch(() => {
      pool = [];
    });
    return loading;
  }

  // An ad with no target plays everywhere, one with a member plays only in that
  // member's videos, one with a video plays only in that exact uploaded video
  function targeted(video) {
    const postId = video.dataset.postId || '';
    const userId = video.dataset.postUser || '';
    return pool.filter(ad => {
      if (isCoverAd(ad)) return false;
      if (ad.target_post_id != null) return !!postId && String(ad.target_post_id) === postId;
      if (ad.target_user_id != null) return !!userId && String(ad.target_user_id) === userId;
      return true;
    });
  }

  // Of those, the ones whose play count and repeat gap allow them right now
  function eligible(video) {
    return targeted(video).filter(ad => waitFor(ad) === 0);
  }

  function peekAd(video) {
    const list = eligible(video);
    return list.length ? list[cursor % list.length] : null;
  }

  function nextAd(video) {
    const ad = peekAd(video);
    if (ad) cursor += 1;
    return ad;
  }

  function cancelPending(video) {
    const timer = pending.get(video);
    if (timer) clearTimeout(timer);
    pending.delete(video);
    // The break was called off, so its ad no longer needs to be downloaded
    if (timer) releaseWarm();
  }

  // Only one clip makes sound: every other video on the page stops — except the
  // ad pinned on a profile cover, which keeps playing through everything else
  function pauseOthers(video) {
    document.querySelectorAll('video').forEach(other => {
      if (other === video || other.paused) return;
      if (other.closest('.fb-ad') || other.closest('.fb-cover-ad')) return;
      other.pause();
    });
  }

  function startBreak(video) {
    if (active || !video.isConnected) return;
    const ad = nextAd(video);
    const holder = video.parentElement;
    if (!ad || !holder) return;
    markPlayed(ad);

    const mediaType = isVideoAd(ad) ? 'video' : 'image';
    // An image ad may keep its length in skip_seconds, so its Skip button comes
    // back to the usual few seconds instead of waiting for the whole image
    const waitBeforeSkip = mediaType === 'video'
      ? (ad.skip_seconds == null ? DEFAULT_SKIP_SECONDS : Math.max(0, Number(ad.skip_seconds)))
      : Math.min(DEFAULT_SKIP_SECONDS, imageSeconds(ad));

    pauseOthers(video);
    video.pause();

    const poster = adPoster(ad);
    const overlay = document.createElement('div');
    overlay.className = 'fb-ad';
    overlay.setAttribute('role', 'group');
    overlay.setAttribute('aria-label', 'Advertisement');
    overlay.innerHTML = `
      <div class="fb-ad-media">
        ${mediaType === 'video'
          ? ''
          : `<img class="fb-ad-image" src="${escapeHtml(fbImageUrl(ad.media_url, 1080))}" alt="${escapeHtml(ad.title || 'Advertisement')}">`}
      </div>
      <div class="fb-ad-bar">
        <span class="fb-ad-tag">Ad</span>
        <span class="fb-ad-title">${escapeHtml(ad.title || 'Sponsored')}</span>
        ${adActions(ad, 'fb-ad-contact')}
        <span class="fb-ad-time" aria-hidden="true"></span>
        <button class="fb-ad-skip" type="button" hidden>Skip ad</button>
      </div>`;
    holder.classList.add('fb-post-media-ad');
    holder.appendChild(overlay);
    bindChatButtons(overlay);

    const skipBtn = overlay.querySelector('.fb-ad-skip');
    const timeEl = overlay.querySelector('.fb-ad-time');
    const adVideo = mediaType === 'video' ? adVideoElement(overlay, ad, poster) : null;

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
        // Drop the rest of the clip from the connection so the member's own
        // video gets the whole bandwidth back
        try { adVideo.load(); } catch (e) { /* already empty */ }
      }
      overlay.remove();
      holder.classList.remove('fb-post-media-ad');
      if (active === breakState) active = null;
      // Another ad may follow (a different one, or this one once its repeat gap
      // has passed); when nothing is left the member's video simply plays on
      armBreak(video, BREAK_AFTER_MS);
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
      playWithSound(adVideo, { onFail: finish });
    } else {
      const showMs = imageMs(ad);
      const until = Date.now() + showMs;
      timeEl.textContent = Math.ceil(showMs / 1000) + 's';
      breakState.ticker = setInterval(() => countdown(until), 500);
      breakState.endTimer = setTimeout(finish, showMs);
    }
  }

  // Arm the next break for this video: as soon as an ad is allowed it waits
  // `delay`; an ad still inside its repeat gap pushes the break to when it ends
  function armBreak(video, delay) {
    if (!video.isConnected || video.paused || active || pending.has(video)) return;
    let wait = delay;
    if (!eligible(video).length) {
      const waits = targeted(video).map(waitFor).filter(ms => isFinite(ms));
      if (!waits.length) return;
      wait = Math.max(delay, Math.min.apply(null, waits));
    }
    // A break that is about to happen pulls its ad ahead, so the ad starts
    // instantly instead of buffering while the member waits
    if (wait <= 8000) {
      const ahead = peekAd(video);
      if (ahead) warmAd(ahead);
    }
    const timer = setTimeout(() => {
      pending.delete(video);
      if (video.paused || !video.isConnected || active) return;
      startBreak(video);
    }, wait);
    pending.set(video, timer);
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
      if (!enabled) return;
      armBreak(video, BREAK_AFTER_MS);
    });
  }, true);

  // Pausing before the break cancels it; a clip that ends may earn a new one
  document.addEventListener('pause', event => {
    const video = event.target;
    if (!video || !video.matches || !video.matches(VIDEO_SELECTOR)) return;
    if (active && active.video === video) return;
    cancelPending(video);
  }, true);

  // ---------- Ads on a member's profile cover ----------

  // A cover ad with no target plays on every profile, one with a member plays
  // only on that member's profile
  function coverAds(ownerId) {
    return pool.filter(ad => isCoverAd(ad)
      && (ad.target_user_id == null || String(ad.target_user_id) === String(ownerId)));
  }

  // A cover ad plays with sound, but only one clip makes sound at a time: while
  // an ad break or a member's own video plays out loud the cover ad keeps
  // playing silently and gets the sound back when that clip stops
  function syncCoverSound() {
    const busy = [...document.querySelectorAll('video')].some(el =>
      !el.closest('.fb-cover-ad') && !el.paused && !el.muted);
    document.querySelectorAll('.fb-cover-ad video').forEach(el => {
      el.muted = busy || el.dataset.sound === '0';
    });
  }

  ['play', 'pause', 'ended', 'volumechange'].forEach(name => {
    document.addEventListener(name, syncCoverSound, true);
  });

  // The cover takes the ad's own shape so the whole image or video shows; when
  // the ad ends onEnd runs so the next ad (or the member's cover) can take over.
  // With `repeat` a lone ad never hands the cover back: its clip loops and its
  // image stays up
  function paintCoverAd(cover, ad, onEnd, repeat) {
    const ownCover = cover.querySelector('.fb-cover-media');
    const videoAd = isVideoAd(ad);
    const layer = document.createElement('div');
    layer.className = 'fb-cover-ad';
    layer.setAttribute('role', 'group');
    layer.setAttribute('aria-label', 'Advertisement');
    layer.innerHTML = `
      <span class="fb-cover-ad-tag">Ad</span>
      ${videoAd
        ? '<video class="fb-cover-ad-media" playsinline autoplay preload="auto"></video>'
          + '<button class="fb-cover-ad-sound" type="button" hidden>🔊 Sound</button>'
        : `<img class="fb-cover-ad-media" src="${escapeHtml(fbImageUrl(ad.media_url, 1200))}" alt="${escapeHtml(ad.title || 'Advertisement')}">`}
      ${ad.title ? `<span class="fb-cover-ad-title">${escapeHtml(ad.title)}</span>` : ''}
      ${adActions(ad, 'fb-cover-ad-contact')}`;

    const adMedia = layer.querySelector('.fb-cover-ad-media');
    let imageTimer = 0;
    // The ad leaves the page flow for a bar pinned under the top bar, so it
    // keeps playing and stays in view while the page scrolls; the spacer keeps
    // the page from jumping, and the pinned width in the stylesheet keeps the ad
    // on the cover's own column
    const spacer = document.createElement('div');
    spacer.className = 'fb-cover-ad-spacer';
    spacer.style.height = cover.offsetHeight + 'px';
    cover.parentElement.insertBefore(spacer, cover);
    const topbar = document.querySelector('.fb-topbar');
    // Pinned under the top bar; the pinned width comes from the cover's own
    // column in the stylesheet, so the ad lines up with the cover at any width
    function pin() {
      cover.style.top = (topbar ? topbar.getBoundingClientRect().height : 0) + 'px';
    }
    window.addEventListener('resize', pin);

    function fit() {
      const width = adMedia.videoWidth || adMedia.naturalWidth;
      const height = adMedia.videoHeight || adMedia.naturalHeight;
      if (width && height) cover.style.aspectRatio = width + ' / ' + height;
    }

    let finished = false;
    const holdMark = {};    // marks this ad as the one holding the page
    let heldHere = false;

    function restore(failed) {
      if (finished) return;
      finished = true;
      clearTimeout(imageTimer);
      if (heldHere) releaseScroll(holdMark);
      layer.remove();
      spacer.remove();
      cover.classList.remove('fb-cover--ad');
      cover.classList.remove('fb-cover--pinned');
      window.removeEventListener('resize', pin);
      cover.style.removeProperty('aspect-ratio');
      cover.style.removeProperty('top');
      if (ownCover && ownCover.tagName === 'VIDEO') ownCover.play().catch(() => {});
      if (onEnd) onEnd(!!failed);
    }

    cover.classList.add('fb-cover--ad');
    cover.classList.add('fb-cover--pinned');
    // Only once it is fixed does the measured box mean the right thing
    pin();
    // A shape to pin with until the ad's own one is known
    if (!cover.style.aspectRatio) cover.style.aspectRatio = '16 / 9';
    cover.appendChild(layer);
    bindChatButtons(layer);
    // The first cover ad on this page holds the page still until it ends
    if (!holdUsed) {
      holdUsed = true;
      heldHere = true;
      holdScroll(holdMark, cover, videoAd ? HOLD_MAX_MS : imageMs(ad));
    }
    if (ownCover && ownCover.tagName === 'VIDEO') ownCover.pause();

    if (videoAd) {
      adMedia.addEventListener('loadedmetadata', fit, { once: true });
      if (repeat) adMedia.loop = true;
      else adMedia.addEventListener('ended', () => restore());
      adMedia.addEventListener('error', () => restore(true));
      const coverPoster = adPoster(ad);
      if (coverPoster) adMedia.setAttribute('poster', coverPoster);
      adMedia.src = adVideoSrc(ad);
      const soundBtn = layer.querySelector('.fb-cover-ad-sound');
      // A browser that only allows a silent start plays the ad muted and offers
      // the Sound button, so one tap brings the sound up
      const silent = () => {
        adMedia.dataset.sound = '0';
        adMedia.muted = true;
        soundBtn.hidden = false;
      };
      // Sound on from the first frame — unless another clip already has it — and
      // a blocked start gives the sound back at the member's first tap anywhere
      playWithSound(adMedia, {
        onFail: () => restore(true),
        onBlocked: silent,
        onUnmuted: () => {
          delete adMedia.dataset.sound;
          soundBtn.hidden = true;
          syncCoverSound();
        }
      });
      soundBtn.addEventListener('click', event => {
        event.stopPropagation();
        delete adMedia.dataset.sound;
        soundBtn.hidden = true;
        adMedia.muted = false;
        adMedia.volume = 1;
        // Another clip may hold the sound already: then the cover stays quiet
        syncCoverSound();
        // Unmuting a clip that is already running needs no play(); one the
        // browser stopped for want of a gesture starts again here, and a
        // browser that still refuses sound keeps the button up
        if (adMedia.paused) {
          const attempt = adMedia.play();
          if (attempt && attempt.catch) attempt.catch(silent);
        }
      });
    } else {
      if (adMedia.complete) fit();
      else adMedia.addEventListener('load', fit, { once: true });
      adMedia.addEventListener('error', () => restore(true), { once: true });
      // An image ad always keeps its own time on screen, then hands the cover
      // back to the member
      imageTimer = setTimeout(() => restore(), imageMs(ad));
    }
  }

  // Called by the profile pages once the cover is painted: the ads take turns
  // and start over, so the cover keeps showing an ad for as long as the page is
  // open (only when there is no cover ad at all does the member's own cover show)
  function mountCover(cover, ownerId) {
    if (!cover) return Promise.resolve();
    holdUsed = false;
    return load().then(() => {
      if (!cover.isConnected || cover.querySelector('.fb-cover-ad')) return;
      const failed = new Set();

      function next() {
        if (!cover.isConnected) return;
        const list = coverAds(ownerId).filter(ad => !failed.has(String(ad.id)));
        if (!list.length) return;
        // A cover ad keeps playing: one that is past its play count or still in
        // its repeat gap starts over instead of handing the cover back
        const ready = list.filter(ad => waitFor(ad) === 0);
        const pick = ready.length ? ready : list;
        const ad = pick[cursor++ % pick.length];
        markPlayed(ad);
        // An image ad gives the cover back to the member after its seconds; only
        // another ready ad takes over from there
        const imageAd = !isVideoAd(ad);
        paintCoverAd(cover, ad, failedAd => {
          if (failedAd) failed.add(String(ad.id));
          if (imageAd && !list.some(other => String(other.id) !== String(ad.id)
            && !failed.has(String(other.id)) && waitFor(other) === 0)) return;
          next();
        }, list.length === 1);
      }

      next();
    });
  }

  return {
    load,
    mountCover,
    // Called after the admin changes an ad, so the next video uses the new list
    refresh() {
      loading = null;
      pool = [];
      playedAds = new Map();
      releaseWarm();
      return load();
    }
  };
})();
