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
    // select_account so the admin can pick another Google account, not only the
    // one the browser happens to be signed in to
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
    state
  });
  res.redirect(302, AUTH_ENDPOINT + '?' + query.toString());
}
