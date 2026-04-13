import { motion } from 'framer-motion'

export function AppLoader() {
  return (
    <motion.div
      className="app-loader"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="app-loader__orb app-loader__orb--one" />
      <div className="app-loader__orb app-loader__orb--two" />
      <motion.div
        className="app-loader__panel"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      >
        <motion.div
          className="app-loader__logo-wrap"
          initial={{ opacity: 0, y: 10, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.08, ease: 'easeOut' }}
        >
          <div className="app-loader__logo">
            <div className="app-loader__logo-core">
              <span className="app-loader__logo-ring app-loader__logo-ring--outer" />
              <span className="app-loader__logo-ring app-loader__logo-ring--mid" />
              <span className="app-loader__logo-ring app-loader__logo-ring--inner" />
              <span className="app-loader__logo-dot" />
            </div>
          </div>
        </motion.div>
        <p className="app-loader__eyebrow">VisionOS Experience</p>
        <h1 className="app-loader__title">
          <span>Attendance Management</span>
          <span>System</span>
        </h1>
        <p className="app-loader__subtitle">
          Loading the face recognition attendance workspace with secure analytics, live verification, and smart dashboards.
        </p>
        <div className="app-loader__progress-row">
          <div className="app-loader__progress">
            <motion.span
              className="app-loader__progress-bar"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.35, ease: 'easeInOut' }}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
