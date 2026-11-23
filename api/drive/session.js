// Starts a Drive upload the browser can send straight to Google, so a video is
// not limited by a function's request size. Returns 501 when Drive is not
// connected, so the browser falls back to the other storage providers.
import { settings, canStore, readConnection, publicOrigin, uploadSession } from '../_drive.js';

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

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
  const contentType = String(body.contentType || '');
  const size = Number(body.size) || 0;
  const video = contentType.startsWith('video/');
  if (!video && !contentType.startsWith('image/')) {
    res.status(400).json({ error: 'Unsupported file type' });
    return;
  }
  const limit = video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (size <= 0 || size > limit) {
    res.status(413).json({
      error: 'File must be smaller than ' + Math.round(limit / (1024 * 1024)) + ' MB'
    });
    return;
  }

  try {
    const uploadUrl = await uploadSession(contentType, size, body.name || '', publicOrigin(req));
    res.status(200).json({ uploadUrl });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Google Drive upload failed' });
  }
}
