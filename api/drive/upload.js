// Uploads a photo — or a small video — into the connected Google Drive. A big
// video uses the resumable session in session.js instead. Returns 501 when
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
  const photo = Buffer.concat(chunks);
  if (!photo.length) {
    res.status(400).json({ error: 'No photo received' });
    return;
  }

  try {
    const url = await uploadToDrive(photo, contentType, req.headers['x-file-name'] || '');
    res.status(200).json({ url });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Google Drive upload failed' });
  }
}
