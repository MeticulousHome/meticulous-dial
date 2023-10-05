import { KIND_PROFILE } from '../constants';
import { IItalian, Actions, PressetSettings } from '../types/index';

interface PayloadProps {
  presset: PressetSettings;
  action: Actions;
}

const getKeyPresset = (presset: PressetSettings, key: string) => {
  return presset.settings.find((item) => item.key === key);
};

export const generateSimplePayload = ({
  presset,
  action
}: PayloadProps): IItalian => {
  const temperature = getKeyPresset(presset, 'temperature');
  const preinfusion = getKeyPresset(presset, 'pre-infusion');
  const preheat = getKeyPresset(presset, 'pre-heat');
  const pressure = getKeyPresset(presset, 'pressure');
  const purge = getKeyPresset(presset, 'purge');
  const output = getKeyPresset(presset, 'output');

  return {
    action,
    name: presset.name,
    kind: KIND_PROFILE.ITALIAN,
    automatic_purge: purge?.value === 'automatic',
    temperature: Number(temperature.value),
    preinfusion: preinfusion?.value === 'yes',
    preheat: preheat?.value === 'yes',
    pressure: Number(pressure.value),
    out_weight: Number(output.value),
    source: 'lcd'
  };
};
