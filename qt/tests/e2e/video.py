"""A video of the Dial's screen during one test: ffmpeg grabs the Xvfb display the Dial draws on.

    rec = Recorder(":110", Path("videos/test.mp4")); rec.start(); ...; rec.stop()  # -> the path, or None

Used by the end-to-end tests (conftest.py, one video per test that drives the Dial) and the
meticulous-integration overlay (qt/tests/integration, one per journey). H.264 in MP4 (every browser plays
it), 480 x 480 at DIAL_VIDEO_FPS frames per second (60 by default, the rate the Dial animates at under
Xvfb), compressed for flat UI graphics (about 45 KB a second). The Dial draws itself turned -90 degrees, as
the machine's panel is mounted (--rotation); the video turns it back upright. Local only: ffmpeg reads the X
server's memory and writes a file; nothing goes over a network.
"""

import os
import shutil
import subprocess
import time
from pathlib import Path

FPS = int(os.environ.get("DIAL_VIDEO_FPS", "60"))


def enabled() -> bool:
    return os.environ.get("DIAL_VIDEO", "1") != "0" and shutil.which("ffmpeg") is not None


class Recorder:
    def __init__(self, display: str, path: Path, fps: int = FPS, size: str = "480x480", rotation: int = -90):
        self.display = display
        # ffmpeg transpose: 1 turns 90 degrees clockwise (undoes -90), 2 counter-clockwise (undoes 90). Each
        # frame is then timed by its number: x11grab stamps frames with the wall clock, which steps back now
        # and then under WSL2 (frames out of order); numbered frames keep the video's time moving forward.
        turn = {-90: ["transpose=1"], 90: ["transpose=2"]}.get(rotation, [])
        self.filters = ["-vf", ",".join(turn + [f"setpts=N/({fps}*TB)"])]
        self.path = Path(path)
        self.fps = fps
        self.size = size
        self.proc: subprocess.Popen | None = None
        self.started_at: float | None = None
        self.stopped_at: float | None = None

    def start(self) -> bool:
        """Starts grabbing; returns once ffmpeg has the first frame (or False if it could not start)."""
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.unlink(missing_ok=True)
        log = open(self.path.with_suffix(".ffmpeg.log"), "w")
        self.proc = subprocess.Popen(
            ["ffmpeg", "-hide_banner", "-loglevel", "warning", "-nostats",
             "-f", "x11grab", "-draw_mouse", "0", "-framerate", str(self.fps), "-video_size", self.size,
             "-i", f"{self.display}+0,0", *self.filters,
             "-c:v", "libx264", "-preset", "veryfast", "-tune", "animation", "-crf", "28",
             "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y", str(self.path)],
            stdin=subprocess.PIPE, stdout=log, stderr=subprocess.STDOUT, start_new_session=True,
        )
        log.close()
        self.started_at = time.time()
        # ffmpeg opens the display and writes the container header once it has grabbed: wait for it, so
        # the video begins with the test rather than half a second into it.
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            if self.proc.poll() is not None:
                self.proc = None
                return False
            if self.path.exists() and self.path.stat().st_size > 0:
                break
            time.sleep(0.05)
        self.started_at = time.time()
        return True

    def stop(self) -> Path | None:
        """Ends the video cleanly ('q' to ffmpeg, so the MP4 index is written); its path, or None."""
        if self.proc is None:
            return None
        self.stopped_at = time.time()
        try:
            self.proc.stdin.write(b"q")
            self.proc.stdin.close()
        except (BrokenPipeError, OSError):
            pass
        try:
            self.proc.wait(15)
        except subprocess.TimeoutExpired:
            self.proc.terminate()
            try:
                self.proc.wait(5)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        self.proc = None
        log = self.path.with_suffix(".ffmpeg.log")
        if log.exists() and not log.read_text(errors="replace").strip():
            log.unlink()
        return self.path if self.path.exists() and self.path.stat().st_size > 1000 else None
