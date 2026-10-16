import { invoke } from '@tauri-apps/api/core';

export interface LocalTimeSample {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

export function getBrowserLocalTime(): LocalTimeSample {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds(),
    millisecond: now.getMilliseconds()
  };
}

export function readLocalTime(): LocalTimeSample | Promise<LocalTimeSample> {
  return '__TAURI_INTERNALS__' in window
    ? invoke<LocalTimeSample>('get_os_local_time')
    : getBrowserLocalTime();
}

export interface TimeSourceOptions {
  readTime?: () => LocalTimeSample | Promise<LocalTimeSample>;
  onError: (error: unknown) => void;
  now?: () => number;
  setTimer?: (callback: () => void, delay: number) => number;
  clearTimer?: (id: number) => void;
}

export function subscribeLocalTime({
  onTime,
  readTime = readLocalTime,
  onError,
  now = () => performance.now(),
  setTimer = (callback, delay) => window.setTimeout(callback, delay),
  clearTimer = (id) => window.clearTimeout(id)
}: TimeSourceOptions & {
  onTime: (sample: LocalTimeSample, sampledAt: number) => void;
}): () => void {
  let active = true;
  let timerId: number | undefined;
  let reportedError = false;

  const sync = async () => {
    const requestedAt = now();
    try {
      const sample = await readTime();
      if (!active) return;
      // Estimate the native sampling instant at the midpoint of the IPC trip.
      onTime(sample, (requestedAt + now()) / 2);
      reportedError = false;
    } catch (error) {
      // Keep the last native sample during a transient failure, without using
      // the embedded browser's potentially stale timezone as a fallback.
      if (active && !reportedError) {
        reportedError = true;
        onError(error);
      }
    } finally {
      // Schedule after completion so slow requests cannot overlap or arrive
      // out of order. An initial failure follows the same recovery path.
      if (active) timerId = setTimer(sync, 1000);
    }
  };

  void sync();
  return () => {
    active = false;
    if (timerId !== undefined) clearTimer(timerId);
  };
}
