#!/usr/bin/env python3
"""A fake of the backend's Wi-Fi endpoints, in front of an emulated backend, for test_wifi.py.

The emulated backend stubs NetworkManager: it scans no network, knows no Wi-Fi, cannot connect, repair or
start a hotspot. This proxy answers /api/v1/wifi/{config,list,connect,delete,repair} from an in-memory
machine (a client of "Home WiFi" with three known networks and five in range) and passes everything else,
the Socket.IO websocket included, to the real backend. /fake/state reads (GET) and changes (POST, a JSON
object merged into the state) the fake machine; the tests use it to tell the fake from the plain backend.

    python3 qt/tests/e2e/wifi_fake.py [--port 18095] [--upstream http://127.0.0.1:18094]

Then run the Dial with API=http://127.0.0.1:18095 and the tests with DIAL_API=http://127.0.0.1:18095.
Standard library only (it runs in the qt-dial-bookworm image).
"""

import argparse
import asyncio
import copy
import json
from urllib.parse import urlparse

INITIAL = {
    "mode": "CLIENT",
    "apName": "MeticulousFakeEspresso",
    "apPassword": "93754120",
    "connected": True,
    "connection_name": "Home WiFi",
    "hostname": "meticulous-fake",
    "ips": ["192.168.7.42", "fe80::4e8:f348:8479:1afe"],
    "mac": "C0:EE:40:A4:7D:A9",
    # Overrides of the health the fake derives from the mode and the connection (e.g. a degraded link).
    "health": {},
    "known_wifis": {
        "Home WiFi": {"ssid": "Home WiFi", "type": "PSK"},
        "Office 5G": {"ssid": "Office 5G", "type": "PSK"},
        "Cafe Guest": {"ssid": "Cafe Guest", "type": "PSK"},
    },
    "networks": [
        {"ssid": "Home WiFi", "signal": 82, "rate": 195, "in_use": True, "type": "PSK", "security": "WPA2"},
        {"ssid": "Office 5G", "signal": 70, "rate": 405, "in_use": False, "type": "PSK", "security": "WPA2"},
        {"ssid": "NoInternet Cafe", "signal": 61, "rate": 130, "in_use": False, "type": "PSK", "security": "WPA2"},
        {"ssid": "A network with a really long name", "signal": 44, "rate": 65, "in_use": False, "type": "PSK", "security": "WPA2"},
        {"ssid": "Neighbours", "signal": 30, "rate": 65, "in_use": False, "type": "PSK", "security": "WPA2"},
    ],
    # Seconds each call takes, so the loading states show.
    "delays": {"list": 1.5, "connect": 1.0, "delete": 0.5, "repair": 2.0, "config": 1.0},
    "repair_fails": False,
    "mode_change_fails": False,
}
state = copy.deepcopy(INITIAL)


def health():
    if state["mode"] == "AP":
        h = {"mode": "AP", "link_connected": False, "has_ipv4": True, "gateway_reachable": False,
             "dns_resolves": False, "internet_reachable": False, "ap_active": True, "degraded": False,
             "verified": True, "last_error": "", "message": "", "last_recovery_action": "",
             "last_recovery_result": "not_needed"}
    elif state["connected"]:
        h = {"mode": "CLIENT", "link_connected": True, "has_ipv4": True, "gateway_reachable": True,
             "dns_resolves": True, "internet_reachable": True, "ap_active": False, "degraded": False,
             "verified": True, "last_error": "", "last_recovery_action": "", "last_recovery_result": "not_needed"}
    else:
        h = {"mode": "CLIENT", "link_connected": False, "has_ipv4": False, "gateway_reachable": False,
             "dns_resolves": False, "internet_reachable": False, "ap_active": False, "degraded": True,
             "verified": True, "last_error": "wifi_not_connected", "last_recovery_action": "",
             "last_recovery_result": ""}
    h.update(state["health"])
    return h


def wifi_config():
    connected = state["connected"] and state["mode"] == "CLIENT"
    return {
        "config": {"mode": state["mode"], "apName": state["apName"], "apPassword": state["apPassword"]},
        "status": {
            "connected": connected,
            "connection_name": state["connection_name"] if connected else None,
            "gateway": "192.168.7.1" if connected else "",
            "routes": [],
            "ips": state["ips"] if connected else [],
            "dns": ["192.168.7.1"] if connected else [],
            "mac": state["mac"],
            "hostname": state["hostname"],
        },
        "health": health(),
        "known_wifis": state["known_wifis"],
    }


async def handle_wifi(method, path, body):
    """(status, object) of a faked call, or None to pass it on."""
    delays = state["delays"]
    if path == "/api/v1/wifi/config" and method == "GET":
        return 200, wifi_config()
    if path == "/api/v1/wifi/config" and method == "POST":
        await asyncio.sleep(delays["config"])
        data = json.loads(body or b"{}")
        if data.get("mode") in ("AP", "CLIENT"):
            if state["mode_change_fails"]:
                return 400, {"status": "error", "error": "The machine could not start its Wi-Fi hotspot. Please try again.",
                             "code": "hotspot_not_active", "config": wifi_config()}
            state["mode"] = data["mode"]
        if "apPassword" in data:
            state["apPassword"] = data["apPassword"]
        return 200, wifi_config()
    if path == "/api/v1/wifi/list" and method == "GET":
        await asyncio.sleep(delays["list"])
        return 200, state["networks"]
    if path == "/api/v1/wifi/connect" and method == "POST":
        await asyncio.sleep(delays["connect"])
        data = json.loads(body or b"{}")
        ssid, password = data.get("ssid"), data.get("password")
        if password == "wrongpass":
            return 400, {"status": "error", "error": f"The password for {ssid} is not correct.", "code": "invalid_credentials"}
        if password is None and ssid not in state["known_wifis"]:
            return 400, {"status": "error", "error": "Wi-Fi credentials were not provided.", "code": "missing_credentials"}
        state["connected"], state["connection_name"], state["mode"] = True, ssid, "CLIENT"
        state["known_wifis"][ssid] = {"ssid": ssid, "type": data.get("type", "PSK")}
        h = health()
        if ssid == "NoInternet Cafe":
            h.update({"degraded": True, "internet_reachable": False, "last_error": "internet_unreachable"})
        return 200, {"status": "ok", "health": h}
    if path == "/api/v1/wifi/delete" and method == "POST":
        await asyncio.sleep(delays["delete"])
        ssid = json.loads(body or b"{}").get("ssid")
        if ssid not in state["known_wifis"]:
            return 400, {"status": "error", "error": "failed to delete unknown wifi"}
        del state["known_wifis"][ssid]
        if state["connection_name"] == ssid:
            state["connected"] = False
        return 200, {"status": "ok"}
    if path == "/api/v1/wifi/repair" and method == "POST":
        await asyncio.sleep(delays["repair"])
        if state["repair_fails"]:
            return 400, {"status": "error", "error": "The router is not responding.", "code": "gateway_unreachable", "health": health()}
        return 200, {"status": "ok", "health": health()}
    if path == "/fake/state":
        if method == "POST":
            patch = json.loads(body or b"{}")
            if patch.get("reset"):
                state.clear()
                state.update(copy.deepcopy(INITIAL))
            for k, v in patch.items():
                if k != "reset":
                    state[k] = v
        return 200, state
    return None


CORS = (b"Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: content-type, authorization, x-authorized\r\n"
        b"Access-Control-Allow-Methods: GET,POST,PUT,OPTIONS,DELETE\r\nCache-Control: no-cache\r\n")


async def read_head(reader):
    head = await reader.readuntil(b"\r\n\r\n")
    lines = head.decode("latin-1").split("\r\n")
    method, target, _ = lines[0].split(" ", 2)
    headers = {}
    for line in lines[1:]:
        if ":" in line:
            k, v = line.split(":", 1)
            headers[k.strip().lower()] = v.strip()
    return head, method, target, headers


async def pipe(reader, writer):
    try:
        while data := await reader.read(65536):
            writer.write(data)
            await writer.drain()
    except (ConnectionError, asyncio.IncompleteReadError):
        pass
    finally:
        try:
            writer.close()
        except Exception:
            pass


async def client(reader, writer, upstream):
    try:
        head, method, target, headers = await read_head(reader)
        body = await reader.readexactly(int(headers.get("content-length", 0) or 0))
        path = urlparse(target).path
        if method == "OPTIONS" and (path.startswith("/api/v1/wifi/") or path.startswith("/fake/")):
            writer.write(b"HTTP/1.1 204 No Content\r\n" + CORS + b"Content-Length: 0\r\nConnection: close\r\n\r\n")
            await writer.drain()
            return
        answer = await handle_wifi(method, path, body)
        if answer is not None:
            status, obj = answer
            payload = json.dumps(obj).encode()
            reason = {200: b"OK", 400: b"Bad Request"}.get(status, b"Status")
            writer.write(b"HTTP/1.1 %d %s\r\n" % (status, reason) + CORS + b"Content-Type: application/json\r\n"
                         + b"Content-Length: %d\r\nConnection: close\r\n\r\n" % len(payload) + payload)
            await writer.drain()
            return
        up_reader, up_writer = await asyncio.open_connection(upstream.hostname, upstream.port)
        if "upgrade" in headers:
            # The Socket.IO websocket: the head as it came, then both ways until either side closes.
            up_writer.write(head + body)
            await up_writer.drain()
            await asyncio.gather(pipe(reader, up_writer), pipe(up_reader, writer))
            return
        # One request per connection: the answer is passed on until the backend closes.
        lines = [line for line in head.decode("latin-1").split("\r\n")[:-2]
                 if not line.lower().startswith(("connection:", "keep-alive:"))]
        up_writer.write(("\r\n".join(lines) + "\r\nConnection: close\r\n\r\n").encode("latin-1") + body)
        await up_writer.drain()
        await pipe(up_reader, writer)
    except (asyncio.IncompleteReadError, ConnectionError, ValueError):
        pass
    finally:
        try:
            writer.close()
        except Exception:
            pass


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=18095)
    parser.add_argument("--upstream", default="http://127.0.0.1:18094")
    args = parser.parse_args()
    upstream = urlparse(args.upstream)
    server = await asyncio.start_server(lambda r, w: client(r, w, upstream), "127.0.0.1", args.port)
    print(f"wifi fake on http://127.0.0.1:{args.port} in front of {args.upstream}", flush=True)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
