// Plays a cover video across the whole screen, uncropped and with sound.
function fbPlayFullVideo(url) {
  const clean = String(url || '').replace(/#.*$/, '');
  if (!clean) return null;
  const overlay = document.createElement('div');
  overlay.className = 'cover-player';
  overlay.innerHTML = `
    <button class="cover-player-close" type="button" aria-label="Close video">✕</button>
    <video class="cover-player-video" src="${fbEscape(clean)}" controls playsinline preload="auto"></video>`;
  document.body.appendChild(overlay);

  const video = overlay.querySelector('video');
  const close = () => {
    video.pause();
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('click', e => {
    if (e.target === overlay || e.target.closest('.cover-player-close')) close();
  });

  // Sound on: the cover thumbnail itself is muted for autoplay
  const start = document.createElement('button');
  start.type = 'button';
  start.className = 'cover-player-start';
  start.textContent = '▶ Play with sound';
  start.hidden = true;
  overlay.appendChild(start);
  const play = () => video.play().catch(() => { start.hidden = false; });
  start.addEventListener('click', e => { e.stopPropagation(); start.hidden = true; play(); });
  video.addEventListener('playing', () => { start.hidden = true; });

  video.muted = false;
  video.volume = 1;
  play();
  return overlay;
}
