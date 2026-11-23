// Streams a stored video back from Drive, passing the browser's Range requests
// along so the player can seek. Photos use Google's image CDN instead.
import { Readable } from 'node:stream';
import { settings, canStore, readConnection, accessToken } from '../../_drive.js';

// A video is larger than a function's normal response cap, so stream it.
export const config = { api: { responseLimit: false } };

export default async function handler(req, res) {
  const id = String(req.query.id || '');
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    res.status(400).json({ error: 'Invalid file' });
    return;
  }
  const connection = settings() && canStore() ? await readConnection() : {};
  if (!connection.refresh_token) {
    res.status(404).json({ error: 'Google Drive is not connected' });
    return;
  }
  const token = await accessToken();
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
  if (!upstream.ok && upstream.status !== 206) {
    const status = [401, 403, 404].includes(upstream.status) ? 404 : 502;
    res.status(status).json({ error: 'Video is not available' });
    return;
  }

  res.status(upstream.status);
  const type = upstream.headers.get('content-type');
  if (type) res.setHeader('Content-Type', type);
  const length = upstream.headers.get('content-length');
  if (length) res.setHeader('Content-Length', length);
  const range = upstream.headers.get('content-range');
  if (range) res.setHeader('Content-Range', range);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  if (req.method === 'HEAD' || !upstream.body) {
    res.end();
    return;
  }
  const stream = Readable.fromWeb(upstream.body);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}
