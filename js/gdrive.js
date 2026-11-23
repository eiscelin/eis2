// Google Drive storage. The app server holds the connected account, so the
// browser only hands the file to the server. Returns '' when Google Drive is
// not connected, so callers fall back to the other storage providers.
async function gdriveUpload(blob, onProgress) {
  const res = await uploadRequest({
    url: '/api/drive/upload',
    headers: {
      'Content-Type': blob.type || 'image/jpeg',
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
}
