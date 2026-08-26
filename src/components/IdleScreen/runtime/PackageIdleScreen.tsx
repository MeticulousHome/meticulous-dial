import { useEffect, useRef, useState } from 'react';

import { AnalogClock } from '../AnalogClock';
import {
  disposeIdleScreenPackage,
  loadIdleScreenPackage
} from './packageApi';
import { IdleRenderer } from './IdleRenderer';
import { validateIdleScreenDefinition } from './validation';
import type {
  IdlePackageId,
  IdleRuntimePolicy,
  IdleScreenDefinition
} from './types';

const loggedFailures = new Set<string>();

type RuntimeSetter = (runtime: IdleRuntimePolicy | null) => void;

export function PackageIdleScreen({
  selectedId,
  now,
  onRuntime
}: {
  selectedId: IdlePackageId;
  now: Date;
  onRuntime: RuntimeSetter;
}): JSX.Element {
  const sessionPackageId = useRef(selectedId);
  const [definition, setDefinition] = useState<IdleScreenDefinition | null>(
    null
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loadedDefinition: IdleScreenDefinition | null = null;
    const load = async () => {
      try {
        const loaded = await loadIdleScreenPackage(sessionPackageId.current);
        loadedDefinition = loaded;
        const screen = validateIdleScreenDefinition(loaded);
        if (cancelled) return;
        setDefinition({ ...loaded, screen });
        onRuntime(screen.runtime);
      } catch (error) {
        if (cancelled) return;
        logPackageFailure(sessionPackageId.current, error);
        setFailed(true);
        onRuntime(null);
      }
    };
    load();
    return () => {
      cancelled = true;
      if (loadedDefinition) disposeIdleScreenPackage(loadedDefinition);
    };
  }, [onRuntime]);

  if (failed) return <AnalogClock />;
  if (!definition) return <AnalogClock />;
  return <IdleRenderer definition={definition} now={now} />;
}

function logPackageFailure(id: IdlePackageId, error: unknown): void {
  const key = `${id}:${String(error)}`;
  if (loggedFailures.has(key)) return;
  loggedFailures.add(key);
  console.error(
    'Idle screen package failed; rendering compiled AnalogClock fallback.',
    {
      id,
      error
    }
  );
}
