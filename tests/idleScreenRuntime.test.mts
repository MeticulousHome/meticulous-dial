import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import Ajv from 'ajv/dist/2020.js';

import {
  computeAnalogRotation,
  formatDigitalTime,
  radialHandBounds
} from '../src/components/IdleScreen/runtime/clock.ts';
import {
  formatValue,
  resolveDynamicValue,
  resolveBinding,
  resolveCondition
} from '../src/components/IdleScreen/runtime/resolution.ts';

const schemaPath = join(
  process.cwd(),
  'src-tauri/resources/idle-screen-schema/idle-screen.schema.json'
);
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(schema);
const validateScreen = ajv.getSchema(`${schema.$id}#/$defs/screen`);
assert.ok(validateScreen);

const schemaHash = createHash('sha256')
  .update(readFileSync(schemaPath))
  .digest('hex');
assert.equal(
  schemaHash,
  'b9fbd3a4b07830e1ba9e1d5427c149ee4ce48401fb64c23882f861a37bc00822'
);

for (const id of ['default', 'digital', 'metCat']) {
  const screen = JSON.parse(
    readFileSync(
      join(process.cwd(), `src-tauri/resources/idle-screens/${id}/screen.json`),
      'utf8'
    )
  );
  assert.equal(validateScreen(screen), true, `${id} fixture validates`);
}

const invalidScreen = JSON.parse(
  readFileSync(
    join(process.cwd(), 'src-tauri/resources/idle-screens/default/screen.json'),
    'utf8'
  )
);
invalidScreen.layers[0].type = 'script';
assert.equal(validateScreen(invalidScreen), false);

const context = {
  time: {
    now: new Date('2026-08-25T15:04:05.500Z'),
    timestamp: 0,
    hour: 15,
    minute: 4,
    second: 5
  },
  settings: { idle_screen: 'digital' },
  wifi: { connected: true },
  machine: { state: 'idle', pressure: 1.234 },
  sensors: { pressure: 8.567 },
  notifications: { count: 2, hasNotifications: true, motorHot: false },
  osStatus: { status: 'IDLE' },
  deviceInfo: { serial: 'M123' },
  profiles: { count: 4, lastName: 'Classic' }
};

assert.equal(
  resolveBinding(
    {
      source: 'wifi',
      path: 'connected',
      formatter: {
        type: 'boolean',
        trueLabel: 'Ready',
        falseLabel: 'Offline'
      }
    },
    context
  ),
  'Ready'
);
assert.equal(
  resolveBinding(
    {
      source: 'sensors',
      path: 'pressure',
      formatter: { type: 'unit', precision: 1, suffix: ' bar' }
    },
    context
  ),
  '8.6 bar'
);
assert.equal(
  resolveBinding(
    { source: 'machine', path: 'missing', fallback: 'fallback' },
    context
  ),
  'fallback'
);
assert.equal(formatValue('abcdef', { type: 'truncate', maxLength: 3 }), 'abc');
assert.equal(
  resolveCondition(
    { source: 'notifications', path: 'count', operator: 'gte', value: 2 },
    context
  ),
  true
);
assert.equal(
  resolveCondition(
    { source: 'wifi', path: 'connected', operator: 'falsy', fallback: true },
    context
  ),
  false
);

const localDate = new Date(2026, 7, 25, 15, 4, 5, 500);
assert.equal(formatDigitalTime(localDate, 'HH:mm:ss', '24'), '15:04:05');
assert.equal(formatDigitalTime(localDate, 'hh:mm a', '12'), '03:04 PM');
assert.equal(formatDigitalTime(localDate, 'stackedHM', '12'), '03\n04\nPM');
assert.equal(computeAnalogRotation(localDate, 'second', false), 30);
assert.equal(computeAnalogRotation(localDate, 'second', true), 33);
assert.equal(Math.round(computeAnalogRotation(localDate, 'minute', true)), 25);
assert.equal(Math.round(computeAnalogRotation(localDate, 'hour', true)), 92);
assert.deepEqual(radialHandBounds(240, 240, 100, 6, 0, 20), {
  left: 237,
  top: 120,
  width: 6,
  height: 100,
  distance: 20
});
assert.equal(radialHandBounds(240, 240, 100, 6, 0, 999).distance, 480);
assert.equal(
  resolveDynamicValue(
    { token: 'strings.handUnit' },
    context,
    { colors: {}, fonts: {}, numbers: {}, strings: { handUnit: 'minute' }, booleans: { enabled: true } }
  ),
  'minute'
);
assert.equal(
  resolveDynamicValue(
    { token: 'booleans.enabled' },
    context,
    { colors: {}, fonts: {}, numbers: {}, strings: {}, booleans: { enabled: true } }
  ),
  true
);

console.log('Idle screen runtime tests passed.');
