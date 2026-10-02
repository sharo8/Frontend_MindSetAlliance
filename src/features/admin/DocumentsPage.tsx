import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '../../components/ui/button'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { PageHeader } from '../../components/ui/page-header'
import { Input } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { ApiError } from '../../lib/api/client'
import { archiveDocument, fetchDocuments, uploadDocument } from '../../lib/api/domain'
import { useProjectStore } from '../../lib/projects/project-store'

export function DocumentsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const currentProject = useProjectStore((s) => s.currentProject)
  const [titre, setTitre] = useState('')
  const [fichier, setFichier] = useState<File | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [archiveId, setArchiveId] = useState<number | null>(null)
  const [motif, setMotif] = useState('')

  const docs = useQuery({ queryKey: ['documents', currentProject], queryFn: fetchDocuments })
  const scoped = (docs.data ?? []).filter(
    (d) => currentProject === 'ENTREPRISE' || d.projectCode === currentProject || !d.projectCode,
  )
  const upload = useMutation({
    mutationFn: async () => {
      if (!titre.trim()) throw new ApiError('Le titre du document est obligatoire.', 400)
      if (!fichier) throw new ApiError('Un fichier est obligatoire.', 400)
      const form = new FormData()
      form.append('titre', titre.trim())
      form.append('fichier', fichier)
      if (currentProject && currentProject !== 'ENTREPRISE') {
        form.append('projectCode', currentProject)
      }
      return uploadDocument(form)
    },
    onSuccess: (result) => {
      setSuccess(result.message || `Document enregistré : ${result.titre}`)
      setError(null)
      setTitre('')
      setFichier(null)
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (err) => {
      setSuccess(null)
      setError(err instanceof ApiError ? err.message : 'L’enregistrement du document a échoué.')
    },
  })
  const archive = useMutation({
    mutationFn: () => archiveDocument(archiveId!, motif),
    onSuccess: (result) => {
      setSuccess(result.message)
      setArchiveId(null)
      setMotif('')
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Archivage impossible.'),
  })

  return (
    <div className="space-y-4">
      <PageHeader kicker={t('pages.documents.kicker')} title={t('pages.documents.title')} subtitle={t('pages.documents.subtitle')} />
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Enregistrer un document</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          <Input placeholder="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
          <input
            type="file"
            className="block w-full text-sm text-slate-500 dark:text-ma-gray-300"
            onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
          />
          {success && <Feedback tone="success">{success}</Feedback>}
          {error && <Feedback tone="danger">{error}</Feedback>}
          <Button disabled={upload.isPending} onClick={() => upload.mutate()}>
            {upload.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Documents disponibles</h2>
        </CardHeader>
        <CardBody className="space-y-2 text-sm text-slate-600 dark:text-ma-gray-300">
          {docs.isError && (
            <Feedback tone="danger">Impossible de charger les documents. Vérifiez vos droits ou réessayez.</Feedback>
          )}
          {scoped.map((d) => (
            <p key={d.id}>
              {d.titre} {d.projectCode ? `· ${d.projectCode}` : ''} — {d.nomFichier} ({d.statut ?? 'ACTIF'})
              {d.statut !== 'ARCHIVE' && (
                <Button variant="outline" className="ml-2" onClick={() => { setArchiveId(d.id); setMotif('') }}>
                  Archiver
                </Button>
              )}
            </p>
          ))}
          {!docs.isLoading && scoped.length === 0 && <p>Aucune donnée pour ce contexte.</p>}
        </CardBody>
      </Card>
      <Modal
        open={archiveId != null}
        onClose={() => setArchiveId(null)}
        title="Archiver le document"
        footer={(
          <>
            <Button variant="outline" onClick={() => setArchiveId(null)}>Fermer</Button>
            <Button disabled={!motif.trim() || archive.isPending} onClick={() => archive.mutate()}>Confirmer</Button>
          </>
        )}
      >
        <Input placeholder="Motif d’archivage" value={motif} onChange={(e) => setMotif(e.target.value)} />
      </Modal>
    </div>
  )
}
