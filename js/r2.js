// Cloudflare R2 uploads. The browser asks the app server for a short-lived signed
// URL, then PUTs the file straight into the bucket — the R2 keys never leave the
// server. Returns '' when R2 is not connected so callers can fall back.
async function r2Upload(blob, onProgress) {
  const type = blob.type || 'application/octet-stream';
  const name = (typeof uploadFileName === 'function' && uploadFileName(blob)) || 'upload.jpg';
  const res = await fetch(
    '/api/r2-sign?type=' + encodeURIComponent(type) + '&name=' + encodeURIComponent(name)
  );
  if (res.status === 404 || res.status === 501) return '';
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.uploadUrl || !data.publicUrl) return '';
  // The signed PUT reports progress, so a large video answers as it goes
  const put = await uploadRequest({
    url: data.uploadUrl,
    method: 'PUT',
    headers: { 'Content-Type': type },
    body: blob,
    onProgress
  });
  if (!put.ok) throw new Error('R2 upload failed (' + put.status + ')');
  return data.publicUrl;
}
