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
import { CircleKeyboard } from '../components/CircleKeyboard/CircleKeyboard';
import { RootState } from '../components/store/store';
import { Notification } from '../components/Notification/Notification';

interface Route {
  component: ComponentType;
  parentTitle?: string | ((state: RootState) => string);
  title?: string | ((state: RootState) => string);
  titleShared?: boolean;
  parent?: ScreenType;
  bottomStatusHidden?: boolean;
  props?: object;
}

const selectActivePresetName = (state: RootState) =>
  state.presets.activePreset.name;

const activePresset = (state: RootState) =>
  state.screen.prev !== 'pressets' && state.presets.option === 'HOME'
    ? '   '
    : state.presets.value[state.presets.activeIndexSwiper]
    ? state.presets.value[state.presets.activeIndexSwiper].name
    : '';

// state.presets.value[state.presets.activeIndexSwiper]
//   ? state.presets.value[state.presets.activeIndexSwiper].name
//   : '';

const selectPressetTitle = (state: RootState) =>
  state.presets.option === 'HOME' ? state.presets.activePreset.name : 'Catalog';

const selectActivePresetNamePressetScreen = (state: RootState) =>
  state.presets.option === 'HOME' ? null : selectActivePresetName(state);

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
    title: selectStatProfileName,
    titleShared: true,
    bottomStatusHidden: true
  },
  pressetSettings: {
    component: PressetSettings,
    title: selectActivePresetName
  },
  pressure: {
    component: SettingNumerical,
    title: 'pressure',
    parent: 'pressetSettings',
    props: {
      type: 'pressure'
    }
  },
  temperature: {
    component: SettingNumerical,
    title: 'temperature',
    parent: 'pressetSettings',
    props: {
      type: 'temperature'
    }
  },
  output: {
    component: SettingNumerical,
    title: 'output',
    parent: 'pressetSettings',
    props: {
      type: 'output'
    }
  },
  purge: {
    component: Purge,
    title: 'purge',
    parent: 'pressetSettings'
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
    component: CircleKeyboard,
    bottomStatusHidden: true
  },
  'pre-infusion': {
    component: OnOff,
    title: 'pre-infusion',
    parent: 'pressetSettings',
    props: {
      type: 'pre-infusion'
    }
  },
  'pre-heat': {
    component: OnOff,
    title: 'pre-heat',
    parent: 'pressetSettings',
    props: {
      type: 'pre-heat'
    }
  },
  notifications: {
    component: Notification,
    bottomStatusHidden: true
  }
};
