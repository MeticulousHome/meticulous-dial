import { useEffect, useState } from 'react';
import { Profile } from '@meticulous-home/espresso-profile';
import { api } from '../../api/api';

export const PROFILE_IMAGE_SIZE = 164;

import { styled } from 'styled-components';

const Image = styled.img`
  flex-shrink: 0;
  border-radius: 3.018px;
  background-position: center;
  background-repeat: no-repeat;
`;

export const ProfileImage = ({ profile: preset }: { profile: Profile }) => {
  const API_URL = window.env?.SERVER_URL || 'http://localhost:8080';

  const [image, setImage] = useState(
    preset.display?.image &&
      `${API_URL}${api.getProfileImageUrl(preset.display.image)}`
  );

  useEffect(() => {
    if (!preset.display?.image) {
      return;
    }
    setImage(
      preset.display?.image &&
        `${API_URL}${api.getProfileImageUrl(preset.display.image)}`
    );
  }, [preset.display?.image]);

  return (
    <Image
      src={image}
      alt="No image"
      width={PROFILE_IMAGE_SIZE}
      height={PROFILE_IMAGE_SIZE}
    />
  );
};
