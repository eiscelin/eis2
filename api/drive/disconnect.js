// Forgets the connected Google account, and revokes the token with Google.
import { readConnection, clearConnection } from '../_drive.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { refresh_token: refreshToken } = await readConnection();
  if (refreshToken) {
    try {
      await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(refreshToken), {
        method: 'POST'
      });
    } catch {
      /* the local connection is cleared either way */
    }
  }
  await clearConnection();
  res.status(200).json({ ok: true });
}
