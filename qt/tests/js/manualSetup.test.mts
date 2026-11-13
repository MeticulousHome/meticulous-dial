import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyManualSetup,
  defaultManualProfile,
  isWeightDisabled,
  nextTemperature,
  nextWeight,
  orderStagesForStart,
  outputStepHint,
  startControlOf,
  MANUAL_TEMPERATURE_MAX,
  MANUAL_WEIGHT_MAX,
  MANUAL_WEIGHT_MIN,
  MANUAL_WEIGHT_RESUME,
  type ManualProfile
} from '../src/components/ManualModeSetup/manualSetup.ts';
import {
  MANUAL_MODE_PROFILE_ID,
  MANUAL_WEIGHT_DISABLED
} from '../src/constants/manualMode.ts';

const saved = (): ManualProfile => ({
  ...defaultManualProfile(),
  name: 'Manual mode',
  temperature: 92,
  final_weight: 36,
  display: { image: 'manual.png', accentColor: '#F5C444' }
});

test('the default document is the seeded manual profile', () => {
  const profile = defaultManualProfile();

  assert.equal(profile.id, MANUAL_MODE_PROFILE_ID);
  assert.equal(profile.name, 'Manual mode');
  assert.equal(profile.author, 'Meticulous');
  assert.equal(profile.author_id, '00000000-0000-0000-0000-000000000000');
  assert.deepEqual(profile.previous_authors, []);
  assert.equal(profile.temperature, 90);
  assert.equal(profile.final_weight, MANUAL_WEIGHT_DISABLED);
  assert.deepEqual(profile.variables, []);
  assert.deepEqual(profile.display, {});
  assert.equal(profile.manual, true);

  assert.deepEqual(profile.stages, [
    {
      name: 'Manual pressure',
      key: 'manual_pressure',
      type: 'pressure',
      dynamics: { points: [[0, 0]], over: 'time', interpolation: 'none' },
      exit_triggers: [{ type: 'user_interaction', value: 1 }],
      limits: []
    },
    {
      name: 'Manual flow',
      key: 'manual_flow',
      type: 'flow',
      dynamics: { points: [[0, 0]], over: 'time', interpolation: 'none' },
      exit_triggers: [{ type: 'user_interaction', value: 1 }],
      limits: []
    }
  ]);
});

test('the default document is a fresh object each time', () => {
  const first = defaultManualProfile();
  first.stages[0].name = 'edited';

  assert.equal(defaultManualProfile().stages[0].name, 'Manual pressure');
});

test('orderStagesForStart puts the chosen control first', () => {
  const { stages } = defaultManualProfile();

  assert.deepEqual(
    orderStagesForStart(stages, 'pressure').map((stage) => stage.type),
    ['pressure', 'flow']
  );
  assert.deepEqual(
    orderStagesForStart(stages, 'flow').map((stage) => stage.type),
    ['flow', 'pressure']
  );
});

test('orderStagesForStart reorders a document saved the other way round', () => {
  const flowFirst = orderStagesForStart(defaultManualProfile().stages, 'flow');

  assert.deepEqual(
    orderStagesForStart(flowFirst, 'pressure').map((stage) => stage.key),
    ['manual_pressure', 'manual_flow']
  );
});

test('orderStagesForStart rejects anything that is not the manual pair', () => {
  const { stages } = defaultManualProfile();

  assert.throws(() => orderStagesForStart([], 'pressure'));
  assert.throws(() => orderStagesForStart([stages[0]], 'pressure'));
  assert.throws(() => orderStagesForStart([stages[0], stages[0]], 'pressure'));
  assert.throws(() => orderStagesForStart([...stages, stages[1]], 'flow'));
});

test('startControlOf reads the saved stage order', () => {
  const profile = defaultManualProfile();

  assert.equal(startControlOf(profile), 'pressure');
  assert.equal(
    startControlOf({
      ...profile,
      stages: orderStagesForStart(profile.stages, 'flow')
    }),
    'flow'
  );
});

test('applyManualSetup writes the three answers and keeps everything else', () => {
  const profile = saved();
  const applied = applyManualSetup(profile, {
    temperature: 94.5,
    finalWeight: 42,
    start: 'flow'
  });

  assert.equal(applied.temperature, 94.5);
  assert.equal(applied.final_weight, 42);
  assert.equal(applied.manual, true);
  assert.deepEqual(
    applied.stages.map((stage) => stage.key),
    ['manual_flow', 'manual_pressure']
  );

  // Untouched fields survive the edit, including the stages' own contents.
  assert.equal(applied.id, MANUAL_MODE_PROFILE_ID);
  assert.equal(applied.name, profile.name);
  assert.equal(applied.author, profile.author);
  assert.deepEqual(applied.display, profile.display);
  assert.deepEqual(applied.stages[0].dynamics, {
    points: [[0, 0]],
    over: 'time',
    interpolation: 'none'
  });
  assert.deepEqual(applied.stages[0].exit_triggers, [
    { type: 'user_interaction', value: 1 }
  ]);
});

test('applyManualSetup does not mutate the profile it was given', () => {
  const profile = saved();
  applyManualSetup(profile, {
    temperature: 88,
    finalWeight: MANUAL_WEIGHT_DISABLED,
    start: 'flow'
  });

  assert.equal(profile.temperature, 92);
  assert.equal(profile.final_weight, 36);
  assert.deepEqual(
    profile.stages.map((stage) => stage.key),
    ['manual_pressure', 'manual_flow']
  );
});

test('applyManualSetup keeps manual true even on a document that lost it', () => {
  const { manual, ...withoutManual } = saved();
  void manual;

  const applied = applyManualSetup(withoutManual as ManualProfile, {
    temperature: 90,
    finalWeight: 36,
    start: 'pressure'
  });

  assert.equal(applied.manual, true);
});

test('the disabled-weight sentinel is the schema maximum of 2000 g', () => {
  assert.equal(MANUAL_WEIGHT_DISABLED, 2000);
  assert.equal(isWeightDisabled(2000), true);
  assert.equal(isWeightDisabled(1999.5), false);
});

test('isWeightDisabled recognises the no-weight-stop sentinel', () => {
  assert.equal(isWeightDisabled(MANUAL_WEIGHT_DISABLED), true);
  assert.equal(isWeightDisabled(MANUAL_WEIGHT_DISABLED + 1), true);
  assert.equal(isWeightDisabled(MANUAL_WEIGHT_DISABLED - 0.5), false);
  assert.equal(isWeightDisabled(36), false);
  assert.equal(isWeightDisabled(0), false);
});

test('outputStepHint asks for a weight while the weight is off', () => {
  assert.equal(
    outputStepHint(MANUAL_WEIGHT_DISABLED),
    'Rotate knob to set weight'
  );
});

test('outputStepHint offers the long press once a weight is set', () => {
  assert.equal(outputStepHint(36), 'Long press disables the final weight');
  assert.equal(outputStepHint(0), 'Long press disables the final weight');
});

test('nextWeight steps by half a gram inside the gauge', () => {
  assert.equal(nextWeight(36, 36, 'right'), 36.5);
  assert.equal(nextWeight(36, 36, 'left'), 35.5);
  assert.equal(nextWeight(36.3, 36.3, 'right'), 36.8);
});

test('nextWeight stops at the ends of the gauge', () => {
  assert.equal(nextWeight(MANUAL_WEIGHT_MAX, 36, 'right'), MANUAL_WEIGHT_MAX);
  assert.equal(nextWeight(MANUAL_WEIGHT_MIN, 36, 'left'), MANUAL_WEIGHT_MIN);
  assert.equal(nextWeight(0.4, 36, 'left'), MANUAL_WEIGHT_MIN);
});

test('nextWeight returns a disabled weight to where the user left it', () => {
  assert.equal(nextWeight(MANUAL_WEIGHT_DISABLED, 42, 'right'), 42);
  assert.equal(nextWeight(MANUAL_WEIGHT_DISABLED, 42, 'left'), 42);
  assert.equal(
    nextWeight(MANUAL_WEIGHT_DISABLED, null, 'right'),
    MANUAL_WEIGHT_RESUME
  );
  assert.equal(
    nextWeight(MANUAL_WEIGHT_DISABLED, undefined, 'left'),
    MANUAL_WEIGHT_RESUME
  );
  // A remembered value from outside the gauge is still clamped onto it.
  assert.equal(
    nextWeight(MANUAL_WEIGHT_DISABLED, 4000, 'right'),
    MANUAL_WEIGHT_MAX
  );
});

test('nextTemperature steps by half a degree and stops at the ends', () => {
  assert.equal(nextTemperature(90, 'right'), 90.5);
  assert.equal(nextTemperature(90, 'left'), 89.5);
  assert.equal(
    nextTemperature(MANUAL_TEMPERATURE_MAX, 'right'),
    MANUAL_TEMPERATURE_MAX
  );
  assert.equal(nextTemperature(0, 'left'), 0);
});
