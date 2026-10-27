"""The Qt Dial's network in the journeys: what Chromium did for the React Dial.

- RecordingProxy: the Dial's backend URL (--api) points here; every request and the Socket.IO websocket
  are forwarded to the real backend, and each request is recorded as (method, url) with the backend's
  URL, as the React fixture's page.on("request") lists them (dial_app.watch.requests).
- The gate: the Dial's http_proxy / https_proxy (Qt's QNetworkAccessManager honours them), so nothing
  but this machine is reachable, as Chromium's host resolver rules make it for the React Dial. A
  request to a third party is refused and recorded (dial_app.refused); one the test answers
  (dial_app.answer_external(prefix, body)) is answered with that body over TLS, with a certificate of
  the suite's CA (SuiteCA, installed in the container's trust store, which Qt reads), and recorded
  with its body (dial_app.answered).
"""

import asyncio
import datetime
import json
import shutil
import ssl
import subprocess
import threading
from pathlib import Path
from urllib.parse import urlsplit

_HOP = {"connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers",
        "transfer-encoding", "upgrade", "host", "content-length"}


class SuiteCA:
    """A CA of this run, trusted by the container (update-ca-certificates), and leaf certificates it signs."""

    def __init__(self, directory: Path):
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.x509.oid import NameOID

        self._x509, self._hashes, self._serialization, self._ec, self._oid = x509, hashes, serialization, ec, NameOID
        self.directory = directory
        directory.mkdir(parents=True, exist_ok=True)
        self.key = ec.generate_private_key(ec.SECP256R1())
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "qt-dial integration third parties CA")])
        now = datetime.datetime.now(datetime.timezone.utc)
        self.cert = (
            x509.CertificateBuilder()
            .subject_name(name).issuer_name(name).public_key(self.key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now - datetime.timedelta(days=1)).not_valid_after(now + datetime.timedelta(days=3))
            .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
            .add_extension(x509.KeyUsage(False, False, False, False, False, True, True, False, False), critical=True)
            .sign(self.key, hashes.SHA256())
        )
        self.pem = directory / "qt-dial-integ-ca.pem"
        self.pem.write_bytes(self.cert.public_bytes(serialization.Encoding.PEM))
        self._contexts: dict[str, ssl.SSLContext] = {}
        self._lock = threading.Lock()

    def install(self):
        """Into the system store Qt reads (/etc/ssl/certs): the container is root and throwaway."""
        target = Path("/usr/local/share/ca-certificates/qt-dial-integ.crt")
        shutil.copy(self.pem, target)
        subprocess.run(["update-ca-certificates"], check=True, capture_output=True)

    def uninstall(self):
        Path("/usr/local/share/ca-certificates/qt-dial-integ.crt").unlink(missing_ok=True)
        subprocess.run(["update-ca-certificates", "--fresh"], check=False, capture_output=True)

    def context_for(self, host: str) -> ssl.SSLContext:
        with self._lock:
            if host in self._contexts:
                return self._contexts[host]
            x509, hashes, serialization, ec = self._x509, self._hashes, self._serialization, self._ec
            key = ec.generate_private_key(ec.SECP256R1())
            now = datetime.datetime.now(datetime.timezone.utc)
            cert = (
                x509.CertificateBuilder()
                .subject_name(x509.Name([x509.NameAttribute(self._oid.COMMON_NAME, host)]))
                .issuer_name(self.cert.subject).public_key(key.public_key())
                .serial_number(x509.random_serial_number())
                .not_valid_before(now - datetime.timedelta(days=1)).not_valid_after(now + datetime.timedelta(days=2))
                .add_extension(x509.SubjectAlternativeName([x509.DNSName(host)]), critical=False)
                .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
                .add_extension(x509.ExtendedKeyUsage([x509.oid.ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
                .sign(self.key, hashes.SHA256())
            )
            cert_path, key_path = self.directory / f"{host}.pem", self.directory / f"{host}.key"
            cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM)
                                  + self.cert.public_bytes(serialization.Encoding.PEM))
            key_path.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                                   serialization.NoEncryption()))
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.load_cert_chain(cert_path, key_path)
            self._contexts[host] = context
            return context


class DialNetwork:
    """The recording reverse proxy to the backend and the gate to everything else, on their own loop."""

    def __init__(self, backend_url: str, ca: SuiteCA, answers: dict, refused: list, answered: list):
        self.target = backend_url.rstrip("/")
        self.ca = ca
        self.answers = answers          # url prefix -> JSON body (dial_app.answer_external)
        self.refused = refused          # urls
        self.answered = answered        # (url, body)
        self.requests: list[tuple[str, str]] = []
        self._loop = asyncio.new_event_loop()
        self._started = threading.Event()
        self._error = None
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        self._started.wait(20)
        if self._error:
            raise self._error

    # ---- lifecycle
    def _run(self):
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._start())
        except Exception as error:  # noqa: BLE001
            self._error = error
            self._started.set()
            return
        self._started.set()
        self._loop.run_forever()

    async def _start(self):
        import aiohttp
        from aiohttp import web

        self._session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=None, sock_connect=10), auto_decompress=False
        )
        app = web.Application(client_max_size=1024 ** 3)
        app.router.add_route("*", "/{tail:.*}", self._forward)
        self._runner = web.AppRunner(app, access_log=None, handle_signals=False)
        await self._runner.setup()
        site = web.TCPSite(self._runner, "127.0.0.1", 0)
        await site.start()
        self.port = site._server.sockets[0].getsockname()[1]
        self.url = f"http://127.0.0.1:{self.port}"
        self._gate = await asyncio.start_server(self._gate_connection, "127.0.0.1", 0)
        self.gate_port = self._gate.sockets[0].getsockname()[1]
        self.gate_url = f"http://127.0.0.1:{self.gate_port}"

    def close(self):
        async def stop():
            self._gate.close()
            await self._runner.cleanup()
            await self._session.close()

        try:
            asyncio.run_coroutine_threadsafe(stop(), self._loop).result(10)
        except Exception:  # noqa: BLE001
            pass
        self._loop.call_soon_threadsafe(self._loop.stop)
        self._thread.join(5)

    # ---- the backend
    async def _forward(self, request):
        from aiohttp import WSMsgType, web

        url = self.target + request.raw_path
        if request.headers.get("Upgrade", "").lower() == "websocket":
            return await self._websocket(request, url, WSMsgType, web)
        if "/socket.io/" not in request.path:
            self.requests.append((request.method, url))
        headers = {k: v for k, v in request.headers.items() if k.lower() not in _HOP}
        body = await request.read()
        try:
            async with self._session.request(request.method, url, headers=headers, data=body or None,
                                             allow_redirects=False) as upstream:
                response = web.StreamResponse(status=upstream.status, reason=upstream.reason)
                for key, value in upstream.headers.items():
                    if key.lower() not in _HOP:
                        response.headers.add(key, value)
                await response.prepare(request)
                async for chunk in upstream.content.iter_any():
                    await response.write(chunk)
                await response.write_eof()
                return response
        except Exception as error:  # noqa: BLE001  (the backend is down: as a refused connection)
            return web.Response(status=502, text=f"proxy: {error}")

    async def _websocket(self, request, url, WSMsgType, web):
        server_side = web.WebSocketResponse(autoping=False, max_msg_size=0)
        await server_side.prepare(request)
        headers = {k: v for k, v in request.headers.items()
                   if k.lower() not in _HOP and not k.lower().startswith("sec-websocket")}
        try:
            async with self._session.ws_connect("ws" + url[4:], headers=headers, autoping=False,
                                                max_msg_size=0) as client_side:
                async def pump(source, sink):
                    async for message in source:
                        if message.type == WSMsgType.TEXT:
                            await sink.send_str(message.data)
                        elif message.type == WSMsgType.BINARY:
                            await sink.send_bytes(message.data)
                        elif message.type == WSMsgType.PING:
                            await sink.ping(message.data)
                        elif message.type == WSMsgType.PONG:
                            await sink.pong(message.data)
                        else:
                            break

                tasks = [asyncio.ensure_future(pump(server_side, client_side)),
                         asyncio.ensure_future(pump(client_side, server_side))]
                await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                for task in tasks:
                    task.cancel()
        except Exception:  # noqa: BLE001
            pass
        await server_side.close()
        return server_side

    # ---- everything else (the Dial's http_proxy)
    def _answer_for(self, url: str):
        for prefix, body in self.answers.items():
            if url.startswith(prefix):
                return body
        return None

    def _answers_host(self, host: str) -> bool:
        return any(urlsplit(prefix).hostname == host for prefix in self.answers)

    async def _gate_connection(self, reader, writer):
        try:
            head = await reader.readuntil(b"\r\n\r\n")
            method, target, _ = head.split(b"\r\n", 1)[0].decode("latin-1").split(" ", 2)
            if method == "CONNECT":
                host = target.rsplit(":", 1)[0]
                if not self._answers_host(host):
                    self.refused.append(f"https://{host}/")
                    writer.write(b"HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                    await writer.drain()
                    return
                writer.write(b"HTTP/1.1 200 Connection established\r\n\r\n")
                await writer.drain()
                await writer.start_tls(self.ca.context_for(host))
                while True:
                    head = await reader.readuntil(b"\r\n\r\n")
                    method, path, _ = head.split(b"\r\n", 1)[0].decode("latin-1").split(" ", 2)
                    await self._answer(f"https://{host}{path}", method, head, reader, writer)
            else:
                await self._answer(target, method, head, reader, writer)
        except (asyncio.IncompleteReadError, ConnectionError, ssl.SSLError, ValueError):
            pass
        finally:
            try:
                writer.close()
            except Exception:  # noqa: BLE001
                pass

    async def _answer(self, url, method, head, reader, writer):
        length = 0
        for line in head.decode("latin-1").split("\r\n")[1:]:
            if line.lower().startswith("content-length:"):
                length = int(line.split(":", 1)[1])
        body = (await reader.readexactly(length)).decode(errors="replace") if length else None
        answer = self._answer_for(url)
        if answer is None:
            self.refused.append(url)
            writer.write(b"HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            await writer.drain()
            raise ConnectionError("refused")
        if method != "OPTIONS":
            self.answered.append((url, body))
        payload = json.dumps(answer).encode()
        writer.write(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n"
                     + f"Content-Length: {len(payload)}\r\n\r\n".encode() + payload)
        await writer.drain()
