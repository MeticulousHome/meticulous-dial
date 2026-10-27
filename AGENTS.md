# Working in meticulous-dial

The UI on the Meticulous espresso machine's round display, driven by the
machine's rotary encoder, its context button and its tare button. It is a Qt
Quick 6.4 app (Debian bookworm) that draws straight on DRM/KMS (eglfs, no
Weston): a small C++ host in `qt/src` and the UI in QML and JavaScript in
`qt/qml`. It talks to the machine's backend (REST and Socket.IO) and ships as
the arm64 package `meticulous-dial` that meticulous-machine builds and installs
in the image. How to build, run and deploy it: `docs/qt-migration/README.md`.
Pull requests target `beta`; fixes reach `stable` and `nightly` through the
backport flow.

Every pull request runs the gates below. This file says what each one protects,
when a test is worth adding and where it goes. How these gates fit the checks
across repositories, up to the image, is in meticulous-machine's
[`docs/testing/validation-architecture.md`](https://github.com/MeticulousHome/meticulous-machine/blob/beta/docs/testing/validation-architecture.md).
In short: this repository tests itself, checks that everything it uses on the
backend is in the backend's published contract, and its journeys run against
the real backend and the real firmware of the same branch on every pull request
(beta with beta, nightly with nightly, stable with stable).

## The gates

| Check              | Protects                                                                                                                                                                                       | Reproduce locally (Docker, from Linux or WSL)                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `build-and-test`   | the amd64 and arm64 builds; every QML file parses and every route opens (QML smoke); the C++ unit tests (`qt/tests/unit`); the JavaScript unit tests (`qt/tests/js`); the package the image installs | `bash qt/scripts/build.sh && bash qt/scripts/qml-smoke.sh && bash qt/scripts/js-tests.sh && bash qt/scripts/package-deb.sh`; the C++ tests: the `C++ unit tests` step of `.github/workflows/continuous-integration.yml` |
| `backend-contract` | every route, Socket.IO event, status key and setting the Dial uses exists in the backend's contract (`meticulous-backend tests/contracts/`) of the paired branch                            | `node scripts/check-backend-contract.mjs --backend <meticulous-backend checkout>`                                 |
| `integration/e2e`  | the journeys: the Dial, the real backend and the firmware simulator together, driven through the encoder and buttons (first boot, home, device info, espresso and its interactions, profiles, brew settings, maintenance) | runs in meticulous-integration (private); the status links to the run. Locally: `qt/tests/integration/run.sh` (`docs/qt-migration/TESTING.md`) |

Not in CI, run them before a change to a screen's behaviour: the end-to-end
tests, `bash qt/scripts/e2e.sh` (pytest through the Dial's test port, against
meticulous-backend in emulation; `docs/qt-migration/TESTING.md`).

Never weaken a gate to get green: no skipped test, no widened assert, no new
entry in `KNOWN_GAPS` of the contract check without saying why in the PR.

## Tests: when to add one

A new test answers three questions, in its docstring or its file's header, and
in the PR description:

1. **Which regression would a user at the machine see without it?** Name the
   behaviour ("a double push during extraction ends the shot and keeps it"),
   not the code it runs.
2. **Where does its expected value come from?** A constant or branch in the
   Dial, named in the assertion; the backend's contract; or the firmware's
   behaviour, in a journey. A value picked because it makes the test pass is
   not a source.
3. **Which bug does it catch that the suite misses today?** Plant it (or revert
   your change): if your test fails and the suite stays green, it earns its place.

Where it goes:

| What you test                                                            | Where                                                                                                                       |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Pure logic: geometry, detectors, selection rules, profile documents      | a QML JavaScript library under `qt/qml/Dial`, tested in `qt/tests/js/<name>.test.mts` with its entry in `qt/tests/js/map.json` |
| The C++ host: the Community uploader, Sentry, native helpers             | a Qt Test in `qt/tests/unit`                                                                                                |
| A screen's gestures and rendering against an emulated backend            | a pytest in `qt/tests/e2e` through the test port                                                                            |
| A flow a user runs at the machine, against the real backend and firmware | a journey in meticulous-integration `tests/test_dial_*.py`, declared in meticulous-machine's journey catalog                |

Prefer the lowest level that catches the bug: a journey takes minutes, a
module test milliseconds. A journey that finds a bug sends a test down to the
repository that fixes it.

## Changing what the Dial uses on the backend

| You change                                                                         | Then                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A REST call, a Socket.IO event, a status key or a setting the Dial reads or writes | `backend-contract` fails until the backend publishes it. When the backend changes too, use a branch with the same name in both repositories: CI pairs them, and the journeys run against that backend branch. |
| Something the backend stopped sending                                              | Remove the Dial's use of it, or add it to `KNOWN_GAPS` in `scripts/check-backend-contract.mjs` with the reason; the check fails when the gap closes so the list only shrinks.                                 |
| A gesture, a screen or a menu label a journey uses                                 | The journey in meticulous-integration fails with a screenshot, a video and the Dial's log; update it in the same-name branch there.                                                                          |

Keep the Dial compatible with the previous backend for one step: after an
update or a rollback the image may briefly run it with the other version.

## Machine and display facts tests rely on

- 480×480 round display, rotated -90° on the machine (`--rotation`).
- Gestures: right (clockwise) moves down a menu, left up; on the home carousel
  left moves to the next card. A push is pressDown, pressUp, then click;
  menus act on pressDown, the setup screens (manual mode, Free Pour) on click.
- The context button opens and closes the quick settings.
- For development the keyboard maps to the same gestures: the arrow keys turn,
  space pushes, Enter is the context button.
- Tests never reach real services: the Dial turns Sentry, the ticket service and
  Community on only with `DIAL_EXTERNAL_SERVICES=1`, which only the machine's
  launcher sets.
