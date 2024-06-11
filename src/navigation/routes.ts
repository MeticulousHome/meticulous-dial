import { ComponentType } from 'react';
import { Barometer } from '../components/Barometer/Barometer';
import { Pressets } from '../components/Pressets/Pressets';
import { Scale } from '../components/Scale/Scale';
import { PressetSettings } from '../components/PressetSettings/PressetSettings';
import { SettingNumerical } from '../components/SettingNumerical/SettingNumerical';
import { OnOff } from '../components/OnOff/OnOff';
import { Purge } from '../components/Purge/Purge';
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
import { ConnectWifi } from '../components/Wifi/ConnectWifi';
import { QuickSettings } from '../../src/components/QuickSettings/QuickSettings';
import { QuickPreheat } from '../../src/components/Preheat/Preheat';
import { SnakeGame } from '../../src/components/Snake/Snake';
import { KnownWifi } from '../../src/components/Wifi/KnownWifi';
import { DeleteWifiMenu } from '../components/Wifi/DeleteWifiMenu';
import { DeletedWifi } from '../components/Wifi/DeletedWifi';
import { WifiSettingsSave } from '../components/Wifi/WifiSettingsSave';
import { AdvancedSettings } from '../components/Settings/Advanced';
import { WifiQrMenu } from '../../src/components/Wifi/WifiQrMenu';

interface Route {
  component: ComponentType;
  parentTitle?: string | ((state: RootState) => string) | (() => JSX.Element);
  title?: string | ((state: RootState) => string);
  titleShared?: boolean;
  parent?: ScreenType;
  bottomStatusHidden?: boolean;
  bottomTitle?: string;
  props?: object;
}

const selectActivePresetName = (state: RootState) =>
  state.presets.activePreset.name;

// Profile from "start" event may not exist in LCD. Prefer using
// that profile name over selected preset
const selectStatProfileName = (state: RootState) =>
  state.stats.profile || state.presets.activePreset.name;

export const routes: Record<ScreenType, Route> = {
  settings: {
    component: Settings,
    title: 'settings',
    bottomStatusHidden: true
  },
  scale: {
    component: Scale,
    title: 'scale',
    bottomStatusHidden: true
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
    // titleShared: true,
    bottomStatusHidden: true
  },
  pressetSettings: {
    component: PressetSettings,
    title: selectActivePresetName,
    bottomStatusHidden: true
  },
  pressure: {
    component: SettingNumerical,
    title: selectActivePresetName,
    bottomTitle: 'pressure',
    props: {
      type: 'pressure'
    },
    bottomStatusHidden: true
  },
  time: {
    component: SettingNumerical,
    title: selectActivePresetName,
    bottomTitle: 'time',
    props: {
      type: 'time'
    },
    bottomStatusHidden: true
  },
  weight: {
    component: SettingNumerical,
    title: selectActivePresetName,
    bottomTitle: 'weight',
    props: {
      type: 'weight'
    },
    bottomStatusHidden: true
  },
  flow: {
    component: SettingNumerical,
    title: selectActivePresetName,
    bottomTitle: 'flow',
    props: {
      type: 'flow'
    },
    bottomStatusHidden: true
  },

  temperature: {
    component: SettingNumerical,
    title: selectActivePresetName,
    bottomTitle: 'temperature',
    // parent: 'pressetSettings',
    props: {
      type: 'temperature'
    },
    bottomStatusHidden: true
  },
  output: {
    title: selectActivePresetName,
    component: SettingNumerical,
    bottomTitle: 'output',
    // parent: 'pressetSettings',
    props: {
      type: 'output'
    },
    bottomStatusHidden: true
  },
  purge: {
    component: Purge,
    title: selectActivePresetName
  },
  dose: {
    component: () => null, // Multiple choice to be implemented
    title: 'dose',
    parent: 'pressetSettings'
  },
  ratio: {
    component: () => null, // Multiple choice to be implemented
    title: 'ratio',
    parent: 'pressetSettings'
  },
  name: {
    component: EditNameScreen,
    bottomStatusHidden: true
  },
  'pre-infusion': {
    component: OnOff,
    title: selectActivePresetName,
    props: {
      type: 'pre-infusion'
    }
  },
  'pre-heat': {
    component: OnOff,
    title: selectActivePresetName,
    // parent: 'pressetSettings',
    props: {
      type: 'pre-heat'
    }
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
  deletedWifi: {
    component: DeletedWifi,
    bottomStatusHidden: true
  },
  wifiSettingsSave: {
    component: WifiSettingsSave,
    bottomStatusHidden: true
  },
  connectWifiMenu: {
    component: ConnectWifiMenu,
    title: 'connect to a new network',
    bottomStatusHidden: true
  },
  connectWifi: {
    component: ConnectWifi,
    title: 'connecting...',
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
    bottomStatusHidden: true
  },
  'quick-settings': {
    component: QuickSettings
  },
  'quick-preheat': {
    component: QuickPreheat
  },
  snake: {
    component: SnakeGame
  },
  advancedSettings: {
    component: AdvancedSettings
  }
};
