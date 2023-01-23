import { motion } from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { ScreenName } from '../../types';
import { useAppSelector } from '../store/hooks';
import { ProfileNameWrapper } from './profileName.style';
import { getStyling } from './utils';

interface IProps {
  page?: any;
  name: string;
}

const ProfileName: React.FC<IProps> = (props) => {
  const [scale, setScale] = useState(1);
  const { name } = props;

  const { screenName } = useAppSelector((state) => state.screen);
  const styling = getStyling(screenName);

  useEffect(() => {
    if (screenName === ScreenName.INFO) {
      setScale(1);
    } else {
      setScale(1.5);
    }
  }, [screenName]);

  return (
    <motion.div initial={{ scale: 1 }} animate={{ scale }}>
      <ProfileNameWrapper {...styling}>
        <div>{name}</div>
      </ProfileNameWrapper>
    </motion.div>
  );
};

export default ProfileName;
