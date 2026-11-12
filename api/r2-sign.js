// Signs a short-lived Cloudflare R2 upload URL — the R2 keys stay in the environment,
// never in the browser. The browser then PUTs the file straight into the bucket.
import crypto from 'node:crypto';

const EXPIRES = 900;

function settings() {
  const account = process.env.R2_ACCOUNT_ID || '';
  const bucket = process.env.R2_BUCKET || '';
  const access = process.env.R2_ACCESS_KEY_ID || '';
  const secret = process.env.R2_SECRET_ACCESS_KEY || '';
  const publicBase = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  if (!account || !bucket || !access || !secret || !publicBase) return null;
  return { account, bucket, access, secret, publicBase };
}

const EXTENSIONS = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-m4v': 'm4v',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic'
};

function objectKey(type, sentName) {
  const ext = EXTENSIONS[type] || (type.indexOf('video/') === 0 ? 'mp4' : 'jpg');
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const id = crypto.randomUUID().replace(/-/g, '');
  void sentName;
  return 'uploads/' + stamp + '/' + id + '.' + ext;
}

const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const hmac = (key, msg) => crypto.createHmac('sha256', key).update(msg).digest();

function presign(cfg, key, contentType) {
  const host = cfg.account + '.r2.cloudflarestorage.com';
  const path = '/' + [cfg.bucket, ...key.split('/')].map(enc).join('/');
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const scope = dateStamp + '/auto/s3/aws4_request';
  const params = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': cfg.access + '/' + scope,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(EXPIRES),
    'X-Amz-SignedHeaders': 'content-type;host'
  };
  const query = Object.keys(params)
    .sort()
    .map((k) => enc(k) + '=' + enc(params[k]))
    .join('&');
  const canonicalRequest = [
    'PUT',
    path,
    query,
    'content-type:' + contentType + '\n' + 'host:' + host + '\n',
    'content-type;host',
    'UNSIGNED-PAYLOAD'
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');
  const signingKey = hmac(hmac(hmac(hmac('AWS4' + cfg.secret, dateStamp), 'auto'), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  return 'https://' + host + path + '?' + query + '&X-Amz-Signature=' + signature;
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const cfg = settings();
  if (!cfg) {
    res.status(501).json({ error: 'R2 is not connected' });
    return;
  }
  const type = String(req.query.type || 'application/octet-stream');
  const key = objectKey(type, String(req.query.name || ''));
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    uploadUrl: presign(cfg, key, type),
    publicUrl: cfg.publicBase + '/' + key
  });
}
