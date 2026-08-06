import { useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/react';
import { invoke } from '@tauri-apps/api/core';

import type { ScreenType } from '../components/store/features/screens/screens-slice';
import {
  SLOWDOWN_MONITOR_CONFIG,
  SlowdownEpisodeDetector,
  summarizeFrameWindow
} from '../performance/slowdownDetector';
import type { FrameWindowSummary } from '../performance/slowdownDetector';

interface DialResourceSnapshot {
  collectedAtUnixMs: number;
  collectionDurationMs: number;
  processScanDurationMs: number;
  memoryCurrentMb: number | null;
  cpuPercent: number | null;
  cpuCount: number | null;
  systemMemoryAvailableMb: number | null;
  systemLoad1m: number | null;
  topCpuProcesses: ProcessResourceSnapshot[];
  topMemoryProcesses: ProcessResourceSnapshot[];
}

interface ProcessResourceSnapshot {
  processName: string;
  executable: string | null;
  systemdUnit: string | null;
  cpuPercent: number | null;
  memoryMb: number | null;
}

interface SlowdownMonitorState {
  screen: ScreenType;
  serial?: string;
  isExtracting: boolean;
}

const isTauri = () => '__TAURI_INTERNALS__' in window;

const finiteResourceContext = (
  snapshot?: DialResourceSnapshot,
  now = Date.now()
): Record<string, number> => {
  if (!snapshot) {
    return {};
  }

  const context: Record<string, number> = {};
  const setFinite = (key: string, value: number | null | undefined) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      context[key] = Number(value.toFixed(1));
    }
  };

  setFinite('memory_current_mb', snapshot.memoryCurrentMb);
  setFinite('cpu_percent', snapshot.cpuPercent);
  setFinite('cpu_count', snapshot.cpuCount);
  setFinite('system_memory_available_mb', snapshot.systemMemoryAvailableMb);
  setFinite('system_load_1m', snapshot.systemLoad1m);
  setFinite('collection_duration_ms', snapshot.collectionDurationMs);
  setFinite('process_scan_duration_ms', snapshot.processScanDurationMs);
  setFinite('snapshot_age_ms', Math.max(0, now - snapshot.collectedAtUnixMs));
  return context;
};

const processRankingContext = (
  processes: ProcessResourceSnapshot[],
  metric: 'cpu' | 'memory'
): Record<string, string | number> => {
  const context: Record<string, string | number> = {};
  processes.forEach((process, index) => {
    const prefix = `process_${index + 1}`;
    context[`${prefix}_name`] = process.processName;
    if (process.executable) {
      context[`${prefix}_executable`] = process.executable;
    }
    if (process.systemdUnit) {
      context[`${prefix}_systemd_unit`] = process.systemdUnit;
    }
    if (
      metric === 'cpu' &&
      typeof process.cpuPercent === 'number' &&
      Number.isFinite(process.cpuPercent)
    ) {
      context[`${prefix}_cpu_percent`] = Number(process.cpuPercent.toFixed(1));
    }
    if (
      typeof process.memoryMb === 'number' &&
      Number.isFinite(process.memoryMb)
    ) {
      context[`${prefix}_memory_mb`] = Number(process.memoryMb.toFixed(1));
    }
  });
  return context;
};

const captureSlowdown = (
  summary: FrameWindowSummary,
  state: SlowdownMonitorState,
  resources?: DialResourceSnapshot
) => {
  if (!Sentry.isInitialized()) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setFingerprint(['dial-ui-sustained-slowdown']);
    scope.setLevel('warning');
    scope.setTag('performance-detector-version', '3');
    scope.setTag('screen', state.screen);
    scope.setTag('is-extracting', String(state.isExtracting));

    if (state.serial) {
      scope.setTag('machine-serial', state.serial);
    }

    scope.setContext('dial_performance', {
      window_ms: Math.round(summary.windowMs),
      observed_fps: Number(summary.observedFps.toFixed(1)),
      frame_interval_p50_ms: Number(summary.frameIntervalP50Ms.toFixed(1)),
      frame_interval_p95_ms: Number(summary.frameIntervalP95Ms.toFixed(1)),
      frame_interval_p99_ms: Number(summary.frameIntervalP99Ms.toFixed(1)),
      frames_over_50_ms: summary.framesOver50Ms,
      frames_over_100_ms: summary.framesOver100Ms,
      frames_over_250_ms: summary.framesOver250Ms,
      frames_over_1000_ms: summary.framesOver1000Ms,
      max_frame_gap_ms: Number(summary.maxFrameGapMs.toFixed(1))
    });

    const resourceContext = finiteResourceContext(resources);
    if (Object.keys(resourceContext).length > 0) {
      scope.setContext('dial_resources', resourceContext);
    }

    const topCpuContext = processRankingContext(
      resources?.topCpuProcesses ?? [],
      'cpu'
    );
    if (Object.keys(topCpuContext).length > 0) {
      scope.setContext('top_processes_by_cpu', topCpuContext);
    }

    const topMemoryContext = processRankingContext(
      resources?.topMemoryProcesses ?? [],
      'memory'
    );
    if (Object.keys(topMemoryContext).length > 0) {
      scope.setContext('top_processes_by_memory', topMemoryContext);
    }

    Sentry.captureMessage('Dial UI sustained slowdown');
  });
};

export const useDialSlowdownMonitor = ({
  screen,
  serial,
  isExtracting
}: SlowdownMonitorState) => {
  const stateRef = useRef<SlowdownMonitorState>({
    screen,
    serial,
    isExtracting
  });
  const resourceSnapshotRef = useRef<DialResourceSnapshot | undefined>(
    undefined
  );
  const debugLoggingEnabledRef = useRef(false);
  const [monitorEnabled, setMonitorEnabled] = useState(false);

  stateRef.current = { screen, serial, isExtracting };

  useEffect(() => {
    if (!import.meta.env.PROD || !isTauri()) {
      return;
    }

    let disposed = false;
    invoke<boolean>('dial_performance_monitor_enabled')
      .then((enabled) => {
        if (!disposed) {
          setMonitorEnabled(enabled);
        }
      })
      .catch((monitorConfigError) => {
        console.warn(
          'Could not read Dial performance monitor configuration',
          monitorConfigError
        );
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!monitorEnabled) {
      return;
    }

    let disposed = false;
    let inFlight = false;
    let nextUpdate: number | undefined;

    const updateResourceSnapshot = async () => {
      if (disposed || inFlight) {
        return;
      }

      inFlight = true;
      try {
        const snapshot = await invoke<DialResourceSnapshot>(
          'get_dial_resource_snapshot'
        );
        if (!disposed) {
          resourceSnapshotRef.current = snapshot;
        }
      } catch (snapshotError) {
        if (!disposed) {
          console.warn(
            'Could not collect Dial resource snapshot',
            snapshotError
          );
        }
      } finally {
        inFlight = false;
        if (!disposed) {
          nextUpdate = window.setTimeout(
            updateResourceSnapshot,
            SLOWDOWN_MONITOR_CONFIG.windowMs
          );
        }
      }
    };

    updateResourceSnapshot();
    invoke<boolean>('dial_performance_debug_enabled')
      .then((enabled) => {
        debugLoggingEnabledRef.current = enabled;
      })
      .catch((debugConfigError) => {
        console.warn(
          'Could not read Dial performance debug configuration',
          debugConfigError
        );
      });
    return () => {
      disposed = true;
      if (nextUpdate !== undefined) {
        window.clearTimeout(nextUpdate);
      }
    };
  }, [monitorEnabled]);

  useEffect(() => {
    if (!monitorEnabled) {
      return;
    }

    const detector = new SlowdownEpisodeDetector();
    const monitorStartedAt = performance.now();
    let windowStartedAt = monitorStartedAt;
    let previousFrameAt: number | undefined;
    let frameIntervals: number[] = [];
    let animationFrameId: number;

    const resetWindow = (now: number) => {
      windowStartedAt = now;
      previousFrameAt = now;
      frameIntervals = [];
    };

    const observeFrame = (now: number) => {
      if (document.visibilityState !== 'visible') {
        resetWindow(now);
        animationFrameId = requestAnimationFrame(observeFrame);
        return;
      }

      if (previousFrameAt !== undefined) {
        frameIntervals.push(now - previousFrameAt);
      }
      previousFrameAt = now;

      const windowDuration = now - windowStartedAt;
      if (windowDuration >= SLOWDOWN_MONITOR_CONFIG.windowMs) {
        const summary = summarizeFrameWindow(frameIntervals, windowDuration);
        const warmupComplete =
          now - monitorStartedAt >= SLOWDOWN_MONITOR_CONFIG.warmupMs;

        if (warmupComplete && debugLoggingEnabledRef.current) {
          console.info(
            `Dial performance sample ${JSON.stringify({
              screen: stateRef.current.screen,
              isExtracting: stateRef.current.isExtracting,
              observedFps: Number(summary.observedFps.toFixed(1)),
              frameIntervalP95Ms: Number(summary.frameIntervalP95Ms.toFixed(1)),
              maxFrameGapMs: Number(summary.maxFrameGapMs.toFixed(1)),
              degraded: summary.degraded,
              resources: finiteResourceContext(resourceSnapshotRef.current)
            })}`
          );
        }

        if (warmupComplete && detector.evaluate(summary, Date.now())) {
          captureSlowdown(
            summary,
            stateRef.current,
            resourceSnapshotRef.current
          );
        }
        resetWindow(now);
      }

      animationFrameId = requestAnimationFrame(observeFrame);
    };

    animationFrameId = requestAnimationFrame(observeFrame);
    return () => cancelAnimationFrame(animationFrameId);
  }, [monitorEnabled]);
};
