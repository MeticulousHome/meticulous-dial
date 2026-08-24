import { strict as assert } from 'node:assert';

import {
  createDialProfileHover,
  getActiveHomeOption,
  getFreePourOptionIndex,
  getHomeSelection,
  getNewOptionIndex,
  getPourOverProfileOptionIndex,
  reconcilePourOverCatalogSelection
} from '../src/components/ProfileHomeScreen/homeSelection';
import { isPourOverProfileEvent } from '../src/features/freePour/profileEvents';

const profiles = Array.from({ length: 5 }, (_, index) => ({
  id: `profile-${index}`
}));
const layout = {
  profileCount: profiles.length,
  pourOverProfileCount: 2
};

assert.equal(
  getActiveHomeOption({
    mode: 'free_pour',
    profileIndex: 0,
    pourOverProfileIndex: null,
    ...layout
  }),
  7
);

// A temporarily unavailable catalog must not switch a selected Pour Over
// profile back to espresso while a long brew causes the query cache to remount.
assert.deepEqual(
  reconcilePourOverCatalogSelection({
    mode: 'pour_over_profile',
    selectedProfileId: 'pour-over-2',
    installedProfileIds: [],
    catalogResolved: false
  }),
  { mode: 'pour_over_profile', selectedProfileId: 'pour-over-2' }
);

assert.deepEqual(
  reconcilePourOverCatalogSelection({
    mode: 'pour_over_profile',
    selectedProfileId: 'deleted-profile',
    installedProfileIds: ['remaining-profile'],
    catalogResolved: true
  }),
  { mode: 'pour_over_profile', selectedProfileId: 'remaining-profile' }
);

assert.deepEqual(
  reconcilePourOverCatalogSelection({
    mode: 'pour_over_profile',
    selectedProfileId: 'deleted-profile',
    installedProfileIds: [],
    catalogResolved: true
  }),
  { mode: 'free_pour', selectedProfileId: null }
);

assert.equal(
  isPourOverProfileEvent({ change: 'create', brew_type: 'pour_over' }),
  true
);
assert.equal(isPourOverProfileEvent({ change: 'create' }), false);
assert.equal(
  isPourOverProfileEvent({ change: 'create', brew_type: 'espresso' }),
  false
);
assert.equal(
  getActiveHomeOption({
    mode: 'espresso',
    profileIndex: 4,
    pourOverProfileIndex: null,
    ...layout
  }),
  4
);
assert.equal(
  getActiveHomeOption({
    mode: 'pour_over_profile',
    profileIndex: null,
    pourOverProfileIndex: 1,
    ...layout
  }),
  6
);
assert.equal(getPourOverProfileOptionIndex(0, layout), 5);
assert.equal(getPourOverProfileOptionIndex(1, layout), 6);
assert.equal(getFreePourOptionIndex(layout), 7);
assert.equal(getNewOptionIndex(layout), 8);

assert.deepEqual(getHomeSelection(0, layout), {
  mode: 'espresso',
  profileIndex: 0,
  pourOverProfileIndex: null
});
assert.deepEqual(getHomeSelection(5, layout), {
  mode: 'pour_over_profile',
  profileIndex: null,
  pourOverProfileIndex: 0
});
assert.deepEqual(getHomeSelection(6, layout), {
  mode: 'pour_over_profile',
  profileIndex: null,
  pourOverProfileIndex: 1
});
assert.deepEqual(getHomeSelection(7, layout), {
  mode: 'free_pour',
  profileIndex: null,
  pourOverProfileIndex: null
});
assert.deepEqual(getHomeSelection(8, layout), {
  mode: 'new',
  profileIndex: null,
  pourOverProfileIndex: null
});

assert.deepEqual(createDialProfileHover(0, profiles, 2, 'scroll'), {
  id: 'profile-0',
  from: 'dial',
  type: 'scroll'
});
assert.deepEqual(createDialProfileHover(4, profiles, 2, 'focus'), {
  id: 'profile-4',
  from: 'dial',
  type: 'focus'
});
for (let option = 5; option <= 8; option += 1) {
  assert.equal(createDialProfileHover(option, profiles, 2, 'scroll'), null);
}

// With no espresso profiles, the first installed Pour Over profile is active.
assert.equal(
  getActiveHomeOption({
    mode: 'espresso',
    profileIndex: 0,
    pourOverProfileIndex: null,
    profileCount: 0,
    pourOverProfileCount: 1
  }),
  0
);

console.log('Profile home selection regression tests passed.');
