import { Settings } from '@meticulous-home/espresso-api';

export const getSettingLabel = (key: string, globalSettings: Settings) => {
  const settingLabelMap: Record<string, string | undefined> = {
    heat_timeout_after_shot: `${globalSettings.heating_timeout} MIN`,
    auto_purge_after_shot: globalSettings.auto_purge_after_shot
      ? 'ENABLED'
      : 'DISABLED',
    auto_start_shot: globalSettings.auto_start_shot ? 'ENABLED' : 'DISABLED',
    enable_sounds: globalSettings.enable_sounds ? 'ENABLED' : 'DISABLED',
    time_zone: globalSettings.time_zone ?? '',
    timezone_sync:
      globalSettings.timezone_sync === 'automatic' ? 'ENABLED' : 'DISABLED'
  };

  return settingLabelMap[key];
};
