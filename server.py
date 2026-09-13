import http.server
import os
import json

class Handler(http.server.SimpleHTTPRequestHandler):
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
    http.server.HTTPServer(('0.0.0.0', 80), Handler).serve_forever()
