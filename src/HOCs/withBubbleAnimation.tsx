import React from 'react';
import { motion } from 'framer-motion';

const withBubbleAnimation =
  ({
    Component,
    extraClass,
    isScaleIn
  }: {
    Component: any;
    isScaleIn?: boolean;
    extraClass?: string;
  }) =>
  (props: any) => {
    const { isActive, ...rest } = props;
    const initial = { opacity: 0, scale: 0 };
    if (isScaleIn) {
      initial.scale = 2.5;
    }
    return (
      <motion.div
        className={`${extraClass ? extraClass : ''}`}
        initial={initial}
        animate={{
          opacity: isActive ? 1 : initial.opacity,
          scale: isActive ? 1 : initial.scale
        }}
        transition={{
          default: {
            duration: 0.1,
            ease: [0, 0.71, 0.2, 1.01]
          },
          scale: {
            type: 'spring',
            damping: 9,
            stiffness: 80,
            restDelta: 0.001
          }
        }}
      >
        <Component {...rest} />
      </motion.div>
    );
  };
export default withBubbleAnimation;
