// Photos and videos go straight to Cloudinary with the app's unsigned upload preset
// (stored publicly — anyone with the link can open them).
// A backup account is used automatically when the primary account stops working,
// and the app's own server uploads as the last resort.
function cloudinaryAccounts() {
  const cfg = window.APP_CONFIG || {};
  return [
    [cfg.CLOUDINARY_CLOUD_NAME, cfg.CLOUDINARY_UPLOAD_PRESET],
    [cfg.CLOUDINARY_CLOUD_NAME_BACKUP, cfg.CLOUDINARY_UPLOAD_PRESET_BACKUP]
  ]
    .filter((pair) => pair[0] && pair[1])
    .map((pair) => ({ cloud: pair[0], preset: pair[1] }));
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
  let lastError = null;
  for (const account of cloudinaryAccounts()) {
    try {
      return await cloudinaryUploadDirect(blob, account);
    } catch (e) {
      // Account unreachable or refusing uploads (disabled, quota, bad preset): try the next one.
      lastError = e;
    }
  }
  const viaServer = await cloudinaryUploadViaServer(blob);
  if (viaServer) return viaServer;
  throw lastError || new Error('Cloudinary is not connected');
}
