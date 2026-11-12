// Photos and videos go straight to Cloudinary with the app's unsigned upload preset
// (stored publicly — anyone with the link can open them).
// If the browser cannot reach Cloudinary, the app's own server does the upload instead.
function cloudinarySettings() {
  const cfg = window.APP_CONFIG || {};
  return cfg.CLOUDINARY_CLOUD_NAME && cfg.CLOUDINARY_UPLOAD_PRESET
    ? { cloud: cfg.CLOUDINARY_CLOUD_NAME, preset: cfg.CLOUDINARY_UPLOAD_PRESET }
    : null;
}

function uploadFileName(blob) {
  if (blob.name) return blob.name;
  const type = String(blob.type || '');
  const ext = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'video/x-m4v': 'm4v',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic'
  }[type] || (type.indexOf('video/') === 0 ? 'mp4' : 'jpg');
  return 'upload.' + ext;
}

async function cloudinaryUploadDirect(blob, settings) {
  const kind = String(blob.type || '').indexOf('video/') === 0 ? 'video' : 'image';
  const form = new FormData();
  form.append('upload_preset', settings.preset);
  form.append('file', blob, uploadFileName(blob));
  const res = await fetch(`https://api.cloudinary.com/v1_1/${settings.cloud}/${kind}/upload`, {
    method: 'POST',
    body: form
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) {
    throw new Error((data.error && data.error.message) || 'Cloudinary upload failed');
  }
  return data.secure_url;
}

async function cloudinaryUploadViaServer(blob) {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': blob.type || 'image/jpeg',
      'X-File-Name': encodeURIComponent(uploadFileName(blob))
    },
    body: blob
  });
  if (res.status === 404 || res.status === 501) return '';
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || 'Cloudinary upload failed');
  return data.url;
}

async function cloudinaryUpload(blob) {
  // Cloudflare R2 wins when the server can sign for it; otherwise Cloudinary as before.
  if (typeof r2Upload === 'function') {
    const r2Url = await r2Upload(blob);
    if (r2Url) return r2Url;
  }
  const settings = cloudinarySettings();
  if (settings) {
    try {
      return await cloudinaryUploadDirect(blob, settings);
    } catch (e) {
      // A real answer from Cloudinary (file too large, wrong format) is shown as is;
      // only an unreachable Cloudinary falls back to the app server.
      if (!(e instanceof TypeError)) throw e;
    }
  }
  return cloudinaryUploadViaServer(blob);
}
