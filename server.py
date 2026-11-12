import http.server
import os
import json
import uuid
import hashlib
import hmac
import datetime
import urllib.request
import urllib.parse
import urllib.error

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_VIDEO_BYTES = 100 * 1024 * 1024


def is_video(content_type):
    return (content_type or '').startswith('video/')


def safe_filename(name, content_type):
    """Keep the original name so Cloudinary knows the real video format."""
    default = 'upload.mp4' if is_video(content_type) else 'upload.jpg'
    name = os.path.basename(urllib.parse.unquote(name or '').strip())
    name = ''.join(c for c in name if c.isalnum() or c in '._-')
    return name if name and '.' in name else default


def cloudinary_accounts():
    """Primary account first, then the backup that takes over when it stops working."""
    pairs = [
        (os.environ.get('CLOUDINARY_CLOUD_NAME', ''), os.environ.get('CLOUDINARY_UPLOAD_PRESET', '')),
        (os.environ.get('CLOUDINARY_CLOUD_NAME_BACKUP', ''),
         os.environ.get('CLOUDINARY_UPLOAD_PRESET_BACKUP', ''))
    ]
    return [(cloud, preset) for cloud, preset in pairs if cloud and preset]


def cloudinary_upload_to(cloud, preset, data, content_type, filename):
    kind = 'video' if is_video(content_type) else 'image'
    filename = safe_filename(filename, content_type)
    boundary = 'base44' + uuid.uuid4().hex
    body = b''.join([
        f'--{boundary}\r\nContent-Disposition: form-data; name="upload_preset"\r\n\r\n{preset}\r\n'.encode(),
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\nContent-Type: {content_type}\r\n\r\n'.encode(),
        data,
        f'\r\n--{boundary}--\r\n'.encode()
    ])
    req = urllib.request.Request(
        f'https://api.cloudinary.com/v1_1/{cloud}/{kind}/upload',
        data=body,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
    )
    with urllib.request.urlopen(req, timeout=120 if kind == 'video' else 60) as res:
        return json.loads(res.read().decode()).get('secure_url')


def cloudinary_upload(data, content_type, filename=None):
    """Forward a photo or video to Cloudinary, moving to the backup account if one fails."""
    accounts = cloudinary_accounts()
    if not accounts:
        return None
    last_error = None
    for cloud, preset in accounts:
        try:
            return cloudinary_upload_to(cloud, preset, data, content_type, filename)
        except Exception as e:
            last_error = e
    raise last_error


R2_EXPIRES = 900
R2_EXTENSIONS = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'video/x-m4v': 'm4v',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic'
}


def r2_settings():
    """R2 keys stay on the server; only short-lived signed URLs reach the browser."""
    account = os.environ.get('R2_ACCOUNT_ID', '')
    bucket = os.environ.get('R2_BUCKET', '')
    access = os.environ.get('R2_ACCESS_KEY_ID', '')
    secret = os.environ.get('R2_SECRET_ACCESS_KEY', '')
    public = (os.environ.get('R2_PUBLIC_BASE_URL', '') or '').rstrip('/')
    if not all([account, bucket, access, secret, public]):
        return None
    return {'account': account, 'bucket': bucket, 'access': access, 'secret': secret, 'public': public}


def r2_object_key(content_type):
    ext = R2_EXTENSIONS.get(content_type) or ('mp4' if is_video(content_type) else 'jpg')
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d')
    return 'uploads/%s/%s.%s' % (stamp, uuid.uuid4().hex, ext)


def _hmac(key, msg):
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()


def r2_presign(cfg, key, content_type):
    """AWS SigV4 presigned PUT, as R2's S3 API expects."""
    host = cfg['account'] + '.r2.cloudflarestorage.com'
    path = '/' + '/'.join(urllib.parse.quote(part, safe='') for part in [cfg['bucket']] + key.split('/'))
    now = datetime.datetime.now(datetime.timezone.utc)
    amz_date = now.strftime('%Y%m%dT%H%M%SZ')
    date_stamp = amz_date[:8]
    scope = '%s/auto/s3/aws4_request' % date_stamp
    params = {
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': cfg['access'] + '/' + scope,
        'X-Amz-Date': amz_date,
        'X-Amz-Expires': str(R2_EXPIRES),
        'X-Amz-SignedHeaders': 'content-type;host'
    }
    query = '&'.join(
        '%s=%s' % (urllib.parse.quote(k, safe='-_.~'), urllib.parse.quote(v, safe='-_.~'))
        for k, v in sorted(params.items())
    )
    canonical_request = '\n'.join([
        'PUT',
        path,
        query,
        'content-type:%s\nhost:%s\n' % (content_type, host),
        'content-type;host',
        'UNSIGNED-PAYLOAD'
    ])
    string_to_sign = '\n'.join([
        'AWS4-HMAC-SHA256',
        amz_date,
        scope,
        hashlib.sha256(canonical_request.encode()).hexdigest()
    ])
    signing_key = _hmac(('AWS4' + cfg['secret']).encode(), date_stamp)
    signing_key = _hmac(signing_key, 'auto')
    signing_key = _hmac(signing_key, 's3')
    signing_key = _hmac(signing_key, 'aws4_request')
    signature = hmac.new(signing_key, string_to_sign.encode(), hashlib.sha256).hexdigest()
    return 'https://%s%s?%s&X-Amz-Signature=%s' % (host, path, query, signature)


class Handler(http.server.SimpleHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path.split('?')[0] != '/api/upload':
            return self.send_error(404)
        content_type = self.headers.get('Content-Type') or 'image/jpeg'
        limit = MAX_VIDEO_BYTES if is_video(content_type) else MAX_UPLOAD_BYTES
        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0 or length > limit:
            return self.send_json(413, {'error': 'File must be smaller than %d MB' % (limit // (1024 * 1024))})
        data = self.rfile.read(length)
        try:
            url = cloudinary_upload(data, content_type, self.headers.get('X-File-Name') or '')
        except urllib.error.HTTPError as e:
            message = 'Cloudinary upload failed'
            try:
                message = json.loads(e.read().decode())['error']['message'] or message
            except Exception:
                pass
            return self.send_json(502, {'error': message})
        except Exception as e:
            return self.send_json(502, {'error': str(e)})
        if not url:
            return self.send_json(501, {'error': 'Cloudinary is not connected'})
        return self.send_json(200, {'url': url})

    def do_GET(self):
        if self.path == '/config.js' or self.path.startswith('/config.js?'):
            config = {
                'SUPABASE_URL': os.environ.get('SUPABASE_URL', ''),
                'SUPABASE_ANON_KEY': os.environ.get('SUPABASE_ANON_KEY', ''),
                # Unsigned upload preset: public by design, so the browser can upload directly
                'CLOUDINARY_CLOUD_NAME': os.environ.get('CLOUDINARY_CLOUD_NAME', ''),
                'CLOUDINARY_UPLOAD_PRESET': os.environ.get('CLOUDINARY_UPLOAD_PRESET', ''),
                # Backup account, used by the browser when the primary one stops accepting uploads
                'CLOUDINARY_CLOUD_NAME_BACKUP': os.environ.get('CLOUDINARY_CLOUD_NAME_BACKUP', ''),
                'CLOUDINARY_UPLOAD_PRESET_BACKUP': os.environ.get('CLOUDINARY_UPLOAD_PRESET_BACKUP', '')
            }
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript')
            self.end_headers()
            self.wfile.write(f'window.APP_CONFIG = {json.dumps(config)};'.encode())
            return
        if self.path.split('?')[0] == '/api/r2-sign':
            cfg = r2_settings()
            if not cfg:
                return self.send_json(501, {'error': 'R2 is not connected'})
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            content_type = (query.get('type') or ['application/octet-stream'])[0]
            key = r2_object_key(content_type)
            return self.send_json(200, {
                'uploadUrl': r2_presign(cfg, key, content_type),
                'publicUrl': cfg['public'] + '/' + urllib.parse.quote(key, safe='/')
            })
        # SPA fallback: serve index.html for paths without a file extension
        clean_path = self.path.split('?')[0]
        basename = os.path.basename(clean_path)
        if '.' not in basename:
            self.path = '/index.html'
        return super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    os.chdir('/app')
    # Threaded so an upload never blocks page loads
    http.server.ThreadingHTTPServer(('0.0.0.0', 80), Handler).serve_forever()
