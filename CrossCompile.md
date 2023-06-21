# Cross compilation

It is possible to build the app to target different platforms using the `--arch` flag.

## ARM64 (Raspberrypi4 & Variscite IMX8)

```bash
npm run make -- --arch=arm64
```

## ARMV7 (Variscite 6UL)

```bash
npm run make -- --arch=armv7l
```

## Testing the app

Running the make command, will create the output in the `out` folder, under `out/make` there are packages generated to install in Debian based distributions.

There are also folders generated under the `out` directory `meticulous-ui-linux-<ARCH>` for each architecture that the app is built. We can simply copy this folder to the target device and run the application. For example if we copy `meticulous-ui-linux-arm64` to `~/meticulous-ui-linux-arm64` in the target device this is how the application can be run

**If running on X11 (Debian)**

```bash
export DISPLAY=:0
./meticulous-ui --disable-gpu --ignore-gpu-blacklist

```

**If running on wayland (Custom Meticulous Distro)**

```bash
export XDG_RUNTIME_DIR=/run/user/0
export WAYLAND_DISPLAY=wayland-0

~/meticulous-ui-linux-arm64/meticulous-ui --no-sandbox --enable-features=UseOzonePlatform --ozone-platform=wayland
```
