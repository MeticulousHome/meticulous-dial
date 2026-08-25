import { useMemo } from 'react';

import { useDeviceInfo, useOSStatus } from '../../../hooks/useDeviceOSStatus';
import { useProfiles } from '../../../hooks/useProfiles';
import { useSettings } from '../../../hooks/useSettings';
import { useNetworkConfig } from '../../../hooks/useWifi';
import { notificationSelector } from '../../store/features/notifications/notification-slice';
import { useAppSelector } from '../../store/hooks';
import type { IdleDataContext, IdleScreenDocument } from './types';
export {
  formatValue,
  resolveBinding,
  resolveCondition,
  resolveDynamicValue
} from './resolution';

const SETTINGS_ALLOW_LIST = new Set([
  'idle_screen',
  'enable_sounds',
  'time_zone',
  'timezone_sync',
  'update_channel',
  'ssh_enabled',
  'tare_behavior'
]);

export function useIdleDataContext(
  screen: IdleScreenDocument | null,
  now: Date
): IdleDataContext {
  const settings = useSettings({ idle: true });
  const wifi = useNetworkConfig({ idle: true });
  const osStatus = useOSStatus();
  const deviceInfo = useDeviceInfo({ refetchInterval: 2 * 60 * 60 * 1000 });
  const profiles = useProfiles();
  const stats = useAppSelector((state) => state.stats);
  const notifications = useAppSelector(notificationSelector.selectTotal);
  const motorHot = useAppSelector(notificationSelector.selectMotorHot);

  return useMemo(
    () => ({
      time: {
        now,
        timestamp: now.getTime(),
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds()
      },
      settings: sanitizeSettings(settings.data),
      wifi: sanitizeWifi(wifi.data),
      machine: {
        id: stats.id,
        state: stats.state,
        name: stats.name,
        extracting: stats.extracting,
        time: stats.time,
        profileTime: stats.profile_time,
        profile: stats.profile,
        loadedProfile: stats.loaded_profile,
        waterStatus: stats.waterStatus,
        preheatTimeLeft: stats.preheatTimeLeft
      },
      sensors: {
        pressure: stats.sensors?.p,
        flow: stats.sensors?.f,
        weight: stats.sensors?.w,
        temperature: stats.sensors?.t,
        sensorPressure: stats.sensorData?.p,
        motorSpeed: stats.sensorData?.m_spd,
        motorPower: stats.sensorData?.m_pwr,
        motorCurrent: stats.sensorData?.m_cur,
        motorTemperature: stats.sensorData?.motor_temp,
        predictedWeight: stats.sensorData?.weight_pred
      },
      notifications: {
        count: notifications,
        hasNotifications: notifications > 0,
        motorHot
      },
      osStatus: {
        status: osStatus.data?.status,
        progress: osStatus.data?.progress,
        info: osStatus.data?.info
      },
      deviceInfo: sanitizeDeviceInfo(
        deviceInfo.data as unknown as Record<string, unknown> | undefined
      ),
      profiles: {
        count: profiles.data?.length ?? 0,
        lastName: safeString(profiles.data?.[0]?.name)
      }
    }),
    [
      deviceInfo.data,
      motorHot,
      notifications,
      now,
      osStatus.data,
      profiles.data,
      screen?.id,
      settings.data,
      stats,
      wifi.data
    ]
  );
}

function sanitizeSettings(
  settings: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!settings) return {};
  return Object.fromEntries(
    Object.entries(settings).filter(([key]) => SETTINGS_ALLOW_LIST.has(key))
  );
}

function sanitizeWifi(wifi: unknown): IdleDataContext['wifi'] {
  const wifiRecord = asRecord(wifi);
  const status = asRecord(wifiRecord.status);
  return {
    connected: Boolean(status.connected),
    mode: safeString(wifiRecord.mode),
    ssid: safeString(status.ssid)
  };
}

function sanitizeDeviceInfo(
  deviceInfo: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!deviceInfo) return {};
  return {
    machineId: deviceInfo.machine_id,
    serial: deviceInfo.serial,
    model: deviceInfo.model,
    softwareVersion: deviceInfo.software_version
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
