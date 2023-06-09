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
import { store } from '../components/store/store';

interface Route {
  component: ComponentType;
  title?: string | (() => string);
  parent?: ScreenType;
  bottomStatusHidden?: boolean;
  props?: object;
}

export const routes: Record<ScreenType, Route> = {
  barometer: {
    component: Barometer,
    title: () => store.getState().presets.activePreset.name,
    parent: 'settings',
    bottomStatusHidden: true
  },
  pressets: {
    component: Pressets,
    title: 'pressets'
  },
  pressetSettings: {
    component: PressetSettings,
    title: () => store.getState().presets.activePreset.name,
    parent: 'barometer',
    bottomStatusHidden: true
  },
  scale: {
    component: Scale,
    title: 'scale',
    bottomStatusHidden: true
  },
  pressure: {
    component: SettingNumerical,
    title: 'pressure',
    parent: 'pressetSettings'
  },
  temperature: {
    component: SettingNumerical,
    title: 'temperature',
    parent: 'pressetSettings'
  },
  output: {
    component: SettingNumerical,
    title: 'output',
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
    title: 'name',
    parent: 'pressetSettings',
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
  purge: {
    component: Purge,
    title: 'purge',
    parent: 'settings'
  },
  settings: {
    component: Settings,
    title: 'settings',
    bottomStatusHidden: true
  }
};
