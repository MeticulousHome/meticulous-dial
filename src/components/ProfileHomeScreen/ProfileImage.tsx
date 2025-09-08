import { useEffect, useRef, useState } from 'react';
import { Profile } from '@meticulous-home/espresso-profile';
import { api, API_URL } from '../../api/api';

export const PROFILE_IMAGE_SIZE = 164;

import { styled } from 'styled-components';

const Image = styled.img`
  flex-shrink: 0;
  border-radius: 3.018px;
  background-position: center;
  background-repeat: no-repeat;
`;

export const ProfileImage = ({
  profile: preset,
  onEnteringViewport,
  onExitingViewport
}: {
  profile: Profile;
  onEnteringViewport: () => void;
  onExitingViewport: () => void;
}) => {
  const [image, setImage] = useState(
    preset.display?.image &&
      `${API_URL}${api.getProfileImageUrl(preset.display.image)}`
  );
  const [isVisible, setIsVisible] = useState(false);
  const oldIsVisible = useRef<boolean>(false);

  const imgRef = useRef(null);

  useEffect(() => {
    if (!preset.display?.image) {
      return;
    }
    setImage(
      preset.display?.image &&
        `${API_URL}${api.getProfileImageUrl(preset.display.image)}`
    );
  }, [preset.display?.image]);

  useEffect(() => {
    onEnteringViewport();
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible((prev) => {
          oldIsVisible.current = prev;
          return entry.isIntersecting;
        });
      },
      {
        root: null, // viewport
        rootMargin: '0px', // no margin
        threshold: 0 // 50% of target visible
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    // Clean up the observer
    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible && oldIsVisible.current) {
      onExitingViewport();
    }
  }, [isVisible]);

  return (
    <Image
      ref={imgRef}
      src={image}
      alt="No image"
      width={PROFILE_IMAGE_SIZE}
      height={PROFILE_IMAGE_SIZE}
    />
  );
};
