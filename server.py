import http.server
import os
import json
import uuid
import urllib.request
import urllib.error

MAX_UPLOAD_BYTES = 8 * 1024 * 1024


def cloudinary_upload(data, content_type):
    """Forward a photo to Cloudinary; the preset stays on the server, never in the browser."""
    cloud = os.environ.get('CLOUDINARY_CLOUD_NAME', '')
    preset = os.environ.get('CLOUDINARY_UPLOAD_PRESET', '')
    if not cloud or not preset:
        return None
    boundary = 'base44' + uuid.uuid4().hex
    body = b''.join([
        f'--{boundary}\r\nContent-Disposition: form-data; name="upload_preset"\r\n\r\n{preset}\r\n'.encode(),
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="story.jpg"\r\nContent-Type: {content_type}\r\n\r\n'.encode(),
        data,
        f'\r\n--{boundary}--\r\n'.encode()
    ])
    req = urllib.request.Request(
        f'https://api.cloudinary.com/v1_1/{cloud}/image/upload',
        data=body,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
    )
    with urllib.request.urlopen(req, timeout=45) as res:
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
        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0 or length > MAX_UPLOAD_BYTES:
            return self.send_json(413, {'error': 'Photo must be smaller than 8 MB'})
        data = self.rfile.read(length)
        try:
            url = cloudinary_upload(data, self.headers.get('Content-Type') or 'image/jpeg')
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
                'SUPABASE_ANON_KEY': os.environ.get('SUPABASE_ANON_KEY', '')
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
