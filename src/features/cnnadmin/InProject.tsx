import { useEffect, type ReactNode } from 'react'
import { useProjectStore } from '../../lib/projects/project-store'

/**
 * Page propre à un projet : ouverte par un lien direct, elle bascule l'espace sur ce projet
 * (menus et en-tête suivent), au lieu de s'afficher sous un autre projet.
 */
export function InProject({ code, children }: { code: string; children: ReactNode }) {
  const currentProject = useProjectStore((s) => s.currentProject)
  const setProject = useProjectStore((s) => s.setProject)
  useEffect(() => {
    if (currentProject !== code) setProject(code)
  }, [code, currentProject, setProject])
  return currentProject === code ? <>{children}</> : null
}
