import type { Transition } from 'motion/react'

/** Ressorts partagés : mêmes sensations dans toute l'application (inspirés d'iOS). */
export const spring = {
  /** Réponse vive pour les petits éléments (pastilles, interrupteurs, onglets). */
  snappy: { type: 'spring', stiffness: 520, damping: 38, mass: 0.8 } satisfies Transition,
  /** Ouverture des fenêtres au centre. */
  modal: { type: 'spring', stiffness: 380, damping: 32, mass: 0.9 } satisfies Transition,
  /** Feuilles qui montent du bas sur téléphone. */
  sheet: { type: 'spring', stiffness: 340, damping: 36 } satisfies Transition,
  /** Menus et panneaux flottants. */
  popover: { type: 'spring', stiffness: 460, damping: 34, mass: 0.7 } satisfies Transition,
  /** Goutte de verre liquide : se déplace avec un léger rebond (pastilles, onglets). */
  liquid: { type: 'spring', stiffness: 400, damping: 24, mass: 0.85 } satisfies Transition,
  /** Morphose d'un menu qui sort de son bouton. */
  morph: { type: 'spring', stiffness: 520, damping: 34, mass: 0.75 } satisfies Transition,
  /** Transitions de page douces. */
  page: { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 } satisfies Transition,
}

export const easeIOS = [0.32, 0.72, 0, 1] as const
