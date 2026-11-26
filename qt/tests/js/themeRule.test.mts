// Which theme the Dial shows (qt/qml/Dial/Core/ThemeRule.js).
//
// Regressions a user at the machine would see without it: the theme chosen in config is overridden by the
// machine's color; a white machine whose theme was never chosen comes up dark (or a black one light); the Dial
// flashes dark at every start while it waits for the backend; or, next to a backend without the setting (an
// update or a rollback half done), the chosen theme is lost at the next poll.
// Expected values: the `theme` setting's domain is null, "dark" and "light" (meticulous-backend
// config::THEMES and tests/contracts/settings_defaults.json), absent on an older backend; `color` is
// GET /api/v1/machine's (machine_info.rs), "" until the firmware reported it and "NOT_ASSIGNED" when the
// machine never got one (EspressoFirmware default_color). White is light and anything else dark by design.
import assert from 'node:assert/strict';
import test from 'node:test';

import { resolve } from '../../qml/Dial/Core/ThemeRule.js';

test('a chosen theme wins over the color of the machine', () => {
  assert.equal(resolve({ theme: 'dark' }, { color: 'white' }, 'light'), 'dark');
  assert.equal(resolve({ theme: 'light' }, { color: 'black' }, 'dark'), 'light');
  // and does not wait for the machine info
  assert.equal(resolve({ theme: 'light' }, null, 'dark'), 'light');
});

test('unset, a white machine is light and any other is dark', () => {
  assert.equal(resolve({ theme: null }, { color: 'white' }, 'dark'), 'light');
  assert.equal(resolve({ theme: null }, { color: 'White ' }, 'dark'), 'light');
  for (const color of ['black', 'silver', 'NOT_ASSIGNED', '', null, undefined])
    assert.equal(resolve({ theme: null }, { color }, 'light'), 'dark', String(color));
});

test('until the backend answers, what is on screen stays', () => {
  for (const shown of ['light', 'dark']) {
    assert.equal(resolve(null, null, shown), shown);
    assert.equal(resolve(null, { color: 'white' }, shown), shown);
    assert.equal(resolve({ theme: null }, null, shown), shown);
  }
});

test('a backend without the setting leaves the choice to the Dial', () => {
  assert.equal(resolve({ idle_screen: 'dvd' }, { color: 'black' }, 'light'), 'light');
  assert.equal(resolve({ idle_screen: 'dvd' }, { color: 'white' }, 'dark'), 'dark');
});
