// Streams a video stored in the connected Google Drive back to the browser.
// Drive's own download links refuse playback, so the bytes pass through here
// with the browser's Range requests intact and the file can be played at once.
import { accessToken } from '../../_drive.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const id = String(req.query.id || '');
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    res.status(400).json({ error: 'Unknown file' });
    return;
  }
  let token = null;
  try {
    token = await accessToken();
  } catch {
    token = null;
  }
  if (!token) {
    res.status(404).json({ error: 'Google Drive is not connected' });
    return;
  }

  const headers = { Authorization: 'Bearer ' + token };
  if (req.headers.range) headers.Range = req.headers.range;
  const upstream = await fetch(
    'https://www.googleapis.com/drive/v3/files/' + id + '?alt=media',
    { headers }
  );
  if (!upstream.ok) {
    res.status(upstream.status === 404 ? 404 : 502).json({ error: 'Google Drive could not serve the video' });
    return;
  }

  res.status(upstream.status);
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
  ['content-length', 'content-range'].forEach(name => {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  });
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  if (req.method === 'HEAD' || !upstream.body) {
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  res.end();
}
