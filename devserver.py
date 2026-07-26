"""Dev server for TRACE.

Plain `python -m http.server` sends no Cache-Control, so browsers cache ES
modules heuristically and can execute a stale module graph (an old config
paired with a new renderer, etc.). This sends no-store on every response so a
reload always fetches the real files.

    python devserver.py [port]
"""

import functools
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    # Python's mimetypes table predates these. A woff2 served as
    # application/octet-stream makes <link rel="preload" type="font/woff2">
    # mismatch, so the browser discards the preload and downloads it twice.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".woff2": "font/woff2",
        ".woff": "font/woff",
        ".mjs": "text/javascript",
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_head(self):
        # Drop conditional headers so the server can never answer 304 and let
        # a stale cached module win.
        del self.headers["If-Modified-Since"]
        del self.headers["If-None-Match"]
        return super().send_head()

    def log_message(self, fmt, *args):
        status = args[1] if len(args) > 1 else ""
        # Keep the console readable: only surface failures.
        if status and status[0] in ("4", "5"):
            sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"TRACE dev server (no-store) -> http://127.0.0.1:{port}/", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
