// Reports whether Google Drive can be used here, and where the callback lands.
import { settings, canStore, readConnection, redirectUri } from '../_drive.js';

export default async function handler(req, res) {
  const configured = Boolean(settings());
  const connection = configured ? await readConnection() : {};
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    configured,
    store: canStore(),
    connected: Boolean(connection.refresh_token),
    email: connection.email || '',
    redirectUri: redirectUri(req)
  });
}
