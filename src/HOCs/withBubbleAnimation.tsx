import React from 'react';
import { motion } from 'framer-motion';

const withBubbleAnimation =
  (Component: any, isScaleIn = false) =>
  (props: any) => {
    const { ...rest } = props;
    const initial = { opacity: 0.1, scale: 0.5 };
    if (isScaleIn) {
      initial.scale = 1.7;
      initial.opacity = 1;
    }
    return (
      <motion.div
        /*initial={initial}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          scale: {
            duration: 2,
            type: 'spring'
            // damping: 9,
            // stiffness: 80,
            // restDelta: 0.001
          }
        }}*/
        initial={initial}
        style={{ width: 480, height: 480 }}
        transition={{
          duration: 0.1,
          scale: { type: 'spring', damping: 9, stiffness: 150 }
        }}
        exit={{ opacity: 0.2 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <Component {...rest} />
      </motion.div>
    );
  };
export default withBubbleAnimation;
