import { useEffect, useState } from 'react';
import { Profile } from '@meticulous-home/espresso-profile';
import { api } from '../../api/api';

import {
  addNewImageProfile,
  selectByProfileId
} from '../store/features/images/images-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

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

type IProfileImage = Profile & Partial<{ borderColor: string; image: string }>;

export const ProfileImage = ({ preset }: { preset: IProfileImage }) => {
  const API_URL = window.env?.SERVER_URL || 'http://localhost:8080';
  const pImage =
    useAppSelector((state) => selectByProfileId(state, preset.id.toString())) ||
    null;
  const dispatch = useAppDispatch();
  const { value: presets } = useAppSelector((state) => state.presets);
  const currentIndex = presets.findIndex((e) => preset.id === e.id) + 1;
  const presetIndex = currentIndex % cLength || cLength;
  const [image, setImage] = useState(
    preset.display?.image
      ? `${API_URL}${api.getProfileImageUrl(preset.display.image)}`
      : (pImage?.image ?? `assets/images/${presetIndex}.png`)
  );

  const borderStyle = preset.display?.accentColor
    ? `7px solid ${preset.display?.accentColor}`
    : `7px solid #e0dcd0`;

  useEffect(() => {
    dispatch(
      addNewImageProfile({
        presetId: preset.id.toString(),
        borderColor: borderStyle,
        image
      })
    );
  }, [preset.id, image]);

  useEffect(() => {
    setImage(
      preset.display?.image
        ? `${API_URL}${api.getProfileImageUrl(preset.display.image)}`
        : (pImage?.image ?? `assets/images/${presetIndex}.png`)
    );
  }, [preset.display?.image]);

  return (
    <img
      src={image}
      alt="No image"
      width="164"
      height="164"
      className="profile-image"
      onError={() => setImage(`assets/images/${presetIndex}.png`)}
      style={{ border: borderStyle }}
    />
  );
};
