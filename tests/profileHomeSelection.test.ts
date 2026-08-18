import { strict as assert } from 'node:assert';

import {
  createDialProfileHover,
  getActiveHomeOption,
  getFreePourOptionIndex,
  getHomeSelection,
  getNewOptionIndex,
  getPourOverProfileOptionIndex,
  getRepeatPourOptionIndex
} from '../src/components/ProfileHomeScreen/homeSelection';
import { isPourOverProfileEvent } from '../src/features/freePour/profileEvents';

const profiles = Array.from({ length: 5 }, (_, index) => ({
  id: `profile-${index}`
}));
const layout = {
  profileCount: profiles.length,
  pourOverProfileCount: 2,
  hasRepeatPour: true
};

assert.equal(
  getActiveHomeOption({
    mode: 'free_pour',
    profileIndex: 0,
    pourOverProfileIndex: null,
    ...layout
  }),
  8
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
assert.equal(
  getActiveHomeOption({
    mode: 'repeat_pour',
    profileIndex: null,
    pourOverProfileIndex: null,
    ...layout
  }),
  7
);
assert.equal(getPourOverProfileOptionIndex(0, layout), 5);
assert.equal(getPourOverProfileOptionIndex(1, layout), 6);
assert.equal(getRepeatPourOptionIndex(layout), 7);
assert.equal(getFreePourOptionIndex(layout), 8);
assert.equal(getNewOptionIndex(layout), 9);

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
  mode: 'repeat_pour',
  profileIndex: null,
  pourOverProfileIndex: null
});
assert.deepEqual(getHomeSelection(8, layout), {
  mode: 'free_pour',
  profileIndex: null,
  pourOverProfileIndex: null
});
assert.deepEqual(getHomeSelection(9, layout), {
  mode: 'new',
  profileIndex: null,
  pourOverProfileIndex: null
});

assert.deepEqual(createDialProfileHover(0, profiles, 2, true, 'scroll'), {
  id: 'profile-0',
  from: 'dial',
  type: 'scroll'
});
assert.deepEqual(createDialProfileHover(4, profiles, 2, true, 'focus'), {
  id: 'profile-4',
  from: 'dial',
  type: 'focus'
});
for (let option = 5; option <= 9; option += 1) {
  assert.equal(
    createDialProfileHover(option, profiles, 2, true, 'scroll'),
    null
  );
}

// With no espresso profiles, the first installed Pour Over profile is active.
assert.equal(
  getActiveHomeOption({
    mode: 'espresso',
    profileIndex: 0,
    pourOverProfileIndex: null,
    profileCount: 0,
    pourOverProfileCount: 1,
    hasRepeatPour: false
  }),
  0
);

console.log('Profile home selection regression tests passed.');
