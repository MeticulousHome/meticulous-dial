import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

import { updateBrightness } from '../../../hooks/useDimScreen';
import type { IdleRuntimePolicy, IdleScreenDocument } from './types';
import { forEachLayer } from './validation';

const FALLBACK_RUNTIME: IdleRuntimePolicy = {
  brightness: {
    onEnter: 0.33,
    onExit: 1,
    cycleAfterMs: 10 * 60 * 1000,
    dimValue: 0.03,
    brightValue: 0.33,
    dimDurationMs: 55 * 1000,
    brightDurationMs: 5 * 1000
  },
  burnInProtection: {
    enabled: true,
    mode: 'rotate',
    durationMs: 60 * 60 * 1000,
    distance: 0.5
  }
};

export function useIdleClock(screen: IdleScreenDocument | null): Date {
  const [now, setNow] = useState(() => new Date());
  const needsAnimationFrame = useMemo(
    () => screenRequiresAnimationFrame(screen),
    [screen]
  );

  useEffect(() => {
    if (needsAnimationFrame) {
      let frame = 0;
      const tick = () => {
        setNow(new Date());
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }

    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [needsAnimationFrame]);

  return now;
}

export function useIdleBrightness(runtime: IdleRuntimePolicy | null): void {
  const policy = runtime ?? FALLBACK_RUNTIME;

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const brightness = policy.brightness;

    const set = (value: number) => {
      updateBrightness({ brightness: clampBrightness(value) });
    };

    const cycleDim = () => {
      if (
        cancelled ||
        brightness.dimValue == null ||
        brightness.brightValue == null
      )
        return;
      set(brightness.dimValue);
      timeout = setTimeout(() => {
        if (cancelled) return;
        set(brightness.brightValue ?? brightness.onEnter);
        timeout = setTimeout(cycleDim, brightness.brightDurationMs ?? 5000);
      }, brightness.dimDurationMs ?? 55000);
    };

    set(brightness.onEnter);
    if (brightness.cycleAfterMs) {
      timeout = setTimeout(cycleDim, brightness.cycleAfterMs);
    }

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      set(brightness.onExit);
    };
  }, [policy]);
}

export function burnInStyle(
  runtime: IdleRuntimePolicy | null,
  now: Date
): CSSProperties {
  const burnIn = (runtime ?? FALLBACK_RUNTIME).burnInProtection;
  if (!burnIn.enabled || burnIn.mode === 'none') return {};
  const phase = (now.getTime() % burnIn.durationMs) / burnIn.durationMs;
  if (burnIn.mode === 'translate') {
    const offset = Math.sin(phase * Math.PI * 2) * burnIn.distance;
    return { transform: `translate(${offset}px, ${-offset}px)` };
  }
  return {
    transform: `rotate(${Math.sin(phase * Math.PI * 2) * burnIn.distance}deg)`
  };
}

function screenRequiresAnimationFrame(
  screen: IdleScreenDocument | null
): boolean {
  if (!screen) return true;
  let requiresAnimationFrame = false;
  forEachLayer(screen.layers, (layer) => {
    if (layer.type === 'lottie') requiresAnimationFrame = true;
    if (layer.type === 'analogHand' && layer.smooth !== false)
      requiresAnimationFrame = true;
  });
  return requiresAnimationFrame;
}

function clampBrightness(value: number): number {
  return Math.min(1, Math.max(0.03, value));
}
