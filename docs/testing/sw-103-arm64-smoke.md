# SW-103 ARM64 build and physical smoke plan

Status: proposed physical verification; no machine was reserved, accessed or
modified for these results. Browser and local transport checks do not certify
the installed Dial, encoder, backend, firmware or actuators. Deployment and
physical interaction require the coordinator's exclusive reservation of the
dedicated lab machine. Merge still requires Alú/Kerans approval.

## Build candidate

Use a clean Linux checkout of the PR head and record its full SHA. The reviewed
implementation snapshot `7c3803f` and publication commit `402877d` have identical
trees; subsequent evidence-only commits do not change the product source.
Use the repository's `Dockerfile.arm64-cross` and locked npm dependencies.
The current Dockerfile installs `tauri-cli ~2.11 --locked`; Debian and the patch
version resolution can still vary, so record the builder image digest and tool
versions. Keep Linux `node_modules` separate from host dependencies.

From the clean Linux checkout, the Dial skill's `build-arm64-deb.sh` wrapper
builds the cross image, installs dependencies with Node 22, creates the package
and validates a newly produced artifact. Equivalent repository steps are:

```bash
git rev-parse HEAD
docker build -f Dockerfile.arm64-cross -t sw103-dial-arm64-builder .
docker run --rm -v "$PWD:/app" -w /app node:22-bookworm npm ci
docker run --rm -v "$PWD:/app" sw103-dial-arm64-builder
```

Run the toolchain image build before installing dependencies to keep its context
small. The Dockerfile's command can mask Cargo failure with a later successful
`chown`: a zero exit status alone is insufficient. Require a new non-empty
`src-tauri/target/aarch64-unknown-linux-gnu/release/bundle/deb/meticulous-dial_0.1.0_arm64.deb`
created after build start. Save SHA-256, `dpkg-deb -f` metadata and `ar t` output;
extract to a temporary directory and verify `/usr/bin/meticulous-dial` is an
AArch64 ELF. Expected package architecture is `arm64`, with GTK 3 and WebKit
4.1 dependencies. No ARM64 artifact is claimed by the component test results.

## Establish a comparable baseline

Once the coordinator confirms exclusive access and authorizes the test window:

1. Record machine identity, image/backend/firmware versions, installed Dial
   version, binary checksum and service state. Keep credentials and private
   logs out of the PR. Verify the machine is idle and the planned operator is
   present before any physical action.
2. Back up the installed package or binary under persistent user storage and
   prepare the matching restore procedure before replacing Dial. Preserve
   profiles, calibration and user settings.
3. Reproduce on the existing Dial: manual Push to brew, fullscreen opened by
   tare hold, single encoder press. Record display/encoder timing and whether
   the same press issues continue or starts the shot. Stop safely under the
   operator's agreed procedure; do not infer command execution only from UI.
4. Install only the validated candidate package during the reserved window,
   restart Dial and verify both service health and the actual display. Keep
   backend/firmware and the test profile/settings the same for comparison.

## Minimum acceptance evidence

Record a short comparable before/after video and a redacted action/event trace,
with candidate SHA and installed package checksum:

- **Single press:** fullscreen remains modal until the recognized click, then
  closes; zero continue/shot start from that gesture. A separate following
  complete press issues one continue and starts the intended shot.
- **Long press:** fullscreen remains while held and closes after release; the
  closing release does not trigger the underlying screen. Verify this also
  over Home or another screen with a release handler.
- **Double press and tare:** double closes the overlay without a UI continue;
  tare, cancelled tare hold and the small scale retain their prior behavior.
  Backend's independent double-encoder abort remains outside this UI fix.
- **Interrupted input:** if the operator/coordinator can safely control a Dial
  connection gap while idle, interrupt an encoder sequence, reconnect and
  verify fullscreen remains visible, the next valid gesture only closes it,
  and the subsequent gesture works. Otherwise retain this as an explicit
  physical validation gap; do not change Wi-Fi or credentials to induce it.

Capture the closing gesture and following gesture in one recording. A running
service or screenshot alone is insufficient. Record any raw-edge bounce or
overlap separately; the event protocol has no universal gesture identity and
this change does not add one.

## Rollback and completion

If the candidate fails, stop Dial, restore the verified previous package/binary,
restart it and recheck service and display. Record the restored checksum and
release the lab reservation. The coordinator reviews evidence before reporting
field resolution; successful CI or a draft PR is not that evidence.
