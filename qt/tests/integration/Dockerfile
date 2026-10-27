# The integration stack (meticulous-integration's ci/local.sh: ubuntu:24.04, the backend's machine
# group, uv) plus what the Qt Dial needs at run time: Ubuntu 24.04 ships Qt 6.4.2, the Qt the
# amd64 binary is built against on bookworm, so its runtime packages run that binary as is.
# Built by qt/tests/integration/run.sh (image qt-dial-integ:24.04).
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
# ci/setup-host.sh's packages (PyGObject, pycairo, pyparted, the D-Bus system bus, zstd), without
# PlatformIO and Node: fika-sil is prebuilt and the Dial is the Qt binary.
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential pkg-config git curl ca-certificates python3 python3-venv openssl \
      libcairo2-dev libgirepository1.0-dev libparted-dev libsystemd-dev libglib2.0-dev \
      libffi-dev gir1.2-glib-2.0 dbus zstd \
    && rm -rf /var/lib/apt/lists/*
# The Qt Dial: Qt 6.4.2 Quick, WebSockets, Shapes, Lottie, SVG, the xcb platform, rlottie, qrcodegen,
# Xvfb with Mesa's llvmpipe (shaders work), and ffmpeg to record each journey from that screen.
RUN apt-get update && apt-get install -y --no-install-recommends \
      qml6-module-qtquick qml6-module-qtquick-window qml6-module-qtquick-shapes qml6-module-qtquick-layouts \
      qml6-module-qtqml qml6-module-qtqml-models qml6-module-qtqml-workerscript qml6-module-qtwebsockets \
      qml6-module-qt-labs-lottieqt qml6-module-qt-labs-settings libqt6svg6 qt6-qpa-plugins \
      librlottie0-1 libqrcodegencpp1 \
      xvfb xauth libgl1-mesa-dri libglx-mesa0 libegl-mesa0 fonts-dejavu-core ffmpeg \
    && rm -rf /var/lib/apt/lists/*
RUN curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh >/dev/null
