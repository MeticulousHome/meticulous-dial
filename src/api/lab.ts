import { API_URL } from './api';

export type BluetoothStatus = {
  powered: boolean;
  name: string;
  address: string;
  discoverable: boolean;
  pairable: boolean;
};

export type MotorMode = 'up' | 'down' | 'ramp';

export type MotorHeaterRequest = {
  motor_power: number;
  band_heater_power: number;
  motor_mode: MotorMode;
};

async function readJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok || data.status === 'error') {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }
  return data as T;
}

export async function getWifiRadioStatus(): Promise<boolean> {
  const response = await fetch(`${API_URL}/api/v1/wifi/radio`);
  const data = await readJsonResponse<{ enabled: boolean }>(response);
  return data.enabled;
}

export async function setWifiRadioStatus(enable: boolean): Promise<boolean> {
  const response = await fetch(`${API_URL}/api/v1/wifi/radio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enable })
  });
  const data = await readJsonResponse<{ enabled: boolean }>(response);
  return data.enabled;
}

export async function getBluetoothStatus(): Promise<BluetoothStatus> {
  const response = await fetch(`${API_URL}/api/v1/bluetooth/status`);
  return readJsonResponse<BluetoothStatus>(response);
}

export async function setBluetoothPower(
  enable: boolean
): Promise<BluetoothStatus> {
  const response = await fetch(`${API_URL}/api/v1/bluetooth/power`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: enable ? 'on' : 'off' })
  });
  const data = await readJsonResponse<{ current_state: BluetoothStatus }>(
    response
  );
  return data.current_state;
}

export async function startMotorHeaterControl(
  request: MotorHeaterRequest
): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/lab/motor-heater`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  await readJsonResponse(response);
}

export async function stopMotorHeaterControl(): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/lab/motor-heater/stop`, {
    method: 'POST'
  });
  await readJsonResponse(response);
}
