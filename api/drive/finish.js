// The browser has put the file into Drive; share it and hand back its address.
import { settings, canStore, readConnection, shareFile, driveMediaUrl } from '../_drive.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const connection = settings() && canStore() ? await readConnection() : {};
  if (!connection.refresh_token) {
    res.status(501).json({ error: 'Google Drive is not connected' });
    return;
  }

  const body = req.body || {};
  const id = String(body.id || '');
  const contentType = String(body.contentType || '');
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    res.status(400).json({ error: 'Invalid file' });
    return;
  }

  try {
    await shareFile(id);
    res.status(200).json({ url: driveMediaUrl(id, contentType) });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Google Drive upload failed' });
  }
}
