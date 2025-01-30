import { ComponentType } from 'react';
import { Barometer } from '../components/Barometer/Barometer';
import { Pressets } from '../components/Pressets/Pressets';
import { Scale } from '../components/Scale/Scale';
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
import { getTitlePressets } from '../components/Pressets/TitlePressets';
import { ConnectWifiViaApp } from '../components/Wifi/ConnetWifiViaApp';
import { OSStatus } from '../components/OSStatus/OSStatus';
import { QuickSettings } from '../../src/components/QuickSettings/QuickSettings';
import { SnakeGame } from '../../src/components/Snake/Snake';
import { KnownWifi } from '../../src/components/Wifi/KnownWifi';
import { DeleteWifiMenu } from '../components/Wifi/DeleteWifiMenu';
import { AdvancedSettings } from '../components/Settings/Advanced/Advanced';
import { WifiQrMenu } from '../../src/components/Wifi/WifiQrMenu';
import { PressetProfileImage } from '../../src/components/Pressets/PressetProfileImage';
import { DeviceInfoScreen } from '../components/Settings/Advanced/DeviceInfoScreen';
import { DefaultProfiles } from '../components/Pressets/DefaultProfiles';
import { DefaultProfileDetails } from '../../src/components/Pressets/DefaultProfileDetails';
import { PurgePiston } from '../components/PurgePiston/PurgePiston';
import { UpdateChannel } from '../components/Settings/Advanced/UpdateChannel';
import { ReadyAnimation } from '../components/ReadyAnimation/ReadyAnimation';
import { HeatTimeoutAfterShot } from '../components/HeatTimeoutAfterShot/HeatTimeoutAfterShot';
import { IdleScreen } from '../components/IdleScreen/IdleScreen';
import { Heating } from '../components/Heating/Heating';
import { TimeDate } from '../components/Settings/Advanced/TimeDate/TimeDateConfig';
import { TimeZoneConfig } from '../components/Settings/Advanced/TimeDate/TimeZone/TimeZoneConfig';
import SelectLetterCountry from '../components/Settings/Advanced/TimeDate/TimeZone/SelectLetterCountry';
import CountrySettings from '../components/Settings/Advanced/TimeDate/TimeZone/CountrySettings';
import TimeZoneSettings from '../components/Settings/Advanced/TimeDate/TimeZone/TimeZoneSettings';
import { IdleScreenSetting } from '../components/Settings/Advanced/IdleScreenSetting';

import CalibrateScale from '../components/Scale/CalibrateScale';
import { USBSettings } from '../components/Settings/USBSettings';
import { BrewSettings } from '../components/Settings/BrewSettings';

interface Route {
  component: ComponentType;
  parentTitle?: string | ((state: RootState) => string) | (() => JSX.Element);
  title?: string | ((state: RootState) => string);
  titleShared?: boolean;
  parent?: ScreenType;
  bottomStatusHidden?: boolean;
  bottomTitle?: string;
  props?: object;
  animationDirectionFrom?: Partial<Record<ScreenType, 'in' | 'out'>>;
}

const selectActivePresetName = (state: RootState) =>
  state.presets.activePreset.name;

// Profile from "start" event may not exist in LCD. Prefer using
// that profile name over selected preset
const selectStatProfileName = (state: RootState) =>
  state.stats.profile || state.presets.activePreset.name;

export const routes: Record<ScreenType, Route> = {
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
  OSStatus: {
    component: OSStatus,
    title: 'OSStatus',
    bottomStatusHidden: true
  },
  ready: {
    component: ReadyAnimation,
    bottomStatusHidden: true
  },
  settings: {
    component: Settings,
    title: 'settings',
    bottomStatusHidden: true
  },
  scale: {
    component: Scale,
    title: 'scale',
    bottomStatusHidden: true,
    parent: 'pressets'
  },
  pressets: {
    component: Pressets,
    parentTitle: getTitlePressets,
    title: null
  },
  barometer: {
    component: Barometer,
    parentTitle: null,
    title: selectStatProfileName,
    bottomStatusHidden: true,
    animationDirectionFrom: {
      'manual-purge': 'in',
      heating: 'in'
    }
  },
  pressetSettings: {
    component: PressetSettings,
    title: selectActivePresetName,
    bottomStatusHidden: true,
    parent: 'pressets'
  },
  pressure: {
    component: SettingNumerical,
    title: selectActivePresetName,
    bottomTitle: 'pressure',
    props: {
      type: 'pressure'
    },
    bottomStatusHidden: true,
    parent: 'pressetSettings'
  },
  time: {
    component: SettingNumerical,
    title: selectActivePresetName,
    bottomTitle: 'time',
    props: {
      type: 'time'
    },
    bottomStatusHidden: true,
    parent: 'pressetSettings'
  },
  weight: {
    component: SettingNumerical,
    title: selectActivePresetName,
    bottomTitle: 'weight',
    props: {
      type: 'weight'
    },
    bottomStatusHidden: true,
    parent: 'pressetSettings'
  },
  flow: {
    component: SettingNumerical,
    title: selectActivePresetName,
    bottomTitle: 'flow',
    props: {
      type: 'flow'
    },
    bottomStatusHidden: true,
    parent: 'pressetSettings'
  },

  temperature: {
    component: SettingNumerical,
    title: selectActivePresetName,
    bottomTitle: 'temperature',
    props: {
      type: 'temperature'
    },
    bottomStatusHidden: true,
    parent: 'pressetSettings'
  },
  output: {
    title: selectActivePresetName,
    component: SettingNumerical,
    bottomTitle: 'output',
    props: {
      type: 'output'
    },
    bottomStatusHidden: true,
    parent: 'pressetSettings'
  },
  'manual-purge': {
    component: PurgePiston,
    bottomStatusHidden: true,
    animationDirectionFrom: {
      barometer: 'in'
    }
  },
  heating: {
    component: Heating,
    title: selectActivePresetName,
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
    parentTitle: selectActivePresetName,
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
    bottomStatusHidden: true
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
    parent: 'pressets'
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
    parent: 'pressets'
  },
  advancedSettings: {
    component: AdvancedSettings
  },
  pressetProfileImage: {
    component: PressetProfileImage,
    title: selectActivePresetName,
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
    parent: 'pressets'
  },
  defaultProfileDetails: {
    component: DefaultProfileDetails,
    bottomStatusHidden: true
  },
  idle: {
    component: IdleScreen,
    bottomStatusHidden: true
  },
  usbSettings: {
    component: USBSettings,
    bottomStatusHidden: true
  },
  brewSettings: {
    component: BrewSettings,
    bottomStatusHidden: true
  }
};
