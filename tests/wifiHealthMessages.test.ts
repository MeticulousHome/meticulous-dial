import { strict as assert } from 'node:assert';

import type { WifiHealthStatus } from '../src/api/wifi';
import {
  getWifiProbeStatusLabel,
  isWifiHealthCheckPending
} from '../src/components/Wifi/wifiHealthMessages';

function health(overrides: Partial<WifiHealthStatus> = {}): WifiHealthStatus {
  return {
    mode: 'client',
    link_connected: true,
    has_ipv4: true,
    gateway_reachable: false,
    dns_resolves: false,
    internet_reachable: false,
    ap_active: false,
    degraded: false,
    last_error: '',
    last_recovery_action: '',
    last_recovery_result: '',
    ...overrides
  };
}

const pending = health();
assert.equal(isWifiHealthCheckPending(pending, true), true);
assert.equal(getWifiProbeStatusLabel(false, pending, true), 'CHECKING');

const healthy = health({
  gateway_reachable: true,
  dns_resolves: true,
  internet_reachable: true
});
assert.equal(isWifiHealthCheckPending(healthy, true), false);
assert.equal(getWifiProbeStatusLabel(true, healthy, true), 'OK');

const dnsFailure = health({
  gateway_reachable: true,
  degraded: true,
  last_error: 'dns_unreachable'
});
assert.equal(isWifiHealthCheckPending(dnsFailure, true), false);
assert.equal(getWifiProbeStatusLabel(false, dnsFailure, true), 'FAILED');

const internetFailure = health({
  gateway_reachable: true,
  dns_resolves: true,
  degraded: true,
  last_error: 'internet_unreachable'
});
assert.equal(getWifiProbeStatusLabel(false, internetFailure, true), 'FAILED');

assert.equal(getWifiProbeStatusLabel(false, pending, false), 'FAILED');
assert.equal(getWifiProbeStatusLabel(undefined, undefined, true), '');

// An unknown connection state (wifiStatus not loaded yet or gone stale) must
// not be treated as connected: a stale pending-looking health object would
// otherwise show "CHECKING" while the machine is disconnected.
assert.equal(isWifiHealthCheckPending(pending), false);
assert.equal(isWifiHealthCheckPending(pending, undefined), false);
assert.equal(getWifiProbeStatusLabel(false, pending), 'FAILED');
assert.equal(getWifiProbeStatusLabel(false, pending, undefined), 'FAILED');

console.log('Wi-Fi health display regression tests passed.');
