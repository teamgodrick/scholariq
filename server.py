"""ScholarIQ: one program that serves the website and the AI backend.

Double-click ScholarIQ.bat (or run: py server.py). Python 3.9 or newer, nothing to install.
"""
import json
import mimetypes
import os
import socket
import sys
import threading
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "backend"))
sys.path.insert(0, os.path.join(ROOT, "backend", "vendor"))

import api  # noqa: E402
import db  # noqa: E402
import llm  # noqa: E402

WEB = os.path.join(ROOT, "web")
TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
         ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
         ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon"}
SHARE = "--share" in sys.argv
STATE = {"port": 8000, "lan_ip": ""}


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return ""


class Handler(BaseHTTPRequestHandler):
    server_version = "ScholarIQ"

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            sys.stdout.write("  %s\n" % (args[0],))

    def _send(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code, data):
        self._send(code, json.dumps(data).encode(), "application/json")

    def _is_local(self):
        return self.client_address[0] in ("127.0.0.1", "::1", "::ffff:127.0.0.1")

    def _api(self, method):
        url = urlparse(self.path)
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        body = {}
        if raw and "json" in (self.headers.get("Content-Type") or ""):
            try:
                body = json.loads(raw)
            except ValueError:
                return self._json(400, {"detail": "Bad request data."})
        query = {k: v[0] for k, v in parse_qs(url.query).items()}
        ctx = {"is_local": self._is_local(), "sharing": SHARE, "lan_ip": STATE["lan_ip"], "port": STATE["port"]}
        try:
            self._json(200, api.dispatch(method, url.path, body, query, raw, ctx["is_local"], ctx))
        except PermissionError as e:
            self._json(403, {"detail": str(e)})
        except LookupError:
            self._json(404, {"detail": "Not found."})
        except llm.LLMError as e:
            self._json(503, {"detail": str(e)})
        except (ValueError, KeyError, TypeError) as e:
            self._json(400, {"detail": str(e) or "Please check what you typed."})
        except Exception:
            traceback.print_exc()
            self._json(500, {"detail": "Something went wrong inside ScholarIQ. Check the black window."})

    def _stream_chat(self):
        if not self._is_local():
            return self._json(403, {"detail": "Only the laptop running ScholarIQ can use this part."})
        length = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
            if not (body.get("question") or "").strip():
                return self._json(400, {"detail": "Type a question."})
            docs = api._docs(body)
        except ValueError as e:
            return self._json(400, {"detail": str(e) or "Bad request data."})
        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()  # no Content-Length: the connection closing marks the end
        import rag
        try:
            mode = "notes" if body.get("mode") == "notes" else "hybrid"
            for ev in rag.stream_answer(body["question"], body.get("history"), mode, docs):
                self.wfile.write((json.dumps(ev) + "\n").encode())
                self.wfile.flush()
        except llm.LLMError as e:
            self.wfile.write((json.dumps({"type": "error", "detail": str(e)}) + "\n").encode())
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            traceback.print_exc()
            self.wfile.write((json.dumps({"type": "error", "detail": "Something went wrong inside ScholarIQ."}) + "\n").encode())

    def do_POST(self):
        if self.path == "/api/chat/stream":
            return self._stream_chat()
        self._api("POST") if self.path.startswith("/api/") else self._send(404, b"", "text/plain")

    def do_GET(self):
        if self.path.startswith("/api/"):
            return self._api("GET")
        path = urlparse(self.path).path
        path = "/index.html" if path in ("", "/") else path
        full = os.path.normpath(os.path.join(WEB, path.lstrip("/")))
        if not full.startswith(WEB) or not os.path.isfile(full):
            return self._send(404, b"Not found", "text/plain")
        ext = os.path.splitext(full)[1].lower()
        with open(full, "rb") as f:
            self._send(200, f.read(), TYPES.get(ext) or mimetypes.guess_type(full)[0] or "application/octet-stream")


def main():
    if sys.version_info < (3, 9):
        print("ScholarIQ needs Python 3.9 or newer. Install it from python.org and try again.")
        return
    db.init()
    host = "0.0.0.0" if SHARE else "127.0.0.1"
    port = int(os.environ.get("SCHOLARIQ_PORT", "8000"))
    server = None
    for p in range(port, port + 10):
        try:
            server = ThreadingHTTPServer((host, p), Handler)
            STATE["port"] = p
            break
        except OSError:
            continue
    if not server:
        print("Could not start: ports 8000-8009 are busy. Close other ScholarIQ windows and try again.")
        return
    STATE["lan_ip"] = lan_ip()
    url = f"http://localhost:{STATE['port']}"
    print("=" * 60)
    print("  ScholarIQ is running.  Open:", url)
    if SHARE:
        print(f"  Study group address for friends on this Wi-Fi: http://{STATE['lan_ip']}:{STATE['port']}")
        print("  Friends can ONLY see the Study Group board, never your notes or data.")
    print("  Keep this window open. Close it to stop ScholarIQ.")
    print("=" * 60)
    def auto_scan():
        try:
            if llm.status().get("ok"):
                import rag
                res = rag.scan_library()
                if res["added"]:
                    print("  Library: added", ", ".join(res["added"]))
        except Exception:
            pass
    threading.Timer(4.0, auto_scan).start()
    if "--no-browser" not in sys.argv:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()