# Simulated shot end-to-end test

This E2E test runs the production Dial web interface in Chromium against the
real backend application and its recorded ESP serial emulator.

The journey:

1. starts the backend in isolated headless emulation mode;
2. saves a default profile through the backend API when needed;
3. opens Dial and waits for the profile home screen;
4. presses once to focus the profile, then holds the Space key, which uses the
   same press-and-hold gesture path as the physical dial;
5. verifies that Dial enters the live barometer while the backend replays a
   recorded espresso shot;
6. verifies that the backend persists a new history entry for the selected
   profile; and
7. verifies that Dial returns to the profile home screen without browser page
   errors.

This proves the main UI, REST and Socket.IO integration, profile selection,
shot start, live shot navigation and shot-completion loop. It does not prove
Tauri/Wayland packaging, physical dial input, sensor accuracy or actuator
safety. Those require packaged-image and hardware-in-the-loop suites.

The GitHub workflow runs on every Dial pull request, pushes to `nightly`, a
daily schedule and manual dispatch. While the backend headless-emulation PR is
under review, the workflow checks out its feature branch. Change that ref to
`nightly` immediately after the backend PR merges.

To run locally, first start a backend with `BACKEND=emulation` and
`HEADLESS_EMULATION=true` on port 18080, then run:

```bash
npm ci
npm run e2e:install
E2E_BACKEND_URL=http://127.0.0.1:18080 npm run e2e
```
