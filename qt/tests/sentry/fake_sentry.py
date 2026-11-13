#!/usr/bin/env python3
"""A local stand-in for Sentry (and, with --machine, for the backend's /api/v1/machine) for dial-smoke.sh.

    fake_sentry.py --port 18765 --out /tmp/fake-sentry [--machine]

Every envelope POSTed to /api/<project>/envelope/ is appended to <out>/envelopes.jsonl as
{"target", "header", "items": [{"header", "event" (JSON items) | "size" + "head" (binary ones)}]}.
Listens on 127.0.0.1 only.
"""
import argparse
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MACHINE = {
    "name": "Smoke Test Kitchen",
    "hostname": "smoke-kitchen",
    "serial": "SMOKE-0001",
    "image_version": "2026.10.24-smoke",
    "image_build_channel": "smoke",
    "firmware": "x",
    "software_version": "x",
}


def parse_envelope(body):
    lines = body.split(b"\n", 1)
    header = json.loads(lines[0] or b"{}")
    rest = lines[1] if len(lines) > 1 else b""
    items = []
    while rest:
        if rest.startswith(b"\n"):
            rest = rest[1:]
            continue
        head, _, rest = rest.partition(b"\n")
        item_header = json.loads(head)
        if "length" in item_header:
            payload, rest = rest[: item_header["length"]], rest[item_header["length"]:]
            if rest.startswith(b"\n"):
                rest = rest[1:]
        else:
            payload, _, rest = rest.partition(b"\n")
        item = {"header": item_header}
        try:
            item["event"] = json.loads(payload)
        except ValueError:
            item["size"] = len(payload)
            item["head"] = payload[:4].decode("latin-1")
        items.append(item)
    return {"header": header, "items": items}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=18765)
    parser.add_argument("--out", required=True)
    parser.add_argument("--machine", action="store_true")
    args = parser.parse_args()
    os.makedirs(args.out, exist_ok=True)
    log = os.path.join(args.out, "envelopes.jsonl")

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *a):
            pass

        def reply(self, status, body=b"{}"):
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
            if "/envelope/" in self.path:
                record = dict(parse_envelope(body), target=self.path)
                with open(log, "a") as f:
                    f.write(json.dumps(record) + "\n")
                self.reply(200)
            else:
                self.reply(404)

        def do_GET(self):
            if args.machine and self.path.startswith("/api/v1/machine"):
                self.reply(200, json.dumps(MACHINE).encode())
            else:
                self.reply(404, b'{"error": "not here"}')

    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
