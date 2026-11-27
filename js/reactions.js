// Facebook-style reaction icons, drawn inline so they render the same everywhere
var Posts = window.Posts || {};

const FB_RX_ART = {
  like: `<circle cx="20" cy="20" r="20" fill="#1877f2"/>
    <g transform="translate(3 4.2) scale(1.4)">
      <path fill="#fff" d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
    </g>`,
  love: `<circle cx="20" cy="20" r="20" fill="#f02849"/>
    <g transform="translate(2 1.9) scale(1.5)">
      <path fill="#fff" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </g>`,
  haha: `<circle cx="20" cy="20" r="20" fill="#f7b125"/>
    <path d="M10.6 17.2c1.8-3.4 5.2-3.4 7 0" fill="none" stroke="#1c1e21" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M22.4 17.2c1.8-3.4 5.2-3.4 7 0" fill="none" stroke="#1c1e21" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M11 21.6h18c-.6 5.5-4.2 8.9-9 8.9s-8.4-3.4-9-8.9z" fill="#1c1e21"/>
    <path d="M14.6 27.4c1.2 1.9 3.1 2.9 5.4 2.9s4.2-1 5.4-2.9H14.6z" fill="#f02849"/>`,
  wow: `<circle cx="20" cy="20" r="20" fill="#f7b125"/>
    <path d="M10.9 11.5c1.9-1.6 4.6-1.6 6.5 0" fill="none" stroke="#1c1e21" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M22.6 11.5c1.9-1.6 4.6-1.6 6.5 0" fill="none" stroke="#1c1e21" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="15.1" cy="17.6" r="3.2" fill="#fff"/><circle cx="15.1" cy="17.6" r="1.7" fill="#1c1e21"/>
    <circle cx="24.9" cy="17.6" r="3.2" fill="#fff"/><circle cx="24.9" cy="17.6" r="1.7" fill="#1c1e21"/>
    <ellipse cx="20" cy="27" rx="3.5" ry="4.4" fill="#1c1e21"/>`,
  sad: `<circle cx="20" cy="20" r="20" fill="#f7b125"/>
    <path d="M11.2 12.6l5.2 1.9" fill="none" stroke="#1c1e21" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M28.8 12.6l-5.2 1.9" fill="none" stroke="#1c1e21" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="15.3" cy="18.6" r="2.2" fill="#1c1e21"/>
    <circle cx="24.7" cy="18.6" r="2.2" fill="#1c1e21"/>
    <path d="M24.7 21.2c1.6 2.1 2.4 3.4 2.4 4.5a2.4 2.4 0 0 1-4.8 0c0-1.1.8-2.4 2.4-4.5z" fill="#54c7ec"/>
    <path d="M15.6 28.6c1.3-2 2.9-3 4.4-3s3.1 1 4.4 3" fill="none" stroke="#1c1e21" stroke-width="2.2" stroke-linecap="round"/>`,
  angry: `<defs>
      <linearGradient id="fbRxAngryGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f06421"/><stop offset="1" stop-color="#ffc464"/>
      </linearGradient>
    </defs>
    <circle cx="20" cy="20" r="20" fill="url(#fbRxAngryGrad)"/>
    <path d="M10.4 10.2l7.9 3.6-1.5 3.1-6.9-3.4z" fill="#1c1e21"/>
    <path d="M29.6 10.2l-7.9 3.6 1.5 3.1 6.9-3.4z" fill="#1c1e21"/>
    <circle cx="15.2" cy="18.9" r="2.1" fill="#1c1e21"/>
    <circle cx="24.8" cy="18.9" r="2.1" fill="#1c1e21"/>
    <path d="M15.6 27.6h8.8" fill="none" stroke="#1c1e21" stroke-width="2.6" stroke-linecap="round"/>`
};

// A member's own face is stored as "face:<image url>"
Posts.faceUrl = function (type) {
  const match = /^face:(.+)$/.exec(String(type || ''));
  return match ? match[1] : '';
};

// A member's own video reaction is stored as "vid:<video url>"
Posts.videoUrl = function (type) {
  const match = /^vid:(.+)$/.exec(String(type || ''));
  return match ? match[1] : '';
};

// A reaction clip is drawn as a face a few dozen pixels wide, so Cloudinary
// sends a small copy of the member's upload instead of the whole clip — an
// eight megabyte video for a face is what made the feed and profiles crawl
function reactionClip(url) {
  const src = String(url || '');
  if (!/res\.cloudinary\.com\/[^/]+\/video\/upload\//.test(src)) return src;
  if (/\/video\/upload\/[^/]*(w_\d|q_auto|c_fill)/.test(src)) return src;
  return src.replace('/video/upload/', '/video/upload/w_160,h_160,c_fill,q_auto/');
}

// Uploaded reactions on a post take turns growing and wiggling: js/posts.js
// hands one of them the fb-rx-turning class at a time (css/facebook.css holds
// the 2 second keyframes), so the order works the same on every device. The
// copy inside the Like button never animates, so one reaction never grows
// twice at once.
Posts.reactionIcon = function (type) {
  const video = Posts.videoUrl(type);
  const face = Posts.faceUrl(type);
  if (video) {
    // The video plays while it holds its growing and wiggling turn. The #t=0.1
    // seeks to the first frame, so a phone paints the face instead of a black
    // circle before the video is played. Only that first frame is fetched up
    // front: the rest of the clip loads when its turn comes.
    return `<span class="fb-rx fb-rx-face fb-rx-video"><video class="fb-rx-img fb-rx-vid" src="${fbEscape(reactionClip(video))}#t=0.1" muted playsinline webkit-playsinline preload="metadata"></video></span>`;
  }
  if (face) {
    return `<span class="fb-rx fb-rx-face"><img class="fb-rx-img" src="${fbEscape(fbImageUrl(face, 96))}" alt="" loading="lazy" decoding="async"></span>`;
  }
  const art = FB_RX_ART[type] || FB_RX_ART.like;
  return `<span class="fb-rx fb-rx-${type}"><svg class="fb-rx-svg" viewBox="0 0 40 40" aria-hidden="true" focusable="false">${art}</svg></span>`;
};
