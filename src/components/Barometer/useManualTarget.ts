import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clampTenths,
  computeTrail,
  pushSample,
  toTenths,
  TargetSample,
  Trail
} from './manualTarget';

/**
 * Owns the manual brew target shown on the barometer.
 *
 * The tick follows the machine's streamed setpoint and nothing else. Encoder
 * detents reach the ESP directly, and the setpoint it derives from them comes
 * back through the stream, so the dial always draws what the machine is
 * actually targeting rather than a local guess at it. The trail therefore
 * records the stream's own changes.
 */
export function useManualTarget(
  isManualBrew: boolean,
  streamedTarget?: number
) {
  const [tenths, setTenths] = useState(0);
  const [trail, setTrail] = useState<Trail | null>(null);

  const tenthsRef = useRef(0);
  const historyRef = useRef<TargetSample[]>([]);
  const frameRef = useRef<number | null>(null);

  const stopLoop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const startLoop = useCallback(() => {
    if (frameRef.current !== null) {
      return;
    }

    const step: FrameRequestCallback = () => {
      const next = computeTrail(historyRef.current, Date.now());
      setTrail(next);
      frameRef.current = next ? requestAnimationFrame(step) : null;
    };

    frameRef.current = requestAnimationFrame(step);
  }, []);

  // Seed on entering a manual brew, and drop everything on leaving one.
  useEffect(() => {
    stopLoop();
    historyRef.current = [];
    setTrail(null);

    const seeded = isManualBrew
      ? clampTenths(toTenths(streamedTarget ?? 0))
      : 0;
    tenthsRef.current = seeded;
    setTenths(seeded);
    // Deliberately keyed on isManualBrew only: the streamed target is read once
    // here and tracked by the stream effect below from then on.
  }, [isManualBrew, stopLoop]);

  // Follow the streamed setpoint.
  useEffect(() => {
    if (!isManualBrew || typeof streamedTarget !== 'number') {
      return;
    }

    const next = clampTenths(toTenths(streamedTarget));
    if (next === tenthsRef.current) {
      return;
    }

    tenthsRef.current = next;
    historyRef.current = pushSample(historyRef.current, next, Date.now());
    setTenths(next);
    startLoop();
  }, [isManualBrew, streamedTarget, startLoop]);

  useEffect(() => () => stopLoop(), [stopLoop]);

  return { tenths, trail };
}
