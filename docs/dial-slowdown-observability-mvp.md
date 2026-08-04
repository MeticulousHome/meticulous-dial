# Dial slowdown observability MVP

## Objective

Detect sustained Dial UI slowdowns in customer machines and send a small,
searchable diagnostic event to Sentry. The event is evidence that a slowdown
episode occurred; it does not classify or claim a root cause.

## Scope

The MVP continuously measures UI-thread frame cadence with
`requestAnimationFrame`. Every 10 seconds it calculates:

- observed callback rate;
- p50, p95, and p99 frame intervals;
- counts of intervals over 50, 100, 250, and 1,000 ms;
- the largest observed frame gap.

When a sustained episode is detected, the Dial emits one warning event with a
native resource snapshot:

- Dial systemd-cgroup CPU percentage;
- Dial systemd-cgroup memory usage;
- system available memory;
- system one-minute load average.
- top three processes by CPU over the measurement window;
- top three processes by resident memory at the end of the window.

Each ranked process includes its kernel process name, executable basename,
systemd unit when available, CPU percentage, and resident memory. The executable
and unit disambiguate generic or truncated names such as `Main`; command-line
arguments, executable paths, PIDs, users, and environment variables are not
collected.

The event also includes the current screen, extraction state, Dial/image
versions already configured by the application, and the machine serial number.
The serial number is intentionally searchable as the `machine-serial` tag and
must be covered by the Meticulous privacy policy and Sentry retention/access
controls.

## Initial detector configuration

These are calibration defaults, not a product definition of a slow machine:

| Setting            |                                      Initial value |
| ------------------ | -------------------------------------------------: |
| Measurement window |                                         10 seconds |
| Startup warm-up    |                                         30 seconds |
| Degraded window    | p95 frame interval >= 45 ms or any gap >= 1,000 ms |
| Episode trigger    |                     3 consecutive degraded windows |
| Recovery           |                      3 consecutive healthy windows |
| Event cooldown     |                                         30 minutes |

`requestAnimationFrame` measures callback cadence on the WebKit UI thread. It
is useful for detecting jank and long UI-thread stalls, but it is not a direct
measurement of compositor/display FPS.

## Sentry event contract

All episodes use the fixed fingerprint `dial-ui-sustained-slowdown` and message
`Dial UI sustained slowdown`. Filterable tags are limited to:

- `machine-serial`;
- `screen`;
- `is-extracting`;
- `performance-detector-version`;
- existing Dial version, image version, and image channel tags.

Numeric measurements are stored in the `dial_performance` and
`dial_resources` contexts rather than high-cardinality tags. The event does not
include profiles, settings, SSIDs, logs, URLs, user-entered values, or journal
content. The existing automatic-event sanitizer remains the final processing
step before transmission.

The default Sentry `CultureContext` integration is disabled because locale,
calendar, and timezone do not help diagnose Dial slowdowns.

Detector contract version `2` adds the two ranked-process contexts and removes
the default culture context.

## Noise and failure controls

- Startup and hidden-window samples are discarded.
- Only one event is emitted per episode.
- An episode must recover before another event can be emitted.
- The cooldown limits repeated events if the detector flaps.
- Failure to read native resource data does not affect the UI and does not
  prevent frame measurement.
- The monitor does not change customer-facing behavior or attempt recovery.
- Healthy-window logging is disabled by default. Setting the service environment
  variable `DIAL_PERFORMANCE_DEBUG=1` logs one aggregate sample per 10-second
  window for controlled local calibration without sending healthy samples to
  Sentry.

## Validation approach

The detector and event contract should be validated in layers:

1. Run the frame-window and episode-state unit tests.
2. Build the frontend and ARM64 Debian package, then verify the package
   architecture and embedded executable.
3. On controlled test hardware, record a healthy idle baseline before applying
   any artificial load.
4. Apply bounded CPU pressure outside the Dial cgroup and increase it gradually.
   Artificial-load units must discard stdout and stderr, have an automatic
   runtime limit, and be stopped immediately if safety-relevant services become
   unhealthy.
5. Confirm that sustained degradation emits one event containing the expected
   frame, resource, process-ranking, version, and screen fields.
6. Confirm that generic process names are disambiguated by executable basename
   and systemd unit, and that the Culture context is absent.
7. Remove all artificial load, confirm recovery and detector re-arming, and
   verify that Dial and its dependencies remain healthy.

Calibration evidence, machine identifiers, internal event links, build hashes,
and deployment-specific rollback details belong in access-controlled engineering
records rather than this repository.

## Explicitly deferred

- physical-input-to-next-paint latency;
- Socket.IO/backend response latency;
- Sentry Browser Tracing and transaction sampling;
- automatic root-cause classification or customer-facing remediation;
- thresholds intended for a broad stable rollout.
