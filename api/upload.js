// Serverless photo upload — the Cloudinary presets stay in the environment, never in the browser.
// Each account is tried in turn, so a backup account takes over when the primary stops working.
export const config = { api: { bodyParser: false } };

function accounts() {
  return [
    [process.env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_UPLOAD_PRESET],
    [process.env.CLOUDINARY_CLOUD_NAME_BACKUP, process.env.CLOUDINARY_UPLOAD_PRESET_BACKUP]
  ].filter(([cloud, preset]) => cloud && preset);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const list = accounts();
  if (!list.length) {
    res.status(501).json({ error: 'Cloudinary is not connected' });
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const photo = Buffer.concat(chunks);
  if (!photo.length) {
    res.status(400).json({ error: 'No photo received' });
    return;
  }

  const type = req.headers['content-type'] || 'image/jpeg';
  const kind = type.startsWith('video/') ? 'video' : 'image';
  let name = kind === 'video' ? 'upload.mp4' : 'upload.jpg';
  try {
    const sent = decodeURIComponent(req.headers['x-file-name'] || '');
    if (sent && sent.indexOf('.') > -1) name = sent.replace(/[^\w.-]/g, '');
  } catch (e) { /* keep the default name */ }

  let lastError = 'Cloudinary upload failed';
  for (const [cloud, preset] of list) {
    const form = new FormData();
    form.append('upload_preset', preset);
    form.append('file', new Blob([photo], { type }), name);
    try {
      const upstream = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${kind}/upload`, {
        method: 'POST',
        body: form
      });
      const data = await upstream.json().catch(() => ({}));
      if (upstream.ok && data.secure_url) {
        res.status(200).json({ url: data.secure_url });
        return;
      }
      lastError = (data.error && data.error.message) || lastError;
    } catch (e) {
      lastError = e.message || lastError;
    }
  }
  res.status(502).json({ error: lastError });
}
