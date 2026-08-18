import type { WifiHealthStatus } from '../../api/wifi';

export function isWifiHealthCheckPending(
  health?: WifiHealthStatus,
  connected?: boolean
): boolean {
  // An unknown connection state must not count as connected: a stale health
  // object would otherwise report "CHECKING" forever while disconnected.
  return Boolean(
    connected === true &&
    health?.link_connected &&
    health.has_ipv4 &&
    !health.degraded &&
    !health.last_error &&
    !health.gateway_reachable &&
    !health.dns_resolves &&
    !health.internet_reachable
  );
}

export function getWifiProbeStatusLabel(
  result?: boolean,
  health?: WifiHealthStatus,
  connected?: boolean
): string {
  if (!health || result === undefined) {
    return '';
  }

  if (result) {
    return 'OK';
  }

  return isWifiHealthCheckPending(health, connected) ? 'CHECKING' : 'FAILED';
}

export function getWifiHealthMessage(health?: WifiHealthStatus): string {
  if (!health) {
    return '';
  }

  if (health.mode === 'AP' && health.ap_active) {
    return (
      health.message ||
      "Hotspot active. Connect your phone or computer to the machine's Wi-Fi network."
    );
  }

  if (!health.degraded) {
    return 'HEALTHY';
  }

  if (health.message) {
    return health.message;
  }

  switch (health.last_error) {
    case 'internet_unreachable':
      return 'Connected to Wi-Fi, but this network does not appear to have internet access. Check the router or phone hotspot data connection.';
    case 'dns_unreachable':
      return 'Connected to Wi-Fi, but DNS is not working. Check the router internet or DNS settings.';
    case 'gateway_unreachable':
      return 'Connected to Wi-Fi, but the router is not responding. Move closer or restart the router.';
    case 'missing_ipv4':
      return 'Connected to Wi-Fi, but the router did not assign an IP address. Check DHCP settings on the router.';
    case 'wifi_device_unavailable':
      return 'Wi-Fi is still starting. Wait a moment and try again.';
    case 'wifi_not_connected':
      return 'The machine is not connected to Wi-Fi.';
    case 'hotspot_not_active':
      return 'The machine could not start its Wi-Fi hotspot. Please try again.';
    default:
      return 'Wi-Fi could not be verified. Please check the network and try again.';
  }
}

export function getWifiHealthStatusLabel(
  health?: WifiHealthStatus,
  connected = true
): string {
  if (!connected) {
    return 'NOT CONNECTED';
  }

  if (!health) {
    return 'UNKNOWN';
  }

  if (health.mode === 'AP' && health.ap_active) {
    return 'HOTSPOT ACTIVE';
  }

  if (!health.degraded) {
    return 'CONNECTED';
  }

  switch (health.last_error) {
    case 'internet_unreachable':
      return 'NO INTERNET';
    case 'dns_unreachable':
      return 'DNS ISSUE';
    case 'gateway_unreachable':
      return 'ROUTER ISSUE';
    case 'missing_ipv4':
      return 'NO IP ADDRESS';
    case 'wifi_device_unavailable':
      return 'WIFI STARTING';
    case 'wifi_not_connected':
      return 'NOT CONNECTED';
    case 'hotspot_not_active':
      return 'HOTSPOT ISSUE';
    default:
      return 'CHECK NETWORK';
  }
}

export function getWifiRecoveryMessage(health?: WifiHealthStatus): string {
  if (!health?.last_recovery_result) {
    return '';
  }

  switch (health.last_recovery_result) {
    case 'not_needed':
      return 'No repair needed';
    case 'not_recoverable':
      return 'Network/router issue';
    case 'recovered':
      return 'Repaired';
    case 'failed':
      return 'Repair failed';
    case 'in_progress':
      return 'Repairing';
    default:
      return health.last_recovery_result;
  }
}
