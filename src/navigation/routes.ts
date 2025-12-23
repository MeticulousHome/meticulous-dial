import { ComponentType } from 'react';
import { Barometer } from '../components/Barometer/Barometer';
import { PressetSettings } from '../components/PressetSettings/PressetSettings';
import { SettingNumerical } from '../components/SettingNumerical/SettingNumerical';
import { Settings } from '../components/Settings/Settings';
import { ScreenType } from '../components/store/features/screens/screens-slice';
import { EditNameScreen } from '../components/EditNameScreen/EditNameScreen';
import { ConnectWifiMenu } from '../components/Wifi/ConnectWifiMenu';
import { WifiSettings } from './../components/Wifi/WifiSettings';
import { SelectWifi } from '../components/Wifi/SelectWifi';
import { EnterWifiPassword } from '../components/Wifi/EnterWifiPassword';
import { WifiDetails } from '../components/Wifi/WifiDetails';
import { RootState } from '../components/store/store';
import { Notification } from '../components/Notification/Notification';
import { ConnectWifiViaApp } from '../components/Wifi/ConnetWifiViaApp';
import { OSStatus } from '../components/OSStatus/OSStatus';
import { QuickSettings } from '../../src/components/QuickSettings/QuickSettings';
import { SnakeGame } from '../../src/components/Snake/Snake';
import { KnownWifi } from '../../src/components/Wifi/KnownWifi';
import { DeleteWifiMenu } from '../components/Wifi/DeleteWifiMenu';
import { AdvancedSettings } from '../components/Settings/Advanced/Advanced';
import { WifiQrMenu } from '../../src/components/Wifi/WifiQrMenu';
import { PressetProfileImage } from '../components/PressetSettings/PressetProfileImage';
import { DeviceInfoScreen } from '../components/Settings/Advanced/DeviceInfoScreen';
import { DefaultProfiles } from '../components/DefaultProfiles/DefaultProfiles';
import { ProfileDetails } from '../components/DefaultProfiles/DefaultProfileDetails';
import { PurgeScreen } from '../components/PurgePiston/PurgeScreen';
import { UpdateChannel } from '../components/Settings/Advanced/UpdateChannel';
import { ReadyAnimation } from '../components/ReadyAnimation/ReadyAnimation';
import { HeatTimeoutAfterShot } from '../components/HeatTimeoutAfterShot/HeatTimeoutAfterShot';
import { IdleScreen } from '../components/IdleScreen/IdleScreen';
import { HeatingScreen } from '../components/Heating/HeatingScreen';
import { TimeDate } from '../components/Settings/Advanced/TimeDate/TimeDateConfig';
import { TimeZoneConfig } from '../components/Settings/Advanced/TimeDate/TimeZone/TimeZoneConfig';
import SelectLetterCountry from '../components/Settings/Advanced/TimeDate/TimeZone/SelectLetterCountry';
import CountrySettings from '../components/Settings/Advanced/TimeDate/TimeZone/CountrySettings';
import TimeZoneSettings from '../components/Settings/Advanced/TimeDate/TimeZone/TimeZoneSettings';
import { IdleScreenSetting } from '../components/Settings/Advanced/IdleScreenSetting';

import CalibrateScale from '../components/Scale/CalibrateScale';
import { USBSettings } from '../components/Settings/USBSettings';
import { BrewSettings } from '../components/Settings/BrewSettings';
import { TimeConfig } from '../components/Settings/Advanced/TimeDate/TimeConfig';
import { DateConfig } from '../components/Settings/Advanced/TimeDate/DateConfig';
import { ShotGraphScreen } from '../components/ShotGraph/ShotGraphScreen';
import { ScrollDirectionSettings } from '../components/Settings/ScrollDirection';
import { BrewCompleteScreen } from '../components/BrewCompleteScreen/BrewCompleteScreen';
import { ProfileHomeScreen } from '../components/ProfileHomeScreen/ProfileHomeScreen';
import {
  getActiveProfilesTitle,
  getProfilesTitle
} from '../components/ProfileHomeScreen/ProfileTitle';
import { FactoryReset } from '../components/Settings/Advanced/FactoryReset';
import { Manufacturing } from '../components/Settings/Advanced/Manufacturing';
import { RetractionSettingGauge } from '../components/Settings/Advanced/RetractionVolume';
import { useProfileContext } from '../context/ProfileContext';
import { DisplayAlignment } from '../components/Settings/Advanced/DisplayAlignment';
import {
  UnlockScreen,
  UnlockMasterCalibration
} from '../components/UnlockScreen/UnlockScreen';
import { InfoQRCode } from '../components/Settings/Advanced/InfoQrCode';

interface Route {
  component: ComponentType;
  parentTitle?: string | ((state: RootState) => string) | (() => JSX.Element);
  title?:
    | string
    | ((state: RootState) => string)
    | ((state: RootState) => JSX.Element);
  titleShared?: boolean;
  parent?: ScreenType;
  bottomStatusHidden?: boolean;
  bottomTitle?: string;
  props?: object;
  animationDirectionFrom?: Partial<Record<ScreenType, 'in' | 'out'>>;
  ignoreAsPrevious?: boolean;
}

const selectPurgeTitle = (state: RootState) => {
  const machine_state = state.stats.state;
  if (machine_state == 'brewing' && state.stats.profile !== 'Init Profile') {
    return state.stats.profile;
  }

  const {
    mergedProfiles,
    localProfileIndex: activeProfile,
    profileStarting
  } = useProfileContext();

  if (mergedProfiles && profileStarting) {
    return mergedProfiles[activeProfile].name;
  }

  if (state.stats.name === 'home') {
    return 'Raising';
  }

  return 'Purging';
};

// Profile from "start" event may not exist in LCD. Prefer using
// that profile name over selected preset
const selectStatProfileName = (state: RootState) => state.stats.profile;

export const routes: Record<ScreenType, Route> = {
  deviceInfoQR: {
    component: InfoQRCode,
    title: 'show device info code',
    bottomStatusHidden: true
  },
  masterCalibrationLock: {
    component: UnlockMasterCalibration,
    title: '',
    bottomStatusHidden: true
  },
  timeZoneConfig: {
    component: TimeZoneConfig,
    title: 'timeZoneConfig',
    bottomStatusHidden: true
  },
  timeDate: {
    component: TimeDate,
    title: 'TimeDate',
    bottomStatusHidden: true
  },
  timeConfig: {
    component: TimeConfig,
    title: 'Time',
    bottomStatusHidden: true
  },
  dateConfig: {
    component: DateConfig,
    title: 'Time',
    bottomStatusHidden: true
  },
  OSStatus: {
    component: OSStatus,
    title: 'OSStatus',
    bottomStatusHidden: true
  },
  ready: {
    component: ReadyAnimation,
    bottomStatusHidden: true,
    ignoreAsPrevious: true
  },
  settings: {
    component: Settings,
    title: 'settings',
    bottomStatusHidden: true
  },
  profileHome: {
    component: ProfileHomeScreen,
    parentTitle: getProfilesTitle
  },
  barometer: {
    component: Barometer,
    title: selectStatProfileName,
    bottomStatusHidden: true,
    animationDirectionFrom: {
      'manual-purge': 'in',
      heating: 'in'
    }
  },
  pressetSettings: {
    component: PressetSettings,
    title: getActiveProfilesTitle,
    bottomStatusHidden: true,
    parent: 'profileHome'
  },
  pressure: {
    component: SettingNumerical,
    title: getActiveProfilesTitle,
    bottomTitle: 'pressure',
    props: {
      type: 'pressure'
    },
    bottomStatusHidden: true,
    parent: 'pressetSettings'
  },
  piston_position: {
    component: SettingNumerical,
    title: getActiveProfilesTitle,
    bottomTitle: 'piston position',
    props: {
      type: 'piston_position'
    },
    bottomStatusHidden: true,
    parent: 'pressetSettings'
  },
  retraction_volume: {
    component: RetractionSettingGauge,
    title: 'retraction',
    bottomTitle: 'shot volume',
    props: {
      type: 'retraction_volume'
    },
    bottomStatusHidden: true,
    parent: 'brewSettings'
  },
  motor_power: {
    component: SettingNumerical,
    title: getActiveProfilesTitle,
    bottomTitle: 'motor power',
    props: {
      type: 'motor_power'
    },
    bottomStatusHidden: true,
    parent: 'pressetSettings'
  },
  time: {
    component: SettingNumerical,
    title: getActiveProfilesTitle,
    bottomTitle: 'time',
    props: {
      type: 'time'
    },
    bottomStatusHidden: true,
    parent: 'pressetSettings'
  },
  weight: {
    component: SettingNumerical,
    title: getActiveProfilesTitle,
    bottomTitle: 'weight',
    props: {
      type: 'weight'
    },
    bottomStatusHidden: true,
    parent: 'pressetSettings'
  },
  flow: {
    component: SettingNumerical,
    title: getActiveProfilesTitle,
    bottomTitle: 'flow',
    props: {
      type: 'flow'
    },
    bottomStatusHidden: true,
    parent: 'pressetSettings'
  },

  temperature: {
    component: SettingNumerical,
    title: getActiveProfilesTitle,
    bottomTitle: 'temperature',
    props: {
      type: 'temperature'
    },
    bottomStatusHidden: true,
    parent: 'pressetSettings'
  },
  output: {
    title: getActiveProfilesTitle,
    component: SettingNumerical,
    bottomTitle: 'output',
    props: {
      type: 'output'
    },
    bottomStatusHidden: true,
    parent: 'pressetSettings'
  },
  'manual-purge': {
    component: PurgeScreen,
    bottomStatusHidden: true,
    title: selectPurgeTitle,
    animationDirectionFrom: {
      barometer: 'in',
      heating: 'in'
    }
  },
  heating: {
    component: HeatingScreen,
    title: getActiveProfilesTitle,
    bottomStatusHidden: true,
    animationDirectionFrom: {
      barometer: 'in',
      'manual-purge': 'in'
    }
  },
  calibrateScale: {
    component: CalibrateScale,
    bottomStatusHidden: true
  },
  dose: {
    component: () => null, // Multiple choice to be implemented
    title: 'dose',
    parentTitle: getActiveProfilesTitle,
    parent: 'pressetSettings'
  },
  name: {
    component: EditNameScreen,
    bottomStatusHidden: true,
    parent: 'pressetSettings'
  },
  selectLetterCountry: {
    component: SelectLetterCountry,
    bottomStatusHidden: true
  },
  countrySettings: {
    component: CountrySettings,
    bottomStatusHidden: true
  },
  timeZoneSettings: {
    component: TimeZoneSettings,
    bottomStatusHidden: true
  },
  notifications: {
    component: Notification,
    bottomStatusHidden: true,
    ignoreAsPrevious: true
  },
  wifiSettings: {
    component: WifiSettings,
    title: 'wifi settings',
    bottomStatusHidden: true
  },
  wifiQrMenu: {
    component: WifiQrMenu,
    title: 'show connection code',
    bottomStatusHidden: true
  },
  wifiDetails: {
    component: WifiDetails,
    title: 'wifi details',
    bottomStatusHidden: true
  },
  KnownWifi: {
    component: KnownWifi,
    bottomStatusHidden: true
  },
  deleteKnowWifiMenu: {
    component: DeleteWifiMenu,
    bottomStatusHidden: true
  },
  connectWifiMenu: {
    component: ConnectWifiMenu,
    title: 'connect to a new network',
    bottomStatusHidden: true
  },
  selectWifi: {
    component: SelectWifi,
    title: 'select wifi',
    bottomStatusHidden: true
  },
  connectWifiViaApp: {
    component: ConnectWifiViaApp,
    title: 'connect to wifi via app',
    bottomStatusHidden: true
  },
  enterWifiPassword: {
    component: EnterWifiPassword,
    bottomStatusHidden: true,
    parent: 'profileHome'
  },
  'quick-settings': {
    component: QuickSettings
  },
  heat_timeout_after_shot: {
    component: HeatTimeoutAfterShot,
    bottomStatusHidden: true
  },
  snake: {
    component: SnakeGame,
    parent: 'profileHome'
  },
  advancedSettings: {
    component: AdvancedSettings
  },
  manufacturingSettings: {
    component: Manufacturing
  },
  pressetProfileImage: {
    component: PressetProfileImage,
    title: getActiveProfilesTitle,
    bottomStatusHidden: true,
    parent: 'pressetSettings'
  },
  deviceInfo: {
    component: DeviceInfoScreen
  },
  updateChannel: {
    component: UpdateChannel
  },
  idleScreenSettings: {
    component: IdleScreenSetting
  },
  defaultProfiles: {
    component: DefaultProfiles,
    bottomStatusHidden: true,
    parent: 'profileHome'
  },
  defaultProfileDetails: {
    component: ProfileDetails,
    bottomStatusHidden: true
  },
  shot_history: {
    component: ShotGraphScreen,
    title: getActiveProfilesTitle,
    parent: 'profileHome',
    bottomStatusHidden: true
  },
  idle: {
    component: IdleScreen,
    bottomStatusHidden: true,
    ignoreAsPrevious: true
  },
  usbSettings: {
    component: USBSettings,
    bottomStatusHidden: true
  },
  brewSettings: {
    component: BrewSettings,
    bottomStatusHidden: true
  },
  scrollDirections: {
    component: ScrollDirectionSettings,
    bottomStatusHidden: true
  },
  brewComplete: {
    title: 'Brew complete',
    component: BrewCompleteScreen,
    bottomStatusHidden: true
  },
  factoryReset: {
    component: FactoryReset,
    bottomStatusHidden: true
  },
  displayAlignment: {
    component: DisplayAlignment,
    bottomStatusHidden: true
  },
  unlock: {
    component: UnlockScreen,
    bottomStatusHidden: true,
    ignoreAsPrevious: true
  }
};
