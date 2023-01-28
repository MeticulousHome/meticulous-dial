import React from 'react';
import { motion } from 'framer-motion';

const withAppearAnimation = (Component: any) => (props: any) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      // exit={{ opacity: 0.1 }}
    >
      <Component {...props} />
    </motion.div>
  );
};
export default withAppearAnimation;
