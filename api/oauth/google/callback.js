// Google sends the admin back here; the refresh token is stored in Supabase.
import { settings, redirectUri, tokenRequest, saveConnection } from '../../_drive.js';

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}

export default async function handler(req, res) {
  const cfg = settings();
  const url = new URL(req.url, 'http://localhost');
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const expected = readCookie(req, 'gdrive_state');
  res.setHeader('Set-Cookie', 'gdrive_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure');

  if (!cfg || !code || !state || state !== expected) {
    res.redirect(302, '/?drive=error#/Admin');
    return;
  }

  try {
    const tokens = await tokenRequest({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri(req)
    });
    if (!tokens.refresh_token) {
      res.redirect(302, '/?drive=error#/Admin');
      return;
    }
    let email = '';
    if (tokens.access_token) {
      try {
        const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: 'Bearer ' + tokens.access_token }
        });
        if (info.ok) email = (await info.json()).email || '';
      } catch {
        /* the connection works without the address */
      }
    }
    await saveConnection({
      refresh_token: tokens.refresh_token,
      email,
      connected_at: new Date().toISOString()
    });
    res.redirect(302, '/?drive=connected#/Admin');
  } catch {
    res.redirect(302, '/?drive=error#/Admin');
  }
}
