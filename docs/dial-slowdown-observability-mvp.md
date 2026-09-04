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
- the largest observed frame gap;
- the largest delay of a 250 ms UI-thread timer heartbeat.

The timer heartbeat distinguishes a compositor or display-related pause in rAF
delivery from a blocked UI thread. A five-second rAF gap can report immediately
only when the timer heartbeat is also at least one second late. Sustained
degradation still uses three degraded windows and does not require this
immediate-trigger corroboration.

When an episode is detected, the Dial emits a warning event with a native
resource snapshot:

- Dial systemd-cgroup CPU percentage;
- Dial systemd-cgroup memory usage;
- system available memory;
- system one-minute load average and available CPU count;
- top three processes by CPU over the measurement window;
- top three processes by resident memory at the end of the window.

The resource context also records snapshot age and native collection duration,
so an event captured after a UI-thread stall does not present stale resource
data without qualification. Native collection runs off the UI thread, and each
`systemctl` call is bounded by a two-second timeout. Its timeout helper is
deliberately limited to the small, fixed output of the two requested scalar
properties; it is not a general helper for commands with streaming or
unbounded output.

Each ranked process includes its kernel process name, executable basename,
systemd unit when available, CPU percentage, and resident memory when available.
The executable and unit disambiguate generic or truncated names such as `Main`;
command-line arguments, executable paths, PIDs, users, and environment variables
are not collected.

Resident memory is optional because kernel threads do not expose `VmRSS`; those
threads can still appear in the CPU ranking. `MemoryCurrent` is the Dial
systemd cgroup's total current memory and can include page cache, so it must not
be interpreted as process RSS.

Interval CPU usage requires two samples for the same PID and process start time.
A process first observed in the current poll therefore becomes eligible for the
CPU ranking on the next poll. The MVP does not substitute a since-start average,
because that value is not directly comparable to the interval percentages used
for the rest of the ranking. The aggregate timestamp for each `/proc` walk is
the midpoint between the start and end of the walk, reducing systematic timing
bias when the scan itself slows down.

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
| Timer heartbeat    |                                             250 ms |
| Immediate trigger  |    rAF gap >= 5,000 ms and timer delay >= 1,000 ms |
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
- `slowdown-report-kind` (`immediate`, `sustained`, or `heartbeat`);
- existing Dial version, image version, and image channel tags.

Numeric measurements are stored in the `dial_performance` and
`dial_resources` contexts rather than high-cardinality tags. The event does not
include profiles, settings, SSIDs, logs, URLs, user-entered values, or journal
content. The existing automatic-event sanitizer remains the final processing
step before transmission.

The default Sentry `CultureContext` integration is disabled because locale,
calendar, and timezone do not help diagnose Dial slowdowns.

Detector contract version `4` requires timer corroboration for an immediate
stall, adds low-frequency persistent-episode heartbeats and
`episode_window_count`, and names the `available_parallelism` value
`available_cpu_count` end to end.

## Noise and failure controls

- Startup and hidden-window samples are discarded.
- A sustained episode emits its first event after three degraded windows and a
  heartbeat every 30 minutes while it remains degraded.
- `episode_window_count` shows how many degraded windows have accumulated in
  the active episode without adding user data or another identifier.
- An immediate report has a separate cooldown and does not consume the first
  sustained report if degradation continues.
- Recovery requires three healthy windows. Cooldowns limit both persistent
  heartbeats and repeated immediate blips.
- Failure to read native resource data does not affect the UI and does not
  prevent frame measurement.
- Native resource polls do not overlap, and CPU percentages require at least a
  one-second interval between valid samples.
- The monitor does not change customer-facing behavior or attempt recovery.
- Setting the service environment variable `DIAL_PERFORMANCE_DISABLE=1`
  disables both frame monitoring and native polling after a service restart,
  providing a release-independent kill switch.
- If the frontend cannot invoke the kill-switch command, monitoring fails open.
  This is deliberate: the native command returns disabled when the environment
  flag is present, while an IPC/configuration failure must not silently remove
  the diagnostic coverage the MVP exists to provide.
- Healthy-window logging is disabled by default. Setting the service environment
  variable `DIAL_PERFORMANCE_DEBUG=1` logs one aggregate sample per 10-second
  window for controlled local calibration without sending healthy samples to
  Sentry.

## Validation approach

The detector and event contract should be validated in layers:

1. Run the frame-window, timer-corroboration, configuration-fallback, and
   episode-state unit tests.
2. Build the frontend and ARM64 Debian package, then verify the package
   architecture and embedded executable.
3. On controlled test hardware, record a healthy idle baseline before applying
   any artificial load. Include a prolonged idle run to verify that the active
   Weston configuration continues delivering frame callbacks.
4. Apply bounded CPU pressure outside the Dial cgroup and increase it gradually.
   Artificial-load units must discard stdout and stderr, have an automatic
   runtime limit, and be stopped immediately if safety-relevant services become
   unhealthy.
5. Confirm that sustained degradation emits an event containing the expected
   frame, timer, episode count, resource, process-ranking, version, and screen
   fields, and that a persistent episode emits a cooldown heartbeat.
6. Confirm that `collection_duration_ms` stays acceptably below the 10-second
   polling interval on target hardware, both idle and under pressure.
7. Confirm that generic process names are disambiguated by executable basename
   and systemd unit, and that the Culture context is absent.
8. Remove all artificial load, confirm recovery and detector re-arming, and
   verify that Dial and its dependencies remain healthy.

Calibration evidence, machine identifiers, internal event links, build hashes,
and deployment-specific rollback details belong in access-controlled engineering
records rather than this repository.

## Explicitly deferred

- physical-input-to-next-paint latency;
- Socket.IO/backend response latency;
- Sentry Browser Tracing and transaction sampling;
- automatic root-cause classification or customer-facing remediation;
- a remotely managed fleet rollout control beyond the service-level kill
  switch.

The thresholds above remain calibration defaults. Targeting `stable` does not
make them a product definition of a slow machine; release decisions still need
idle baselines from multiple machines and a staged operational rollout.
