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
import { ConnectWifi } from '../components/Wifi/ConnectWifi';
import { WifiSettings } from './../components/Wifi/WifiSettings';
import { SelectWifi } from '../components/Wifi/SelectWifi';
import { EnterWifiPassword } from '../components/Wifi/EnterWifiPassword';
import { WifiDetails } from '../components/Wifi/WifiDetails';
import { RootState } from '../components/store/store';
import { Notification } from '../components/Notification/Notification';

interface Route {
  component: ComponentType;
  parentTitle?: string | ((state: RootState) => string);
  title?: string | ((state: RootState) => string);
  titleShared?: boolean;
  parent?: ScreenType;
  bottomStatusHidden?: boolean;
  bottomTitle?: string;
  props?: object;
}

const selectActivePresetName = (state: RootState) =>
  state.presets.activePreset.name;

const activePresset = (state: RootState) =>
  state.screen.prev !== 'pressets' && state.presets.option === 'HOME'
    ? ''
    : state.presets.value[state.presets.activeIndexSwiper]
    ? state.presets.value[state.presets.activeIndexSwiper].name
    : '';

// state.presets.value[state.presets.activeIndexSwiper]
//   ? state.presets.value[state.presets.activeIndexSwiper].name
//   : '';

const selectPressetTitle = (state: RootState) =>
  state.presets.option === 'HOME' ? state.presets.activePreset.name : 'Catalog';

// const selectActivePresetNamePressetScreen = (state: RootState) =>
//   state.presets.option === 'HOME' ? null : selectActivePresetName(state);

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
    parentTitle: selectPressetTitle,
    title: activePresset
  },
  barometer: {
    component: Barometer,
    parentTitle: null,
    title: selectActivePresetName || selectStatProfileName,
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
    // parent: 'pressetSettings',
    // parentTitle: null,
    props: {
      type: 'pressure'
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
  wifiDetails: {
    component: WifiDetails,
    title: 'wifi details',
    bottomStatusHidden: true
  },
  connectWifi: {
    component: ConnectWifi,
    title: 'connect to a new network',
    bottomStatusHidden: true
  },
  selectWifi: {
    component: SelectWifi,
    title: 'select wifi',
    bottomStatusHidden: true
  },
  enterWifiPassword: {
    component: EnterWifiPassword,
    bottomStatusHidden: true
  }
};
