#!/usr/bin/env python3
"""Talks to the Qt Dial's test port (components/TestServer.qml).

    dialctl.py [--port 9310] state | texts | focused | probe NAME | gesture TYPE [N] | button TYPE [N]
               | grab FILE.png | screen NAME | eval JS | wait-screen NAME [SECONDS]

Also importable: DialClient(port).call({"cmd": ...}).
"""
import argparse
import asyncio
import itertools
import json
import os
import sys
import time

import websockets

_ids = itertools.count(1)


class DialClient:
    def __init__(self, port=9310, host="127.0.0.1"):
        self.url = f"ws://{host}:{port}"
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self._ws = self._loop.run_until_complete(websockets.connect(self.url, max_size=None))

    def call(self, message, timeout=10):
        message = dict(message, id=next(_ids))

        async def go():
            await self._ws.send(json.dumps(message))
            while True:
                answer = json.loads(await asyncio.wait_for(self._ws.recv(), timeout))
                if answer.get("id") == message["id"]:
                    return answer

        return self._loop.run_until_complete(go())

    def close(self):
        self._loop.run_until_complete(self._ws.close())

    # Conveniences
    def state(self):
        return self.call({"cmd": "state"})

    def texts(self):
        return self.call({"cmd": "texts"})["texts"]

    def focused(self):
        return self.call({"cmd": "focused"})["focused"]

    def probe(self, name):
        return self.call({"cmd": "probe", "name": name})["value"]

    def gesture(self, kind, count=1, pause=0.12):
        for _ in range(count):
            self.call({"cmd": "gesture", "type": kind})
            time.sleep(pause)

    def push(self):
        """A short press: pressDown, pressUp, then click (what the firmware sends for a click)."""
        self.gesture("pressDown", pause=0.08)
        self.gesture("pressUp", pause=0.02)
        self.gesture("click", pause=0.2)

    def grab(self, path):
        return self.call({"cmd": "grab", "path": os.path.abspath(path)}, timeout=20)

    def wait_screen(self, name, timeout=15):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            s = self.state()
            if s["screen"] == name and not s["transitioning"]:
                return s
            time.sleep(0.1)
        raise AssertionError(f"not on {name}: {self.state()}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.environ.get("DIAL_TEST_PORT", 9310)))
    parser.add_argument("command")
    parser.add_argument("args", nargs="*")
    a = parser.parse_args()
    c = DialClient(a.port)
    cmd, args = a.command, a.args
    if cmd == "state":
        out = c.state()
    elif cmd == "texts":
        out = c.texts()
    elif cmd == "focused":
        out = c.focused()
    elif cmd == "probe":
        out = c.probe(args[0])
    elif cmd in ("gesture", "button"):
        n = int(args[1]) if len(args) > 1 else 1
        for _ in range(n):
            out = c.call({"cmd": cmd, "type": args[0]})
            time.sleep(0.12)
    elif cmd == "push":
        c.push()
        out = c.state()
    elif cmd == "grab":
        out = c.grab(args[0])
    elif cmd == "screen":
        out = c.call({"cmd": "screen", "name": args[0]})
    elif cmd == "eval":
        out = c.call({"cmd": "eval", "js": " ".join(args)})
    elif cmd == "wait-screen":
        out = c.wait_screen(args[0], float(args[1]) if len(args) > 1 else 15)
    else:
        sys.exit(f"unknown command {cmd}")
    print(json.dumps(out, indent=1) if not isinstance(out, str) else out)
    c.close()


if __name__ == "__main__":
    main()
