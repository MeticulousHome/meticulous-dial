// Whether the device info the Dial holds came after the firmware reported (qt/qml/Dial/Core/DeviceInfo.js).
//
// Regression a user at the machine would see without it: right after boot config has no "disturbance
// resilience" (and Brew Settings says tare behavior is unavailable) on a machine whose firmware supports it,
// until the next 2 h poll of /api/v1/machine, because the Dial kept the answer the backend gave before the
// ESP32's first ESPInfo and never asked again.
// Expected values come from the backend's GET /api/v1/machine (meticulous-backend machine_info.rs): it sends
// `firmware` (with mainVoltage) only once it holds an ESPInfo, and the *_supported flags false before that.
// The suite missed it: the end-to-end tests and the journeys start the Dial with the firmware already in.
import assert from 'node:assert/strict';
import test from 'node:test';

import { firmwareReported } from '../../qml/Dial/Core/DeviceInfo.js';

test('the boot answer, without the firmware, is not the machine yet', () => {
  assert.equal(firmwareReported({
    name: 'MeticulousRefreshingGreenBeans', serial: '32', image_version: '2026M1505-nightly',
    tare_behavior_supported: false, disturbance_resilience: null, disturbance_resilience_supported: false
  }), false);
  assert.equal(firmwareReported({ firmware: null }), false);
  assert.equal(firmwareReported(null), false);
});

test('the answer after the ESPInfo is final, whatever version the firmware sends', () => {
  assert.equal(firmwareReported({
    firmware: '0.2.24-480-g3011dcd9', mainVoltage: 240.0,
    tare_behavior_supported: true, disturbance_resilience: false, disturbance_resilience_supported: true
  }), true);
  // A firmware without these features is in too: its false flags are the real answer.
  assert.equal(firmwareReported({ firmware: '0.2.24-251-gd519a85', disturbance_resilience_supported: false }),
    true);
  // An ESPInfo with an empty version still came from the firmware.
  assert.equal(firmwareReported({ firmware: '' }), true);
});
