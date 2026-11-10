// Serverless photo upload — the Cloudinary preset stays in the environment, never in the browser
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloud || !preset) {
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

  const form = new FormData();
  form.append('upload_preset', preset);
  form.append('file', new Blob([photo], { type: req.headers['content-type'] || 'image/jpeg' }), 'story.jpg');
  const upstream = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: 'POST',
    body: form
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok || !data.secure_url) {
    res.status(502).json({ error: (data.error && data.error.message) || 'Cloudinary upload failed' });
    return;
  }
  res.status(200).json({ url: data.secure_url });
}
