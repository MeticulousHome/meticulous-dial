import { MutableRefObject, useCallback, useRef, useState } from 'react';

type SyncedStateUpdate<T> = T | ((current: T) => T);

// Encoder steps can arrive faster than React re-renders. This state is also
// kept in a ref that is updated immediately, so gesture handlers can read the
// latest value and every step builds on the previous one instead of on the
// last rendered value.
export function useSyncedState<T>(
  initialValue: T | (() => T)
): [T, (update: SyncedStateUpdate<T>) => void, MutableRefObject<T>] {
  const [value, setValue] = useState<T>(initialValue);
  const valueRef = useRef<T>(value);

  const setSyncedValue = useCallback((update: SyncedStateUpdate<T>) => {
    valueRef.current =
      typeof update === 'function'
        ? (update as (current: T) => T)(valueRef.current)
        : update;
    setValue(valueRef.current);
  }, []);

  return [value, setSyncedValue, valueRef];
}
