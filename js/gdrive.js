// Google Drive storage. The app server holds the connected account, so the
// browser only hands the file to the server. A video is started by the server
// and then sent straight to Google, so its size is not capped by the app's own
// function. Returns '' when Drive cannot take the file, so callers fall back to
// the other storage providers (Cloudinary is the last one).
async function gdriveUpload(blob, onProgress) {
  const type = blob.type || 'image/jpeg';
  const video = String(type).indexOf('video/') === 0;
  if (video) {
    const sessionUrl = await gdriveUploadVideo(blob, onProgress);
    if (sessionUrl) return sessionUrl;
  }
  try {
    const res = await uploadRequest({
      url: '/api/drive/upload',
      headers: {
        'Content-Type': type,
        'X-File-Name': encodeURIComponent(uploadFileName(blob))
      },
      body: blob,
      onProgress
    });
    if (res.status === 404 || res.status === 501) return '';
    let data = {};
    try { data = JSON.parse(res.text || '{}'); } catch { data = {}; }
    if (!res.ok || !data.url) throw new Error(data.error || 'Google Drive upload failed');
    return data.url;
  } catch (error) {
    // A video still posts: Cloudinary takes over when Drive cannot
    if (video) return '';
    throw error;
  }
}

// Starts a Drive upload session on the server, then puts the video straight
// into Google so a big file never travels through the app's own function.
async function gdriveUploadVideo(blob, onProgress) {
  const type = blob.type || 'video/mp4';
  let session;
  try {
    session = await fetch('/api/drive/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: type, size: blob.size, name: uploadFileName(blob) })
    });
  } catch {
    return '';
  }
  if (!session.ok) return '';
  const started = await session.json().catch(() => ({}));
  if (!started.uploadUrl) return '';

  let put;
  try {
    put = await uploadRequest({
      url: started.uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': type },
      body: blob,
      onProgress
    });
  } catch {
    return '';
  }
  if (!put.ok) return '';
  let file = {};
  try { file = JSON.parse(put.text || '{}'); } catch { file = {}; }
  if (!file.id) return '';

  let done;
  try {
    done = await fetch('/api/drive/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: file.id, contentType: type })
    });
  } catch {
    return '';
  }
  if (!done.ok) return '';
  const finished = await done.json().catch(() => ({}));
  return finished.url || '';
}
