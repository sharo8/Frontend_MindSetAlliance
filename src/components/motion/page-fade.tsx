import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { spring } from './springs'

/** Entrée de page : légère montée, fondu et mise au point (flou → net). */
export function PageFade({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()
  if (reduce) return <div>{children}</div>
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.985, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none', transform: 'none' } }}
      transition={{ ...spring.page, opacity: { duration: 0.3 }, filter: { duration: 0.34 } }}
    >
      {children}
    </motion.div>
  )
}

/** Apparition échelonnée d'une liste ou d'une grille de cartes. */
export function Stagger({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 16, scale: 0.985 },
        show: { opacity: 1, y: 0, scale: 1, transition: spring.page },
      }}
    >
      {children}
    </motion.div>
  )
}
