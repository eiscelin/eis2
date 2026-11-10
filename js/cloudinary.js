// Photos are uploaded through the app's own server, which holds the Cloudinary settings
// (stored publicly — anyone with the link can open them).
// An empty string means Cloudinary is not connected, so the caller stores the photo inline.
async function cloudinaryUpload(blob) {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'image/jpeg' },
    body: blob
  });
  if (res.status === 404 || res.status === 501) return '';
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || 'Cloudinary upload failed');
  return data.url;
}
