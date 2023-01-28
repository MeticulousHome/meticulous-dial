import React from 'react';
import { motion } from 'framer-motion';

const withBubbleAnimation =
  (Component: any, isScaleIn = false) =>
  (props: any) => {
    const { ...rest } = props;
    const initial = { opacity: 0.1, scale: 0.4 };
    if (isScaleIn) {
      initial.scale = 1.6;
    }
    return (
      <motion.div
        initial={initial}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          scale: {
            duration: 2,
            type: 'spring'
            // damping: 9,
            // stiffness: 80,
            // restDelta: 0.001
          }
        }}
        exit={{ opacity: 0.2 }}
      >
        <Component {...rest} />
      </motion.div>
    );
  };
export default withBubbleAnimation;
