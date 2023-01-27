import React, { useEffect, useState } from 'react';
import { useAppSelector } from '../store/hooks';
import { ProfileNameWrapper } from './profileName.style';
import { getStyling } from './utils';

interface IProps {
  page?: any;
  name: string;
}

const ProfileName: React.FC<IProps> = (props) => {
  const [animationProps, setAnimationProps] = useState<any>({});
  const { name } = props;

  const { screenName } = useAppSelector((state) => state.screen);

  useEffect(() => {
    const styling = getStyling(screenName);
    setAnimationProps({ ...animationProps, ...styling });
  }, [screenName]);

  return (
    <ProfileNameWrapper initial={animationProps} animate={animationProps}>
      <div>{name}</div>
    </ProfileNameWrapper>
  );
};

export default ProfileName;
