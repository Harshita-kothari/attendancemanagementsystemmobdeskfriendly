import { motion } from 'framer-motion'

const pageTransition = {
  initial: { opacity: 0, y: 26, filter: 'blur(10px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -18,
    filter: 'blur(6px)',
    transition: { duration: 0.28, ease: 'easeInOut' },
  },
}

export function AnimatedPage({ children, routeKey }) {
  return (
    <motion.div
      key={routeKey}
      variants={pageTransition}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen"
    >
      {children}
    </motion.div>
  )
}
