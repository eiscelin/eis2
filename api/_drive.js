// Google Drive storage for the Vercel deployment.
// The connected account is kept in Supabase, because a serverless function has
// no disk that survives between requests. Only the service role key can reach
// that table, so the refresh token never leaves the server.
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const AUTH_ENDPOINT = AUTH_URL;

export function settings() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

// The service role key is what lets the functions save the connection.
export function canStore() {
  return Boolean((process.env.SUPABASE_URL || '') && (process.env.SUPABASE_SERVICE_ROLE_KEY || ''));
}

export function publicOrigin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return proto + '://' + host;
}

// Must match the address the browser sees, or Google refuses the callback.
export function redirectUri(req) {
  return publicOrigin(req) + '/oauth/google/callback';
}

function supabase() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  return { url, key };
}

async function supabaseRequest(path, init = {}) {
  const db = supabase();
  if (!db) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  const res = await fetch(db.url + '/rest/v1/' + path, {
    ...init,
    headers: {
      apikey: db.key,
      Authorization: 'Bearer ' + db.key,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  if (!res.ok) throw new Error('Supabase request failed (' + res.status + ')');
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function readConnection() {
  if (!canStore()) return {};
  try {
    const rows = await supabaseRequest(
      'storage_connections?provider=eq.google&select=refresh_token,email'
    );
    return rows && rows[0] ? rows[0] : {};
  } catch {
    return {};
  }
}

export async function saveConnection(connection) {
  await supabaseRequest('storage_connections?on_conflict=provider', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ provider: 'google', ...connection })
  });
}

export async function clearConnection() {
  if (!canStore()) return;
  try {
    await supabaseRequest('storage_connections?provider=eq.google', { method: 'DELETE' });
  } catch {
    /* a missing row is the same as a cleared connection */
  }
}

export async function tokenRequest(payload) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(payload).toString()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error_description || data.error || 'Google sign-in failed');
    error.status = res.status;
    throw error;
  }
  return data;
}

// A fresh access token from the stored refresh token, or null when not connected.
export async function accessToken() {
  const cfg = settings();
  if (!cfg) return null;
  const { refresh_token: refreshToken } = await readConnection();
  if (!refreshToken) return null;
  try {
    const data = await tokenRequest({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });
    return data.access_token || null;
  } catch (error) {
    // Revoked or expired: forget the dead connection so the card offers a new one
    if (error.status === 400 || error.status === 401) await clearConnection();
    throw error;
  }
}

export function isVideo(contentType) {
  return (contentType || '').startsWith('video/');
}

export function safeFilename(name, contentType) {
  const fallback = isVideo(contentType) ? 'upload.mp4' : 'upload.jpg';
  let decoded = '';
  try {
    decoded = decodeURIComponent(name || '');
  } catch {
    decoded = name || '';
  }
  const cleaned = decoded.split('/').pop().split('\\').pop().trim().replace(/[^\w.-]/g, '');
  return cleaned && cleaned.includes('.') ? cleaned : fallback;
}

async function driveError(res) {
  const data = await res.json().catch(() => ({}));
  return (data.error && data.error.message) || 'Google Drive upload failed';
}

// A picture renders straight from Google's image CDN. A video streams back
// through the app, because Drive's own download links refuse playback.
export function driveMediaUrl(fileId, contentType) {
  return isVideo(contentType)
    ? '/api/drive/media/' + fileId
    : 'https://lh3.googleusercontent.com/d/' + fileId;
}

// Starts a resumable upload and hands the session address to the browser, so a
// video travels straight to Google instead of through a function's size limit.
export async function uploadSession(contentType, size, filename, origin) {
  const token = await accessToken();
  if (!token) throw new Error('Google Drive is not connected');
  const headers = {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Type': contentType,
    'X-Upload-Content-Length': String(size)
  };
  // Naming the page lets Google answer the browser's own upload request
  if (origin) headers.Origin = origin;
  const start = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: safeFilename(filename, contentType), mimeType: contentType })
    }
  );
  if (!start.ok) throw new Error(await driveError(start));
  const uploadUrl = start.headers.get('location');
  if (!uploadUrl) throw new Error('Google Drive did not accept the upload');
  return uploadUrl;
}

// Anyone with the link can open it, so a post keeps showing its media.
export async function shareFile(fileId) {
  const token = await accessToken();
  if (!token) throw new Error('Google Drive is not connected');
  try {
    await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '/permissions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });
  } catch {
    /* the file still uploads; only the public link is missing */
  }
}

// Resumable upload into the connected Drive, then share it by link.
export async function uploadToDrive(buffer, contentType, filename) {
  const token = await accessToken();
  if (!token) throw new Error('Google Drive is not connected');
  const start = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': contentType,
        'X-Upload-Content-Length': String(buffer.length)
      },
      body: JSON.stringify({ name: safeFilename(filename, contentType), mimeType: contentType })
    }
  );
  if (!start.ok) throw new Error(await driveError(start));
  const uploadUrl = start.headers.get('location');
  if (!uploadUrl) throw new Error('Google Drive did not accept the upload');

  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: buffer
  });
  if (!put.ok) throw new Error(await driveError(put));
  const file = await put.json().catch(() => ({}));
  if (!file.id) throw new Error('Google Drive did not return the file');

  // Anyone with the link can open it, so a post keeps showing its media
  try {
    await fetch('https://www.googleapis.com/drive/v3/files/' + file.id + '/permissions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });
  } catch {
    /* the file still uploads; only the public link is missing */
  }
  return driveMediaUrl(file.id, contentType);
}
