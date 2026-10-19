import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState, type DragEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Archive,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  FolderOpen,
  Loader2,
  UploadCloud,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Badge, sentence } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { IconTile, type IconTone } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { PageHeader } from '../../components/ui/page-header'
import { Input, Textarea } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { EmptyState, ScopeEmpty } from '../../components/ui/scope-empty'
import { Segmented } from '../../components/ui/segmented'
import { IconAction, RowActions, Table, TableCard, TBody, Td, Th, THead, Tr } from '../../components/ui/table'
import { SearchField } from '../../components/ui/toolbar'
import { spring } from '../../components/motion/springs'
import { ApiError } from '../../lib/api/client'
import { archiveDocument, fetchDocuments, uploadDocument, type DocumentItem } from '../../lib/api/domain'
import { useProjectStore } from '../../lib/projects/project-store'
import { projectLabel } from '../../lib/rbac/rbac'
import { cn } from '../../lib/utils'
import { Dash, Field, PanelCard, formatDay } from './admin-kit'

type FileKind = { icon: LucideIcon; tone: IconTone; label: string }

function fileKind(name: string): FileKind {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  const label = ext && ext !== name.toLowerCase() ? ext.toUpperCase() : 'Fichier'
  if (ext === 'pdf') return { icon: FileText, tone: 'coral', label }
  if (['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(ext)) return { icon: FileText, tone: 'indigo', label }
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return { icon: FileSpreadsheet, tone: 'teal', label }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext)) return { icon: FileImage, tone: 'violet', label }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return { icon: FileVideo, tone: 'sky', label }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { icon: FileArchive, tone: 'gold', label }
  return { icon: File, tone: 'neutral', label }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} Ko`
  return `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
}

type View = 'ALL' | 'ACTIVE' | 'ARCHIVE'

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
  const [search, setSearch] = useState('')
  const [view, setView] = useState<View>('ALL')
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const docs = useQuery({ queryKey: ['documents', currentProject], queryFn: fetchDocuments })
  const scoped = useMemo(
    () => (docs.data ?? []).filter((d) => currentProject === 'ENTREPRISE' || d.projectCode === currentProject || !d.projectCode),
    [docs.data, currentProject],
  )
  const counts = useMemo(() => {
    const archived = scoped.filter((d) => d.statut === 'ARCHIVE').length
    return { all: scoped.length, archived, active: scoped.length - archived }
  }, [scoped])
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scoped.filter((d) => {
      const archived = d.statut === 'ARCHIVE'
      if (view === 'ACTIVE' && archived) return false
      if (view === 'ARCHIVE' && !archived) return false
      if (!q) return true
      return [d.titre, d.nomFichier, d.categorie ?? '', d.projectCode ?? ''].some((v) => v.toLowerCase().includes(q))
    })
  }, [scoped, search, view])
  const toArchive = scoped.find((d) => d.id === archiveId) ?? null

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
      if (fileInput.current) fileInput.current.value = ''
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

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) setFichier(file)
  }

  function clearFile() {
    setFichier(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  const picked = fichier ? fileKind(fichier.name) : null
  const PickedIcon = picked?.icon ?? File
  const scopeName = currentProject === 'ENTREPRISE' ? t('common.wholeCompany') : projectLabel(currentProject)

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={t('pages.documents.kicker')}
        title={t('pages.documents.title')}
        subtitle={t('docsUi.subtitle', 'Dépôt, consultation et archivage avec motif. Aucun document n’est jamais supprimé.')}
      />

      <PanelCard
        title={t('docsUi.uploadTitle', 'Déposer un document')}
        subtitle={t('docsUi.uploadScope', 'Classé dans : {{scope}}', { scope: scopeName })}
        icon={<UploadCloud />}
        tone="gold"
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            upload.mutate()
          }}
        >
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_auto] lg:items-end">
            <Field label={t('common.title')}>
              <Input
                placeholder={t('docsUi.titlePh', 'Ex. Contrat cadre Bralima 2026')}
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
              />
            </Field>
            <div className="min-w-0">
              <span className="mb-1.5 block text-[12.5px] font-medium text-ink-2">{t('docsUi.file', 'Fichier')}</span>
              <AnimatePresence mode="wait" initial={false}>
                {fichier ? (
                  <motion.div
                    key="file"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={spring.snappy}
                    className="flex h-10 items-center gap-2.5 rounded-[13px] bg-surface pl-1.5 pr-1 ring-1 ring-inset ring-hairline"
                  >
                    <IconTile tone={picked?.tone} size="sm">
                      <PickedIcon />
                    </IconTile>
                    <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{fichier.name}</p>
                    <span className="shrink-0 text-[12px] tabular-nums text-ink-3">{formatSize(fichier.size)}</span>
                    <button
                      type="button"
                      onClick={clearFile}
                      aria-label={t('docsUi.removeFile', 'Retirer le fichier')}
                      className="press flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-ink-3 hover:bg-ink/[0.06] hover:text-ink focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)] dark:hover:bg-white/[0.08]"
                    >
                      <X className="h-4 w-4" strokeWidth={2.2} />
                    </button>
                  </motion.div>
                ) : (
                  <motion.label
                    key="drop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragging(true)
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    className={cn(
                      'clay-field flex h-10 cursor-pointer items-center gap-2.5 rounded-[13px] px-3 transition-[background-color,box-shadow] duration-200',
                      'has-[:focus-visible]:[box-shadow:var(--ring-focus)]',
                      dragging ? 'bg-ma-gold-500/10 [box-shadow:var(--ring-focus)]' : 'hover:bg-surface',
                    )}
                  >
                    <UploadCloud
                      className={cn(
                        'h-[18px] w-[18px] shrink-0 text-accent-ink transition-transform duration-300 ease-[var(--ease-ma)]',
                        dragging && '-translate-y-0.5 scale-110',
                      )}
                      strokeWidth={2}
                    />
                    <span className="truncate text-[13.5px] font-medium text-ink">
                      {dragging ? t('docsUi.dropNow', 'Déposez le fichier ici') : t('docsUi.choose', 'Choisir un fichier')}
                    </span>
                    <span className="hidden truncate text-[12.5px] text-ink-3 sm:inline">{t('docsUi.dropHint', 'ou glissez-le ici')}</span>
                    <input ref={fileInput} type="file" className="sr-only" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />
                  </motion.label>
                )}
              </AnimatePresence>
            </div>
            <Button type="submit" className="w-full md:col-span-2 lg:col-span-1 lg:w-auto" disabled={upload.isPending}>
              {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {upload.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
          {success && <Feedback tone="success">{success}</Feedback>}
          {error && <Feedback tone="danger">{error}</Feedback>}
        </form>
      </PanelCard>

      {docs.isError ? (
        <Feedback tone="danger">{t('docsUi.loadFail', 'Impossible de charger les documents. Vérifiez vos droits ou réessayez.')}</Feedback>
      ) : !docs.isLoading && scoped.length === 0 ? (
        <ScopeEmpty
          context={t(
            'docsUi.scopeEmpty',
            'Aucun document pour ce contexte. Déposez le premier, ou choisissez un autre projet en haut à gauche.',
          )}
        />
      ) : (
        <TableCard
          loading={docs.isLoading}
          toolbar={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Segmented<View>
                size="sm"
                value={view}
                onChange={setView}
                ariaLabel={t('adminUi.filterByStatus')}
                options={[
                  { value: 'ALL', label: <Count label={t('orgUi.allM', 'Tous')} n={counts.all} /> },
                  { value: 'ACTIVE', label: <Count label={t('orgUi.activeM', 'Actifs')} n={counts.active} /> },
                  { value: 'ARCHIVE', label: <Count label={t('docsUi.archived', 'Archivés')} n={counts.archived} /> },
                ]}
              />
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder={t('docsUi.search', 'Rechercher un document…')}
                className="sm:max-w-[16rem]"
              />
            </div>
          }
          empty={
            visible.length === 0 ? (
              <EmptyState
                icon={<FolderOpen />}
                title={t('docsUi.noMatch', 'Aucun document ne correspond')}
                hint={t('docsUi.noMatchHint', 'Modifiez la recherche ou le filtre.')}
              />
            ) : undefined
          }
        >
          <Table minWidth={680}>
            <THead>
              <tr>
                <Th>{t('docsUi.document', 'Document')}</Th>
                <Th>{t('common.project')}</Th>
                <Th>{t('docsUi.added', 'Ajouté le')}</Th>
                <Th>{t('common.status')}</Th>
                <Th align="right">
                  <span className="sr-only">{t('common.actions')}</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {visible.map((d) => (
                <DocumentRow
                  key={d.id}
                  doc={d}
                  onArchive={() => {
                    setArchiveId(d.id)
                    setMotif('')
                  }}
                />
              ))}
            </TBody>
          </Table>
        </TableCard>
      )}

      <Modal
        open={archiveId != null}
        onClose={() => setArchiveId(null)}
        kicker={t('adminUi.confirmation')}
        title={t('docsUi.archiveTitle', 'Archiver le document')}
        subtitle={t(
          'docsUi.archiveHint',
          'Le document reste consultable dans les archives. Le motif est conservé dans le journal d’audit.',
        )}
        footer={
          <>
            <Button variant="outline" onClick={() => setArchiveId(null)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={!motif.trim() || archive.isPending} onClick={() => archive.mutate()}>
              {archive.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
              {t('docsUi.archive', 'Archiver')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {toArchive && <DocSummary doc={toArchive} />}
          <Field label={t('common.reason')}>
            <Textarea
              placeholder={t('docsUi.reasonPh', 'Ex. Contrat remplacé par la version 2026')}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              autoFocus
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

function DocSummary({ doc }: { doc: DocumentItem }) {
  const kind = fileKind(doc.nomFichier)
  const Icon = kind.icon
  return (
    <div className="flex items-center gap-3 rounded-[16px] bg-sunken/70 p-3 ring-1 ring-inset ring-hairline">
      <IconTile tone={kind.tone}>
        <Icon />
      </IconTile>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-ink">{doc.titre}</p>
        <p className="truncate text-[12px] text-ink-3">{doc.nomFichier}</p>
      </div>
    </div>
  )
}

function DocumentRow({ doc, onArchive }: { doc: DocumentItem; onArchive: () => void }) {
  const { t } = useTranslation()
  const kind = fileKind(doc.nomFichier)
  const Icon = kind.icon
  const archived = doc.statut === 'ARCHIVE'
  const added = formatDay(doc.createdAt)
  return (
    <Tr>
      <Td className="max-w-[24rem]">
        <div className="flex min-w-0 items-center gap-3">
          <IconTile tone={archived ? 'neutral' : kind.tone}>
            <Icon />
          </IconTile>
          <div className="min-w-0">
            <p className={cn('truncate font-medium', archived ? 'text-ink-2' : 'text-ink')}>{doc.titre}</p>
            <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-ink-3">
              <span className="shrink-0 rounded-[5px] bg-ink/[0.06] px-1 py-px text-[10px] font-semibold tracking-wide text-ink-2 dark:bg-white/[0.08]">
                {kind.label}
              </span>
              <span className="truncate">{doc.nomFichier}</span>
              {doc.categorie && (
                <>
                  <span aria-hidden>·</span>
                  <span className="shrink-0">
                    {doc.categorie.length <= 3 ? doc.categorie : sentence(doc.categorie.replaceAll('_', ' '))}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
      </Td>
      <Td>
        {doc.projectCode ? (
          <Badge tone={doc.projectCode === 'CNN' ? 'gold' : doc.projectCode === 'MDR' ? 'violet' : 'navy'}>
            {projectLabel(doc.projectCode)}
          </Badge>
        ) : (
          <Badge tone="muted">{t('common.wholeCompany')}</Badge>
        )}
      </Td>
      <Td className="whitespace-nowrap">{added ? <span className="text-ink-2">{added}</span> : <Dash />}</Td>
      <Td>
        <Badge tone={archived ? 'muted' : 'success'} dot>
          {archived ? t('docsUi.archivedOne', 'Archivé') : t('common.active')}
        </Badge>
      </Td>
      <Td align="right" className="w-[1%] whitespace-nowrap">
        <RowActions>
          <IconAction label={t('docsUi.archive', 'Archiver')} onClick={onArchive} disabled={archived}>
            <Archive />
          </IconAction>
        </RowActions>
      </Td>
    </Tr>
  )
}

function Count({ label, n }: { label: string; n: number }) {
  return (
    <>
      {label}
      <span className="tabular-nums text-ink-3">{n}</span>
    </>
  )
}
