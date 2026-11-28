// A phone is not always a strong phone. This reads what the device and the
// connection say about themselves once, at load, and the app leans on it so the
// same features stay smooth on a cheap Android as on a flagship: the glass
// loses its live blur, photos and clips are asked for at a smaller size, and a
// weak phone only decodes and animates what is actually on screen.
window.DeviceProfile = (function () {
  const nav = window.navigator || {};
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection || {};
  const memory = Number(nav.deviceMemory) || 0;   // GB — Chrome on Android only
  const cores = Number(nav.hardwareConcurrency) || 0;
  const slowNet = !!conn.saveData || /^(slow-)?2g$|^3g$/.test(conn.effectiveType || '');
  // Either sign is enough: 4 GB or less, or 4 threads or less, is a device that
  // pays for every extra blur, image byte and video decoder it is handed
  const lite = slowNet || (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4);

  const profile = {
    lite: !!lite,
    slowNet: !!slowNet,
    memory,
    cores,
    // Photos and clips are asked for at what the slot shows, and no wider than
    // a lite device can draw cheaply, so the same feed costs it less data
    imageWidth: width => (profile.lite && width ? Math.min(width, 640) : width),
    videoWidth: width => (profile.lite && width ? Math.min(width, 720) : width)
  };

  if (profile.lite) document.documentElement.classList.add('fb-lite');
  return profile;
})();
