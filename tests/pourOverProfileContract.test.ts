import { strict as assert } from 'node:assert';

import {
  parsePourOverProfile,
  PortablePourOverProfile
} from '../src/features/freePour/profileContract';

const validProfile: PortablePourOverProfile = {
  version: 1,
  brew_type: 'pour_over',
  id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  name: 'Two Pour V60',
  author: 'Meticulous',
  author_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
  display: {
    accentColor: '#315566',
    shortDescription: 'A simple two-pour recipe.',
    description: 'Bloom, wait, then complete the brew.'
  },
  recipe: {
    coffee_dose_g: 15,
    total_water_g: 250,
    water_temperature_c: 92,
    target_total_time_s: 180,
    target_total_time_max_s: 210,
    brewer: { name: 'V60', size: '02' },
    grind: { description: 'Medium-fine' }
  },
  stages: [
    {
      key: 'bloom',
      name: 'Bloom',
      starts_at_s: 0,
      pour: {
        water_g: 50,
        duration_s: 10,
        target_cumulative_water_g: 50,
        flow_rate_g_s: 5,
        flow_range_g_s: [4, 6],
        pattern: 'spiral_out'
      }
    },
    {
      key: 'main',
      name: 'Main pour',
      starts_at_s: 45,
      pour: {
        water_g: 200,
        duration_s: 40,
        target_cumulative_water_g: 250,
        flow_rate_g_s: 5,
        pattern: 'center'
      }
    }
  ]
};

const clone = () => structuredClone(validProfile);

const parsed = parsePourOverProfile(validProfile);
assert.equal(parsed.success, true);
if (parsed.success) {
  assert.equal(parsed.dialProfile.doseG, 15);
  assert.equal(parsed.dialProfile.targetWaterG, 250);
  assert.deepEqual(parsed.dialProfile.pourTargets, [
    {
      number: 1,
      startTimeMs: 0,
      stopWeightG: 50,
      flowGps: 5,
      flowRangeGps: [4, 6]
    },
    {
      number: 2,
      startTimeMs: 45_000,
      stopWeightG: 250,
      flowGps: 5,
      flowRangeGps: undefined
    }
  ]);
}

for (const mutate of [
  (profile: PortablePourOverProfile) => {
    profile.recipe.coffee_dose_g = 4;
  },
  (profile: PortablePourOverProfile) => {
    profile.recipe.water_temperature_c = 69;
  },
  (profile: PortablePourOverProfile) => {
    profile.stages[0].starts_at_s = 1;
  },
  (profile: PortablePourOverProfile) => {
    profile.stages[1].starts_at_s = 5;
  },
  (profile: PortablePourOverProfile) => {
    profile.stages[1].pour.target_cumulative_water_g = 249;
  },
  (profile: PortablePourOverProfile) => {
    profile.stages[1].pour.flow_rate_g_s = 20;
  }
]) {
  const invalid = clone();
  mutate(invalid);
  assert.equal(parsePourOverProfile(invalid).success, false);
}

const unknownField = clone() as PortablePourOverProfile & { surprise?: true };
unknownField.surprise = true;
assert.equal(parsePourOverProfile(unknownField).success, false);

const externalImage = clone();
externalImage.display = {
  ...externalImage.display,
  image: 'https://example.com/profile.jpg'
};
assert.equal(parsePourOverProfile(externalImage).success, false);

const nonFinite = clone();
nonFinite.recipe.total_water_g = Number.POSITIVE_INFINITY;
assert.equal(parsePourOverProfile(nonFinite).success, false);

console.log('Pour Over profile contract tests passed.');
