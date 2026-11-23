import http.server
import os
import json
import uuid
import hashlib
import hmac
import datetime
import gzip
import mimetypes
import email.utils
import re
import shutil
import time
import urllib.request
import urllib.parse
import urllib.error

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_VIDEO_BYTES = 100 * 1024 * 1024

# The sandbox preview must always show the file being edited, so there the
# browser revalidates every asset. Anywhere else (a plain server.py deployment)
# static files may be reused for a while — phones on slow networks then skip
# almost every request on the next visit.
PREVIEW_MODE = os.environ.get('BASE44_PREVIEW_MODE') == '1'

WEBP_SOURCE_SUFFIXES = ('.jpg', '.jpeg', '.png')

# The slim image ships a short mime table, so the types this app serves are set
# here — a picture served under the wrong type is re-decoded by the browser
for _ext, _type in (
    ('.webp', 'image/webp'), ('.css', 'text/css'), ('.js', 'text/javascript'),
    ('.svg', 'image/svg+xml'), ('.json', 'application/json'), ('.mp4', 'video/mp4'),
    ('.webmanifest', 'application/manifest+json')
):
    mimetypes.add_type(_type, _ext)
COMPRESSIBLE_TYPES = ('text/', 'application/javascript', 'application/json', 'image/svg+xml')

# Compressed copies are kept in memory so a page's scripts are gzipped once,
# not on every request
_compressed = {}
_COMPRESSED_LIMIT = 8 * 1024 * 1024


def content_type_for(path):
    ctype = mimetypes.guess_type(path)[0] or 'application/octet-stream'
    if ctype in ('application/javascript', 'application/x-javascript'):
        return 'text/javascript; charset=utf-8'
    if ctype.startswith('text/') or ctype in ('application/json', 'image/svg+xml'):
        return ctype + '; charset=utf-8'
    return ctype


def compressed_body(path, mtime, data):
    """Return (bytes, gzipped) for a text asset, remembering the packed copy."""
    key = (path, mtime, len(data))
    cached = _compressed.get(key)
    if cached is not None:
        return cached, True
    packed = gzip.compress(data, 6)
    if len(packed) >= len(data):
        return data, False
    if sum(len(v) for v in _compressed.values()) + len(packed) > _COMPRESSED_LIMIT:
        _compressed.clear()
    _compressed[key] = packed
    return packed, True


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


# ---- Google Drive storage ------------------------------------------------
# Uploads are kept in the owner's own Google Drive. The account is connected
# once from Admin > Settings; the refresh token lives on a writable volume so
# the connection survives a restart.
GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
GOOGLE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
DRIVE_STATE_PATH = os.environ.get('DRIVE_STATE_PATH') or '/data/google-drive.json'
DRIVE_MEDIA_PATH = re.compile(r'^/api/drive/media/([A-Za-z0-9_-]+)$')

# Short-lived OAuth attempts, so a stale callback link cannot be replayed
_drive_states = {}

# The Drive access token already fetched, so streaming a video does not wait on
# a fresh token for every range the player asks for
_drive_token_cache = {'token': '', 'refresh': '', 'expires': 0.0}


def google_oauth_settings():
    """Client id and secret of the Google Cloud OAuth client, once configured."""
    client_id = os.environ.get('GOOGLE_CLIENT_ID', '')
    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET', '')
    if not client_id or not client_secret:
        return None
    return {'client_id': client_id, 'client_secret': client_secret}


def drive_state():
    try:
        with open(DRIVE_STATE_PATH, encoding='utf-8') as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def save_drive_state(state):
    folder = os.path.dirname(DRIVE_STATE_PATH)
    if folder:
        os.makedirs(folder, exist_ok=True)
    tmp = DRIVE_STATE_PATH + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(state, fh)
    os.replace(tmp, DRIVE_STATE_PATH)


def clear_drive_state():
    try:
        os.remove(DRIVE_STATE_PATH)
    except OSError:
        pass
    _drive_token_cache.update(token='', refresh='', expires=0.0)


def google_token_request(payload):
    body = urllib.parse.urlencode(payload).encode()
    req = urllib.request.Request(
        GOOGLE_TOKEN_URL,
        data=body,
        headers={'Content-Type': 'application/x-www-form-urlencoded'}
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode())


def drive_access_token(force=False):
    """An access token from the stored refresh token, or None when not connected.

    A token lasts an hour, and a video player asks for a new range every few
    seconds: asking Google for a token on each of those would delay the first
    frame, so the token is reused until shortly before it expires.
    """
    settings = google_oauth_settings()
    state = drive_state()
    refresh = state.get('refresh_token')
    if not settings or not refresh:
        return None
    cached = _drive_token_cache
    if not force and cached['token'] and cached['refresh'] == refresh and cached['expires'] > time.time():
        return cached['token']
    try:
        data = google_token_request({
            'client_id': settings['client_id'],
            'client_secret': settings['client_secret'],
            'refresh_token': refresh,
            'grant_type': 'refresh_token'
        })
        token = data.get('access_token')
        if token:
            cached.update(token=token, refresh=refresh,
                          expires=time.time() + max(60, int(data.get('expires_in') or 3600) - 120))
        return token
    except urllib.error.HTTPError as e:
        cached.update(token='', refresh='', expires=0.0)
        if e.code in (400, 401):
            # Revoked or expired: forget the dead connection so the UI can offer a new one
            clear_drive_state()
        raise


def drive_public_url(file_id, content_type):
    # A picture renders straight from Google's image CDN. Videos stream back
    # through this server, because Drive's own download links refuse playback.
    if is_video(content_type):
        return '/api/drive/media/' + file_id
    return 'https://lh3.googleusercontent.com/d/' + file_id


def drive_upload(data, content_type, filename):
    """Resumable upload into the connected Drive, then share it by link."""
    token = drive_access_token()
    if not token:
        raise RuntimeError('Google Drive is not connected')
    name = safe_filename(filename, content_type)
    start = urllib.request.Request(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',
        data=json.dumps({'name': name, 'mimeType': content_type}).encode(),
        headers={
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': content_type,
            'X-Upload-Content-Length': str(len(data))
        },
        method='POST'
    )
    with urllib.request.urlopen(start, timeout=60) as res:
        upload_url = res.headers.get('Location')
    if not upload_url:
        raise RuntimeError('Google Drive did not accept the upload')
    put = urllib.request.Request(
        upload_url,
        data=data,
        headers={'Content-Type': content_type, 'Content-Length': str(len(data))},
        method='PUT'
    )
    with urllib.request.urlopen(put, timeout=600) as res:
        file_id = json.loads(res.read().decode()).get('id')
    if not file_id:
        raise RuntimeError('Google Drive did not return the file')
    # Anyone with the link can open it, so a post keeps showing its media
    try:
        share = urllib.request.Request(
            'https://www.googleapis.com/drive/v3/files/%s/permissions' % file_id,
            data=json.dumps({'role': 'reader', 'type': 'anyone'}).encode(),
            headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
            method='POST'
        )
        urllib.request.urlopen(share, timeout=30).read()
    except Exception:
        pass
    return drive_public_url(file_id, content_type)


class Handler(http.server.SimpleHTTPRequestHandler):
    # HTTP/1.1 keeps the connection open for every script, style and picture, so
    # a phone on a slow network opens one connection instead of dozens
    protocol_version = 'HTTP/1.1'

    def send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def redirect(self, location):
        self.send_response(302)
        self.send_header('Location', location)
        self.send_header('Content-Length', '0')
        self.end_headers()

    def public_origin(self):
        """The address the browser sees, which the Google callback must match."""
        suffix = os.environ.get('BASE44_PUBLIC_HOST_SUFFIX', '')
        if suffix:
            return 'https://3000-' + suffix
        proto = self.headers.get('X-Forwarded-Proto') or 'https'
        host = self.headers.get('X-Forwarded-Host') or self.headers.get('Host') or 'localhost'
        return proto + '://' + host

    def drive_redirect_uri(self):
        return self.public_origin() + '/oauth/google/callback'

    def serve_drive_status(self):
        settings = google_oauth_settings()
        state = drive_state()
        self.send_json(200, {
            'configured': bool(settings),
            'connected': bool(settings and state.get('refresh_token')),
            'email': state.get('email', ''),
            'redirectUri': self.drive_redirect_uri()
        })

    def start_drive_oauth(self):
        settings = google_oauth_settings()
        if not settings:
            return self.redirect('/?drive=missing#/Admin')
        state = uuid.uuid4().hex
        now = time.time()
        for key, started in list(_drive_states.items()):
            if now - started > 900:
                _drive_states.pop(key, None)
        _drive_states[state] = now
        query = urllib.parse.urlencode({
            'client_id': settings['client_id'],
            'redirect_uri': self.drive_redirect_uri(),
            'response_type': 'code',
            'scope': GOOGLE_SCOPE,
            'access_type': 'offline',
            'prompt': 'consent',
            'include_granted_scopes': 'true',
            'state': state
        })
        return self.redirect(GOOGLE_AUTH_URL + '?' + query)

    def finish_drive_oauth(self):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        code = (query.get('code') or [''])[0]
        state = (query.get('state') or [''])[0]
        settings = google_oauth_settings()
        if not settings or not code or not _drive_states.pop(state, None):
            return self.redirect('/?drive=error#/Admin')
        try:
            tokens = google_token_request({
                'client_id': settings['client_id'],
                'client_secret': settings['client_secret'],
                'code': code,
                'grant_type': 'authorization_code',
                'redirect_uri': self.drive_redirect_uri()
            })
        except Exception:
            return self.redirect('/?drive=error#/Admin')
        refresh = tokens.get('refresh_token') or drive_state().get('refresh_token')
        if not refresh:
            return self.redirect('/?drive=error#/Admin')
        email = ''
        access = tokens.get('access_token')
        if access:
            try:
                info = urllib.request.Request(
                    'https://www.googleapis.com/oauth2/v3/userinfo',
                    headers={'Authorization': 'Bearer ' + access}
                )
                with urllib.request.urlopen(info, timeout=20) as res:
                    email = json.loads(res.read().decode()).get('email', '')
            except Exception:
                pass
        save_drive_state({
            'refresh_token': refresh,
            'email': email,
            'connected_at': datetime.datetime.now(datetime.timezone.utc).isoformat()
        })
        return self.redirect('/?drive=connected#/Admin')

    def drive_upload_request(self):
        if not google_oauth_settings() or not drive_state().get('refresh_token'):
            return self.send_json(501, {'error': 'Google Drive is not connected'})
        content_type = self.headers.get('Content-Type') or 'image/jpeg'
        limit = MAX_VIDEO_BYTES if is_video(content_type) else MAX_UPLOAD_BYTES
        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0 or length > limit:
            return self.send_json(413, {'error': 'File must be smaller than %d MB' % (limit // (1024 * 1024))})
        data = self.rfile.read(length)
        try:
            url = drive_upload(data, content_type, self.headers.get('X-File-Name') or '')
        except urllib.error.HTTPError as e:
            message = 'Google Drive upload failed'
            try:
                message = json.loads(e.read().decode())['error']['message'] or message
            except Exception:
                pass
            return self.send_json(502, {'error': message})
        except Exception as e:
            return self.send_json(502, {'error': str(e)})
        return self.send_json(200, {'url': url})

    def drive_disconnect(self):
        token = drive_state().get('refresh_token')
        if token:
            try:
                revoke = urllib.request.Request(
                    'https://oauth2.googleapis.com/revoke?token=' + urllib.parse.quote(token),
                    data=b'',
                    method='POST'
                )
                urllib.request.urlopen(revoke, timeout=15).read()
            except Exception:
                pass
        clear_drive_state()
        return self.send_json(200, {'ok': True})

    def serve_drive_media(self, file_id):
        """Stream a stored video back, passing the browser's Range requests along."""
        try:
            token = drive_access_token()
        except Exception:
            return self.send_error(502)
        if not token:
            return self.send_error(404)
        for attempt in (0, 1):
            headers = {'Authorization': 'Bearer ' + token}
            if self.headers.get('Range'):
                headers['Range'] = self.headers.get('Range')
            request = urllib.request.Request(
                'https://www.googleapis.com/drive/v3/files/%s?alt=media' % file_id,
                headers=headers
            )
            try:
                upstream = urllib.request.urlopen(request, timeout=60)
                break
            except urllib.error.HTTPError as e:
                # A reused token can be revoked early: fetch a new one and retry once
                if e.code == 401 and not attempt:
                    try:
                        token = drive_access_token(force=True)
                    except Exception:
                        token = None
                    if token:
                        continue
                return self.send_error(e.code if e.code in (401, 403, 404) else 502)
            except Exception:
                return self.send_error(502)
        with upstream:
            self.send_response(upstream.status)
            self.send_header('Content-Type', upstream.headers.get('Content-Type') or 'application/octet-stream')
            for name in ('Content-Length', 'Content-Range'):
                value = upstream.headers.get(name)
                if value:
                    self.send_header(name, value)
            self.send_header('Accept-Ranges', 'bytes')
            self.send_header('Cache-Control', 'public, max-age=3600')
            self.end_headers()
            if self.command == 'HEAD':
                return
            try:
                shutil.copyfileobj(upstream, self.wfile)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def serve_config(self, head=False):
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
        body = f'window.APP_CONFIG = {json.dumps(config)};'.encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/javascript; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        if not head:
            self.wfile.write(body)

    def serve_static(self, head=False):
        request_path = self.path.split('?')[0]
        target = self.translate_path(request_path)
        if os.path.isdir(target):
            index = os.path.join(target, 'index.html')
            if os.path.isfile(index):
                target = index
        if not os.path.isfile(target):
            # Single-page app: a route without a file extension still loads the
            # app shell, everything else is a genuine missing file
            if '.' in os.path.basename(request_path):
                return self.send_error(404, 'Not found')
            target = os.path.join(os.getcwd(), 'index.html')

        serve_path = target
        accept = (self.headers.get('Accept') or '').lower()
        wants_webp = 'image/webp' in accept
        if wants_webp and target.lower().endswith(WEBP_SOURCE_SUFFIXES):
            # Phone-friendly copy of the picture: same image, a fraction of the bytes
            candidate = os.path.splitext(target)[0] + '.webp'
            if os.path.isfile(candidate):
                serve_path = candidate

        try:
            stat = os.stat(serve_path)
            with open(serve_path, 'rb') as fh:
                data = fh.read()
        except OSError:
            return self.send_error(404, 'Not found')

        ctype = content_type_for(serve_path)
        compressible = any(t in ctype for t in COMPRESSIBLE_TYPES)
        accept_encoding = self.headers.get('Accept-Encoding') or ''
        use_gzip = compressible and 'gzip' in accept_encoding and len(data) > 1200
        if use_gzip:
            data, use_gzip = compressed_body(serve_path, int(stat.st_mtime), data)

        etag = 'W/"%x-%x%s"' % (int(stat.st_mtime), stat.st_size, '-gz' if use_gzip else '')

        def not_modified():
            self.send_response(304)
            self.send_header('ETag', etag)
            self.send_header('Cache-Control', cache_control)
            self.end_headers()

        if PREVIEW_MODE or 'text/html' in ctype:
            cache_control = 'no-cache'
        else:
            cache_control = 'public, max-age=3600, must-revalidate'

        if self.headers.get('If-None-Match') == etag:
            return not_modified()
        if not self.headers.get('If-None-Match'):
            since = self.headers.get('If-Modified-Since')
            if since:
                try:
                    if int(stat.st_mtime) <= email.utils.parsedate_to_datetime(since).timestamp():
                        return not_modified()
                except (TypeError, ValueError):
                    pass

        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        if use_gzip:
            self.send_header('Content-Encoding', 'gzip')
        if compressible or wants_webp:
            self.send_header('Vary', 'Accept-Encoding, Accept' if wants_webp else 'Accept-Encoding')
        self.send_header('Cache-Control', cache_control)
        self.send_header('ETag', etag)
        self.send_header('Last-Modified', email.utils.formatdate(stat.st_mtime, usegmt=True))
        self.end_headers()
        if not head:
            self.wfile.write(data)

    def do_POST(self):
        path = self.path.split('?')[0]
        if path == '/api/drive/upload':
            return self.drive_upload_request()
        if path == '/api/drive/disconnect':
            return self.drive_disconnect()
        if path != '/api/upload':
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

    def do_HEAD(self):
        path = self.path.split('?')[0]
        if path == '/config.js':
            return self.serve_config(head=True)
        media = DRIVE_MEDIA_PATH.match(path)
        if media:
            return self.serve_drive_media(media.group(1))
        return self.serve_static(head=True)

    def do_GET(self):
        if self.path == '/config.js' or self.path.startswith('/config.js?'):
            return self.serve_config()
        path = self.path.split('?')[0]
        if path == '/oauth/google/start':
            return self.start_drive_oauth()
        if path == '/oauth/google/callback':
            return self.finish_drive_oauth()
        if path == '/api/drive/status':
            return self.serve_drive_status()
        media = DRIVE_MEDIA_PATH.match(path)
        if media:
            return self.serve_drive_media(media.group(1))
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
        return self.serve_static()


if __name__ == '__main__':
    os.chdir('/app')
    # Threaded so an upload never blocks page loads
    http.server.ThreadingHTTPServer(('0.0.0.0', 80), Handler).serve_forever()
