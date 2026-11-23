// Sends the admin to Google to approve Drive access.
import { randomUUID } from 'crypto';
import { settings, canStore, redirectUri, SCOPE, AUTH_ENDPOINT } from '../../_drive.js';

export default function handler(req, res) {
  const cfg = settings();
  if (!cfg || !canStore()) {
    res.redirect(302, '/?drive=missing#/Admin');
    return;
  }
  const state = randomUUID().replace(/-/g, '');
  // A short-lived cookie proves the callback belongs to this browser
  res.setHeader(
    'Set-Cookie',
    'gdrive_state=' + state + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=900; Secure'
  );
  const query = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state
  });
  res.redirect(302, AUTH_ENDPOINT + '?' + query.toString());
}
