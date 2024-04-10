import { useAppSelector } from '../store/hooks';
import { IPreset } from '../../../src/types';

const colors: string[] = [
  '#FFFFFF',
  '#7E9970',
  '#FF5E5E',
  '#2F3C61',
  '#FC5217',
  '#3D1E2E',
  '#74AFD3',
  '#212630',
  '#9A9EAD',
  '#7B6B85',
  '#281E35',
  '#A6C8C6',
  '#81B5A9',
  '#8D7D5C',
  '#547D98',
  '#485434',
  '#1F254F',
  '#86C4B5',
  '#AA7A55',
  '#8CC4DB',
  '#5FAD92',
  '#313E38',
  '#ADC1D3',
  '#A7A27A',
  '#FA8888',
  '#9CAEA0'
];
const cLength = colors.length - 1;
export const ProfileImage = ({ preset }: { preset: IPreset }) => {
  const { value: presets } = useAppSelector((state) => state.presets);

  const currentIndex = presets.findIndex((e) => preset.id === e.id) + 1;
  const presetIndex = currentIndex % cLength || cLength;

  return (
    <img
      src={preset.image || `assets/images/${presetIndex}.png`}
      alt="image-profile"
      width="164"
      height="164"
      className="profile-image"
      style={{
        border: `7px solid ${preset.borderColor || colors[presetIndex]}`
      }}
    />
  );
};
