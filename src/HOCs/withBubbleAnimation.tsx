import React from 'react';
import { motion } from 'framer-motion';

const withBubbleAnimation =
  (Component: any, isScaleIn = false) =>
  (props: any) => {
    const { ...rest } = props;
    const initial = { opacity: 0, scale: 0.8 };
    if (isScaleIn) {
      initial.scale = 1.5;
    }
    return (
      <motion.div
        /*initial={initial}
        animate={{ opacity: 1, scale: 1 }}
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
        }}*/
        style={{ scale: 0.1, opacity: 0.1, width: 464, height: 464 }}
        transition={{ duration: 0.6, scale: { type: 'spring', damping: 9 } }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <Component {...rest} />
      </motion.div>
    );
  };
export default withBubbleAnimation;
