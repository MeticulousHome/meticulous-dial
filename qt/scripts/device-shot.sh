#!/bin/bash
# A screenshot of the Qt Dial running on a machine (deploy-dev.sh), composited over black (grabToImage
# keeps straight alpha), into qt/build/shots/NAME.png:
#   qt/scripts/device-shot.sh NAME [HOST] [TUNNEL_PORT]
# Needs the test port tunnelled to this host (ssh -N -L 9311:127.0.0.1:9310 root@HOST) and the
# qt-dial-run container (run-dev.sh start) for Python with websockets and PIL.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
name="$1"
host="${2:-10.10.0.130}"
port="${3:-9311}"
mkdir -p "$here/build/shots"
docker exec qt-dial-run python3 /repo/qt/tests/e2e/dialctl.py --port "$port" grab "/tmp/dial-shot.png" >/dev/null
scp -q "root@$host:/tmp/dial-shot.png" "$here/build/shots/$name.raw.png"
docker exec qt-dial-run python3 -c "
from PIL import Image
im = Image.open('/repo/qt/build/shots/$name.raw.png').convert('RGBA')
bg = Image.new('RGBA', im.size, (0, 0, 0, 255))
Image.alpha_composite(bg, im).convert('RGB').save('/repo/qt/build/shots/$name.png')
"
rm -f "$here/build/shots/$name.raw.png"
echo "$here/build/shots/$name.png"
