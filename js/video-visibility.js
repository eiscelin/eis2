// Only a clip that is completely on screen plays. A video that scrolls out of
// view stops by itself, and a muted clip starts again when it is fully back, so
// a phone never decodes a video the member cannot see
window.VideoVisibility = (function () {
  if (!('IntersectionObserver' in window)) return { watch() {}, scan() {} };

  const auto = new WeakSet();       // paused here, so it may start again by itself
  const selfPaused = new WeakSet(); // the pause under way is this module's
  const watched = new WeakSet();

  // Ad clips keep their own timing: one stopped mid-way would never end
  function isAd(video) {
    return !!video.closest('.fb-ad') || !!video.closest('.fb-cover-ad');
  }

  function pauseQuietly(video) {
    selfPaused.add(video);
    video.pause();
  }

  // A playing clip is a moving picture under glass: the cards around it give up
  // their frosted blur while it runs, so a phone never re-blurs that backdrop
  // for every frame of the video
  function syncCards(video) {
    // Only a clip filling the post, or the ad inside it, is worth the change: a
    // small reaction video never blurs a backdrop wide enough to cost a frame
    const big = v => !v.paused && !v.ended && (!!v.closest('.fb-post-media') || !!v.closest('.fb-cover-ad'));
    let el = video.parentElement;
    while (el && el !== document.body) {
      if (el.classList && el.classList.contains('fb-card')) {
        el.classList.toggle('fb-card-live', [...el.querySelectorAll('video')].some(big));
      }
      el = el.parentElement;
    }
  }

  function isWhole(entry) {
    const viewport = window.innerHeight || 0;
    const height = entry.boundingClientRect.height;
    // A clip taller than the screen can never be whole; filling the screen counts
    if (height > viewport * 0.95) return entry.intersectionRect.height >= viewport * 0.9;
    return entry.intersectionRatio >= 0.9;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const video = entry.target;
      if (isWhole(entry)) {
        // Only a silent clip comes back on its own: a member's video with sound
        // waits for the member to start it again
        if (auto.has(video) && video.muted) {
          auto.delete(video);
          video.play().catch(() => {});
        }
      } else if (!video.paused) {
        auto.add(video);
        pauseQuietly(video);
      }
    });
  }, { threshold: [0, 0.25, 0.5, 0.75, 0.9, 1] });

  function watch(video) {
    if (!video || video.tagName !== 'VIDEO' || isAd(video) || watched.has(video)) return;
    watched.add(video);
    observer.observe(video);
  }

  function scan(root) {
    if (!root) return;
    if (root.nodeType === 1 && root.tagName === 'VIDEO') watch(root);
    if (root.querySelectorAll) root.querySelectorAll('video').forEach(watch);
  }

  // The member stopped the clip itself, so it stays stopped
  document.addEventListener('pause', event => {
    const video = event.target;
    if (!video || video.tagName !== 'VIDEO') return;
    if (selfPaused.has(video)) selfPaused.delete(video);
    else auto.delete(video);
    syncCards(video);
  }, true);

  // A clip that reaches its end has not paused, so the card is put back here
  document.addEventListener('ended', event => {
    const video = event.target;
    if (video && video.tagName === 'VIDEO') syncCards(video);
  }, true);

  // A clip started while it is off screen stops at once — an ad that ends after
  // the member scrolled away must not leave it playing unseen
  document.addEventListener('play', event => {
    const video = event.target;
    if (!video || video.tagName !== 'VIDEO') return;
    syncCards(video);
    if (isAd(video)) return;
    const box = video.getBoundingClientRect();
    if (box.bottom <= 0 || box.top >= (window.innerHeight || 0)) {
      auto.add(video);
      pauseQuietly(video);
    }
  }, true);

  new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(scan));
  }).observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scan(document));
  } else {
    scan(document);
  }

  return { watch, scan };
})();
