import { strict as assert } from 'node:assert';

import {
  createDialProfileHover,
  getActiveHomeOption,
  getFreePourOptionIndex,
  getHomeSelection,
  getNewOptionIndex,
  getRepeatPourOptionIndex
} from '../src/components/ProfileHomeScreen/homeSelection';

const profiles = Array.from({ length: 5 }, (_, index) => ({
  id: `profile-${index}`
}));

assert.equal(
  getActiveHomeOption({
    mode: 'free_pour',
    profileIndex: 0,
    profileCount: profiles.length,
    hasRepeatPour: false
  }),
  5
);
assert.equal(
  getActiveHomeOption({
    mode: 'espresso',
    profileIndex: 0,
    profileCount: profiles.length,
    hasRepeatPour: false
  }),
  0
);
assert.equal(
  getActiveHomeOption({
    mode: 'espresso',
    profileIndex: 4,
    profileCount: profiles.length,
    hasRepeatPour: true
  }),
  4
);
assert.equal(
  getRepeatPourOptionIndex({
    profileCount: profiles.length,
    hasRepeatPour: true
  }),
  5
);
assert.equal(
  getFreePourOptionIndex({
    profileCount: profiles.length,
    hasRepeatPour: true
  }),
  6
);
assert.equal(
  getNewOptionIndex({ profileCount: profiles.length, hasRepeatPour: true }),
  7
);

assert.deepEqual(
  getHomeSelection(0, { profileCount: profiles.length, hasRepeatPour: true }),
  { mode: 'espresso', profileIndex: 0 }
);
assert.deepEqual(
  getHomeSelection(5, { profileCount: profiles.length, hasRepeatPour: true }),
  { mode: 'pour_over_profile', profileIndex: null }
);
assert.deepEqual(
  getHomeSelection(6, { profileCount: profiles.length, hasRepeatPour: true }),
  { mode: 'free_pour', profileIndex: null }
);
assert.deepEqual(
  getHomeSelection(7, { profileCount: profiles.length, hasRepeatPour: true }),
  { mode: 'new', profileIndex: null }
);

assert.deepEqual(createDialProfileHover(0, profiles, false, 'scroll'), {
  id: 'profile-0',
  from: 'dial',
  type: 'scroll'
});
assert.deepEqual(createDialProfileHover(4, profiles, true, 'focus'), {
  id: 'profile-4',
  from: 'dial',
  type: 'focus'
});
assert.equal(createDialProfileHover(5, profiles, true, 'scroll'), null);
assert.equal(createDialProfileHover(6, profiles, true, 'scroll'), null);
assert.equal(createDialProfileHover(7, profiles, true, 'scroll'), null);

console.log('Profile home selection regression tests passed.');
