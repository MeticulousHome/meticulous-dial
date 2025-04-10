import { Profile, Variable } from '@meticulous-home/espresso-profile/dist';
import { IPresetAction, IPresetBaseNumerical, IPresetSetting } from '../types';
import { StaticAction } from '../constants/setting';

export const generateStaticActions = (
  settings: StaticAction[],
  length: number
) => {
  const actions: IPresetAction[] = settings.map((action, index) => ({
    ...action,
    id: length + index + 1,
    isInternal: true
  }));
  return actions;
};

/**
 * Receives a `profile` and returns it with the `settings[]` property added. The content of this property is adjusted according to the variables that the profile contains.
 * @param {Profile} profile - Profile to which you will add the settings.
 * @returns {ProfileValue} profile modified with the `settings[]` property added.
 */
export const addSettingsToProfile = (profile: Profile) => {
  const p = {
    ...profile,
    settings: [
      {
        id: 1,
        type: 'text',
        key: 'name',
        label: 'name',
        value: profile.name,
        isInternal: true
      },
      {
        id: 2,
        type: 'numerical',
        key: 'temperature',
        label: 'temperature',
        value: profile.temperature || 85,
        unit: '°c',
        isInternal: true
      },
      {
        id: 3,
        type: 'numerical',
        key: 'output',
        label: 'output',
        value: profile.final_weight || 36,
        unit: 'g',
        isInternal: true
      },
      {
        id: 4,
        type: 'image',
        key: 'image',
        label: 'Select image',
        value: profile.display.image.replace('/api/v1/profile/image/', ''),
        isInternal: true
      },
      ...addVariablesToSettings({
        variables: profile.variables,
        nextId: 5
      })
    ]
  };
  return {
    ...p,
    settings: [...(p.settings as IPresetSetting[])]
  };
};

export const addVariablesToSettings = ({
  variables,
  nextId
}: {
  variables: Variable[];
  nextId: number;
}) => {
  if (!variables) return [];
  if (!variables.length) return [];

  const settings: IPresetBaseNumerical[] = variables.map((variable, index) => ({
    id: index + nextId,
    type: 'numerical',
    isInternal: false,
    externalType: variable.type,
    key: variable.key,
    label: variable.name,
    value: variable.value
  }));

  return settings;
};

export const applySettingsToProfile = (
  profile: Profile,
  settings: IPresetSetting[]
) => {
  const nameSetting = settings.find(
    (setting) => setting.key === 'name' && setting.isInternal
  );
  const temperatureSetting = settings.find(
    (setting) => setting.key === 'temperature' && setting.isInternal
  );
  const weight = settings.find(
    (setting) => setting.key === 'output' && setting.isInternal
  );

  const display = settings.find(
    (setting) => setting.key === 'image' && setting.isInternal
  );

  const profileSettings =
    settings.filter((setting) => !setting.isInternal) || [];
  delete (profile as Profile & { settings: IPresetSetting[] }).settings;

  return {
    ...profile,
    name: nameSetting.value as string,
    display: {
      ...profile.display,
      image: display.value as string
    },
    temperature: temperatureSetting.value as number,
    final_weight: weight.value as number,
    variables: profileSettings.map((p) => ({
      name: p.label,
      key: p.key,
      type: p.externalType,
      value: p.value as number
    }))
  };
};
