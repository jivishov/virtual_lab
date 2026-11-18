"""Local preview for the self-contained studio."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class StudioServer(ThreadingHTTPServer):
    # Several pages can request their ES modules and WASM in parallel at startup.
    request_queue_size = 128


class StaticFiles(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".mjs": "text/javascript", ".wasm": "application/wasm"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8774)
    options = parser.parse_args()
    handler = partial(StaticFiles, directory=str(Path(__file__).resolve().parent))
    with StudioServer(("127.0.0.1", options.port), handler) as preview:
        print(f"Spectrophotometry Studio at http://127.0.0.1:{preview.server_port}/", flush=True)
        try:
            preview.serve_forever()
        except KeyboardInterrupt:
            pass
