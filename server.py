import http.server
import os
import json
import uuid
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


def cloudinary_upload(data, content_type, filename=None):
    """Forward a photo or video to Cloudinary; the preset stays on the server, never in the browser."""
    cloud = os.environ.get('CLOUDINARY_CLOUD_NAME', '')
    preset = os.environ.get('CLOUDINARY_UPLOAD_PRESET', '')
    if not cloud or not preset:
        return None
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
                'CLOUDINARY_UPLOAD_PRESET': os.environ.get('CLOUDINARY_UPLOAD_PRESET', '')
            }
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript')
            self.end_headers()
            self.wfile.write(f'window.APP_CONFIG = {json.dumps(config)};'.encode())
            return
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
