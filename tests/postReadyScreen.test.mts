import assert from 'node:assert/strict';
import test from 'node:test';

import { resolvePostReadyScreen } from '../src/components/ShotDataSharing/postReadyScreen.ts';

test('asks about shot data sharing only while the setting was never answered', () => {
  assert.equal(
    resolvePostReadyScreen({ shot_data_sharing: null }),
    'shotDataSharingPrompt'
  );
});

test('goes home once the user opted in or declined', () => {
  assert.equal(
    resolvePostReadyScreen({ shot_data_sharing: true }),
    'profileHome'
  );
  assert.equal(
    resolvePostReadyScreen({ shot_data_sharing: false }),
    'profileHome'
  );
});

test('goes home when settings are missing or from an older backend', () => {
  assert.equal(resolvePostReadyScreen(undefined), 'profileHome');
  assert.equal(resolvePostReadyScreen(null), 'profileHome');
  assert.equal(resolvePostReadyScreen({}), 'profileHome');
});
