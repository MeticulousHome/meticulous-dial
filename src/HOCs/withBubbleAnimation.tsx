import React from 'react';
import { motion } from 'framer-motion';

const withBubbleAnimation =
  ({
    Component,
    extraClass,
    isScaleIn,
    delay,
    activeOpacity,
    inactiveOpacity,
    activeTimes,
    inactiveTimes
  }: {
    Component: any;
    isScaleIn?: boolean;
    extraClass?: string;
    delay?: number;
    activeOpacity: number[];
    inactiveOpacity: number[];
    activeTimes: number[];
    inactiveTimes: number[];
  }) =>
  (props: any) => {
    const { isActive, ...rest } = props;
    const initial = { opacity: 0, scale: 0, zIndex: 0 };
    if (isScaleIn) {
      initial.scale = 2.3;
    }
    return (
      <motion.div
        className={`${extraClass ? extraClass : ''}`}
        style={{
          overflow: 'hidden'
        }}
        initial={initial}
        animate={{
          opacity: isActive ? activeOpacity : inactiveOpacity,
          scale: isActive ? 1 : initial.scale
        }}
        transition={{
          default: {
            duration: 0.2,
            ease: [0, 0.71, 0.2, 1.01]
          },
          times: isActive ? activeTimes : inactiveTimes,
          scale: {
            type: 'spring',
            damping: 9,
            stiffness: 80,
            restDelta: 0.001
          },
          delay: delay ? delay : 0
        }}
      >
        <Component {...rest} />
      </motion.div>
    );
  };
export default withBubbleAnimation;
