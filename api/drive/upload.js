// Uploads a photo or video into the connected Google Drive. Returns 501 when
// Drive is not connected, so the browser falls back to Cloudinary.
import { settings, canStore, readConnection, uploadToDrive } from '../_drive.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const contentType = req.headers['content-type'] || 'image/jpeg';
  const connection = settings() && canStore() ? await readConnection() : {};
  if (!connection.refresh_token) {
    res.status(501).json({ error: 'Google Drive is not connected' });
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const file = Buffer.concat(chunks);
  if (!file.length) {
    res.status(400).json({ error: 'No file received' });
    return;
  }

  try {
    const url = await uploadToDrive(file, contentType, req.headers['x-file-name'] || '');
    res.status(200).json({ url });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Google Drive upload failed' });
  }
}
