import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { LEGACY_DVD_METADATA, listIdleScreenPackages } from './packageApi';
import type { IdleScreenMetadata } from './types';

export const IDLE_SCREEN_PACKAGES_QUERY_KEY = 'idle-screen-packages';

export function useIdleScreenPackages() {
  return useQuery({
    queryKey: [IDLE_SCREEN_PACKAGES_QUERY_KEY],
    queryFn: listIdleScreenPackages,
    staleTime: 30_000,
    refetchInterval: 60_000
  });
}

export function useIdleScreenOptions(): IdleScreenMetadata[] {
  const packages = useIdleScreenPackages();
  return useMemo(
    () => [...(packages.data ?? []), LEGACY_DVD_METADATA],
    [packages.data]
  );
}
