import { API_URL } from './api';

// Paired-device management for the machine's per-device API tokens.
// The Dial reaches the backend over loopback, which the backend exempts from
// token auth, so these calls need no credentials. Uses raw fetch until
// @meticulous-home/espresso-api ships pairing support.

export interface PairedDevice {
  device_id: string;
  device_name: string;
  created_at: string | null;
  last_seen_at: string | null;
}

export async function listPairedDevices(): Promise<PairedDevice[]> {
  const response = await fetch(`${API_URL}/api/v1/pair/devices`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  if (data && 'error' in data) {
    throw new Error(data.error);
  }
  return data.devices ?? [];
}

export async function revokePairedDevice(deviceId: string): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/v1/pair/devices/${encodeURIComponent(deviceId)}/revoke`,
    { method: 'POST' }
  );
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  if (data && 'error' in data) {
    throw new Error(data.error);
  }
}

export async function revokeAllPairedDevices(): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/pair/devices/revoke-all`, {
    method: 'POST'
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  if (data && 'error' in data) {
    throw new Error(data.error);
  }
}
