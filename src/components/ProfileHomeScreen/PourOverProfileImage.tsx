import { useEffect, useState } from 'react';
import { styled } from 'styled-components';
import { FreePourIcon } from '../../features/freePour/FreePourIcon';
import { getPourOverProfileImageUrl } from '../../features/freePour/profileApi';
import { PourOverProfile } from '../../features/freePour/types';
import { PROFILE_IMAGE_SIZE } from './ProfileImage';

const Image = styled.img`
  width: ${PROFILE_IMAGE_SIZE}px;
  height: ${PROFILE_IMAGE_SIZE}px;
  flex-shrink: 0;
  border-radius: 3.018px;
  object-fit: cover;
`;

/** Loads only nearby card images; a missing/old endpoint keeps the icon. */
export const PourOverProfileImage = ({
  profile,
  enabled
}: {
  profile: PourOverProfile;
  enabled: boolean;
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [profile.id]);

  if (!enabled || failed) return <FreePourIcon />;

  return (
    <Image
      src={getPourOverProfileImageUrl(profile.id)}
      alt=""
      onError={() => setFailed(true)}
    />
  );
};
