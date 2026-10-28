import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../../styles/admin/DashboardLoader.css';

// Vite resolves this import at build time — fails loudly if path is wrong
import loaderLogo from '../../img/loaderLogo.svg';

const DashboardLoader = ({ loading, text = 'Loading...' }) => {
  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          className="grv-dash-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.img
            src={loaderLogo}
            alt="Loading"
            className="grv-dash-loader-logo-img"
            animate={{
              scale: [1, 1.08, 1],
              opacity: [0.6, 1, 0.6],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            draggable={false}
          />
          <p className="grv-dash-loader-text">{text}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DashboardLoader;