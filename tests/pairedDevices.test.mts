import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { clampPairedDeviceIndex } from '../src/features/pairedDevices.ts';

test('clamps the active paired-device option when the list shrinks', () => {
  assert.equal(clampPairedDeviceIndex(4, 2), 1);
  assert.equal(clampPairedDeviceIndex(1, 0), 0);
  assert.equal(clampPairedDeviceIndex(-1, 3), 0);
  assert.equal(clampPairedDeviceIndex(1, 3), 1);
});

test('the paired-device screen renders query failures explicitly', () => {
  const source = readFileSync(
    new URL(
      '../src/components/PairedDevices/PairedDevices.tsx',
      import.meta.url
    ),
    'utf8'
  );

  assert.match(source, /if \(isError\)/);
  assert.match(source, /Could not load paired devices/);
  assert.doesNotMatch(source, /const \{ data, isLoading \} = usePairedDevices/);
});
