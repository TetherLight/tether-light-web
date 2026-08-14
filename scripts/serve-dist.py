# Node が入っていない環境で dist/ を確認するための簡易サーバー。
# 通常は scripts/serve-dist.mjs を使う（こちらはフォールバック）。
import http.server
import os
import socketserver

DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dist")
PORT = int(os.environ.get("PORT", "8080"))

os.chdir(DIST)


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(fmt % args, flush=True)


with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving dist/ at http://localhost:{PORT}", flush=True)
    httpd.serve_forever()
