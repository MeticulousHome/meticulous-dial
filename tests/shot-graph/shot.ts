// The last shot of a machine whose scale reports nothing. The backend sends a
// sensor it has no reading for as the string "NaN" (meticulous-backend
// esp_serial/data.py, safe_float_with_nan), so every sample carries
// "weight": "NaN". The last sample is the one a bench machine returned for
// POST /api/v1/history on 2026-10-24, when the Dial went black on the
// brew-complete graph. Two samples also carry "NaN" and null pressure and flow.
export const PROFILE_ID = 'shot-graph-fixture';
export const SAMPLES = 51;
export const SAMPLE_MS = 200;
export const PRESSURE_STEP = 0.2;
export const FLOW = 1.8;
export const NAN_PRESSURE_SAMPLE = 10; // pressure "NaN", flow null
export const NULL_PRESSURE_SAMPLE = 20; // pressure null, flow "NaN"

const pressureAt = (i: number) =>
  i === NAN_PRESSURE_SAMPLE
    ? 'NaN'
    : i === NULL_PRESSURE_SAMPLE
      ? null
      : i * PRESSURE_STEP;
const flowAt = (i: number) =>
  i === NAN_PRESSURE_SAMPLE ? null : i === NULL_PRESSURE_SAMPLE ? 'NaN' : FLOW;

const benchLastSample = {
  shot: {
    pressure: 0.0,
    flow: 0,
    weight: 'NaN',
    gravimetric_flow: 0.0,
    setpoints: { active: null }
  },
  status: 'retracting'
};

export const shot = {
  id: 'no-scale-shot',
  db_key: 1,
  time: 1761318180,
  file: null,
  name: 'Shot graph fixture',
  profile: { id: PROFILE_ID, name: 'Shot graph fixture' },
  data: Array.from({ length: SAMPLES }, (_, i) => ({
    ...(i === SAMPLES - 1
      ? benchLastSample
      : {
          shot: {
            pressure: pressureAt(i),
            flow: flowAt(i),
            weight: 'NaN',
            gravimetric_flow: 0.0,
            setpoints: { active: null }
          },
          status: 'brewing'
        }),
    time: i * SAMPLE_MS,
    profile_time: i * SAMPLE_MS
  }))
};
