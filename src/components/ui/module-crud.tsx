import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import {
  Activity,
  AlertTriangle,
  Archive,
  Bike,
  Building2,
  Bug,
  CalendarDays,
  FileCheck2,
  Handshake,
  Image as ImageIcon,
  Info,
  Lock,
  Megaphone,
  Pencil,
  Plus,
  Receipt,
  Repeat,
  SearchX,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge, prioriteLabel, prioriteTone, sentence, statutLabel, statutTone } from './badge'
import { Button } from './button'
import { IconTile } from './card'
import { Feedback } from './feedback'
import { FieldLabel, Input, Select, Textarea } from './input'
import { Modal } from './modal'
import { PageHeader } from './page-header'
import { EmptyState } from './scope-empty'
import { Segmented } from './segmented'
import { CellStack, IconAction, Pagination, RowActions, Table, TableCard, Td, Th, THead, Tr } from './table'
import { Toast } from './toast'
import { SearchField } from './toolbar'
import { ApiError } from '../../lib/api/client'
import { CnnSourceBadge } from './cnn-source-badge'
import { archiveOps, createOps, fetchCnnDashboard, listOps, updateOps, type OpsRecord } from '../../lib/api/ops'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { useProjectStore } from '../../lib/projects/project-store'
import { projectLabel } from '../../lib/rbac/rbac'
import { cn } from '../../lib/utils'

const schema = z.object({
  titre: z.string().trim().min(1, 'Le titre est obligatoire.'),
  description: z.string().trim().min(1, 'La description est obligatoire.'),
  statut: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const STATUTS: Record<string, { value: string; label: string }[]> = {
  COURSE: [
    { value: 'PLANIFIEE', label: 'Planifiée' },
    { value: 'EN_COURS', label: 'En cours' },
    { value: 'EN_ATTENTE', label: 'En attente' },
    { value: 'LIVREE', label: 'Livrée' },
    { value: 'ANNULEE', label: 'Annulée' },
  ],
  INCIDENT: [
    { value: 'OUVERT', label: 'Ouvert' },
    { value: 'EN_COURS', label: 'En cours' },
    { value: 'RESOLU', label: 'Résolu' },
    { value: 'CLOTURE', label: 'Clôturé' },
  ],
}

const DEFAULT_STATUT: Record<string, string> = {
  COURSE: 'PLANIFIEE',
  INCIDENT: 'OUVERT',
  COURIER: 'EN_VALIDATION',
  LEAVE: 'EN_ATTENTE',
  BUG: 'EN_ATTENTE',
}

/** Libellés FR accentués des statuts des modules (repli : statutLabel). */
const STATUT_FR: Record<string, string> = {
  PLANIFIEE: 'Planifiée',
  EN_COURS: 'En cours',
  EN_ATTENTE: 'En attente',
  LIVREE: 'Livrée',
  ANNULEE: 'Annulée',
  ANNULE: 'Annulé',
  OUVERT: 'Ouvert',
  RESOLU: 'Résolu',
  CLOTURE: 'Clôturé',
  FERME: 'Fermé',
  ACTIF: 'Actif',
  INACTIF: 'Inactif',
  ARCHIVE: 'Archivé',
  ARCHIVEE: 'Archivée',
  EN_VALIDATION: 'En validation',
  VALIDEE: 'Validée',
  REFUSEE: 'Refusée',
  REJETE: 'Rejeté',
  SUSPENDU: 'Suspendu',
  RESILIE: 'Résilié',
  EN_RETARD: 'En retard',
  PAYEE: 'Payée',
  EMISE: 'Émise',
  BROUILLON: 'Brouillon',
  EXPIRE: 'Expiré',
  TERMINEE: 'Terminée',
}

const STATUT_TONE: Record<string, Parameters<typeof Badge>[0]['tone']> = {
  LIVREE: 'success',
  PAYEE: 'success',
  TERMINEE: 'success',
  VALIDEE: 'success',
  REJETE: 'danger',
  REFUSEE: 'danger',
  RESILIE: 'danger',
  EN_RETARD: 'danger',
  EN_VALIDATION: 'warning',
  SUSPENDU: 'warning',
  ARCHIVE: 'muted',
  ARCHIVEE: 'muted',
  EXPIRE: 'muted',
  FERME: 'muted',
  BROUILLON: 'muted',
  OUVERT: 'info',
  PLANIFIEE: 'info',
  EMISE: 'info',
}

const MODULE_ICON: Record<string, LucideIcon> = {
  COURSE: Truck,
  INCIDENT: AlertTriangle,
  COURIER: Bike,
  ENTERPRISE: Building2,
  SUBSCRIPTION: Repeat,
  INVOICE: Receipt,
  LEAVE: CalendarDays,
  PARTNER: Handshake,
  COMPLIANCE: FileCheck2,
  MARKETING: Megaphone,
  MEDIA: ImageIcon,
  MONITORING: Activity,
  BUG: Bug,
}

function prioriteBadgeTone(p: string) {
  const tone = prioriteTone(p)
  if (tone !== 'muted') return tone
  if (p === 'HAUTE') return 'warning'
  if (p === 'BASSE') return 'info'
  return 'muted'
}

function formatDate(iso: string | undefined, lang: string) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PAGE_SIZE = 10

export function ModuleCrud({
  module,
  permission,
  title,
  kicker,
  subtitle,
  createLabel,
  archiveLabel,
}: {
  module: string
  permission: string
  title: string
  kicker: string
  subtitle: string
  createLabel: string
  archiveLabel?: string
}) {
  const { t, i18n } = useTranslation()
  const reduce = useReducedMotion()
  const archiveText = archiveLabel ?? t('crud.archive')
  const queryClient = useQueryClient()
  const projectCode = useProjectStore((s) => s.currentProject)
  const scope = projectCode === 'ENTREPRISE' ? undefined : projectCode
  const [editor, setEditor] = useState<'create' | OpsRecord | null>(null)
  const [toArchive, setToArchive] = useState<OpsRecord | null>(null)
  const [motif, setMotif] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const statusOptions = STATUTS[module] ?? [
    { value: 'ACTIF', label: 'Actif' },
    { value: 'EN_COURS', label: 'En cours' },
    { value: 'ARCHIVE', label: 'Archivé' },
  ]
  const defaultStatut = DEFAULT_STATUT[module] ?? 'ACTIF'
  const ModuleIcon = MODULE_ICON[module] ?? Archive

  const labelOf = (code: string) =>
    t(`opsui.status.${code}`, { defaultValue: STATUT_FR[code] ?? statusOptions.find((s) => s.value === code)?.label ?? statutLabel(code) })
  const toneOf = (code: string) => STATUT_TONE[code] ?? statutTone(code)

  const rows = useQuery({
    queryKey: ['ops', module, scope ?? 'ENTREPRISE'],
    queryFn: () => listOps(module, scope),
  })
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { titre: '', description: '', statut: defaultStatut },
  })

  function openCreate() {
    form.reset({ titre: '', description: '', statut: defaultStatut })
    setEditor('create')
    setError(null)
  }

  function openEdit(row: OpsRecord) {
    form.reset({ titre: row.titre, description: row.description ?? '', statut: row.statut })
    setEditor(row)
    setError(null)
  }

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const body = {
        titre: values.titre,
        description: values.description,
        statut: values.statut?.trim() || defaultStatut,
        projectCode: scope,
      }
      return editor === 'create' || !editor ? createOps(module, body) : updateOps(module, editor.id, { ...body, titre: values.titre })
    },
    onSuccess: () => {
      const created = editor === 'create' || !editor
      setNotice(created ? (module === 'COURSE' ? t('crud.courseSaved') : t('crud.saved')) : t('crud.updated'))
      setEditor(null)
      void queryClient.invalidateQueries({ queryKey: ['ops', module] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t('crud.saveFail')),
  })

  const archive = useMutation({
    mutationFn: () => archiveOps(module, toArchive!.id, motif),
    onSuccess: () => {
      setNotice(t('crud.updated'))
      setToArchive(null)
      setMotif('')
      void queryClient.invalidateQueries({ queryKey: ['ops', module] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t('crud.actionFail')),
  })

  const cnnModule = scope === 'CNN' && ['COURSE', 'INCIDENT', 'COURIER', 'SUBSCRIPTION'].includes(module)
  const source = useQuery({
    queryKey: ['ops-dash', 'CNN', 'badge'],
    queryFn: () => fetchCnnDashboard('CNN'),
    enabled: cnnModule,
    refetchInterval: cnnModule ? 10_000 : false,
  })
  const list = useMemo(
    () => (rows.data ?? []).filter((row) => !scope || row.projectCode === scope || (!row.projectCode && scope === undefined)),
    [rows.data, scope],
  )
  const lectureSeule = cnnModule || list.some((row) => row.lectureSeule)

  // Compteurs par statut, dans l'ordre du module puis par ordre d'apparition.
  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const option of statusOptions) if (list.some((r) => r.statut === option.value)) counts.set(option.value, 0)
    for (const row of list) counts.set(row.statut, (counts.get(row.statut) ?? 0) + 1)
    return [...counts.entries()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, module])

  const needle = query.trim().toLocaleLowerCase('fr')
  const filtered = list.filter(
    (row) =>
      (statusFilter === 'ALL' || row.statut === statusFilter) &&
      (!needle || `${row.titre} ${row.description ?? ''} ${row.zone ?? ''}`.toLocaleLowerCase('fr').includes(needle)),
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pageCount)
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize)

  useEffect(() => setPage(1), [query, statusFilter, pageSize, scope])
  useEffect(() => {
    if (statusFilter !== 'ALL' && !statusCounts.some(([code]) => code === statusFilter)) setStatusFilter('ALL')
  }, [statusCounts, statusFilter])

  const hasPriorite = list.some((r) => r.priorite)
  const hasZone = list.some((r) => r.zone)
  const hasCanal = list.some((r) => r.canal)
  const hasMontant = list.some((r) => r.montant != null)
  const hasDate = list.some((r) => r.createdAt)
  const lang = i18n.language || 'fr'

  const loadError = rows.isError ? (rows.error instanceof ApiError ? rows.error.message : t('crud.loadFail')) : null
  const scopeName = projectLabel(scope ?? null)
  const editing = editor && editor !== 'create' ? editor : null
  const cancelText = archiveText === t('common.cancel') ? t('common.close') : t('common.cancel')

  const missingNote =
    cnnModule && module === 'COURSE'
      ? t('opsui.crud.gpsMissing', 'Positions GPS non disponibles dans la base Colis na Nga.')
      : cnnModule && module === 'COURIER'
        ? t('opsui.crud.expiryMissing', 'Expiration des coursiers non disponible dans la base Colis na Nga.')
        : null

  const toolbar = list.length > 0 && (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder={t('opsui.crud.search', 'Rechercher un titre, une zone…')}
        className="sm:max-w-none lg:max-w-[20rem]"
      />
      {statusCounts.length > 1 && (
        <Segmented
          size="sm"
          ariaLabel={t('common.status')}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'ALL', label: <SegLabel text={t('opsui.crud.all', 'Tous')} count={list.length} /> },
            ...statusCounts.map(([code, count]) => ({ value: code, label: <SegLabel text={labelOf(code)} count={count} /> })),
          ]}
        />
      )}
    </div>
  )

  const emptyNode = loadError ? (
    <div className="py-3">
      <Feedback tone="danger">{loadError}</Feedback>
    </div>
  ) : list.length === 0 ? (
    <EmptyState
      icon={<ModuleIcon />}
      title={t('opsui.crud.emptyTitle', 'Rien à afficher pour le moment')}
      hint={t('crud.empty', { scope: scopeName })}
      action={
        lectureSeule ? undefined : (
          <Button variant="soft" size="sm" onClick={openCreate}>
            <Plus size={15} />
            {createLabel}
          </Button>
        )
      }
    />
  ) : filtered.length === 0 ? (
    <EmptyState
      icon={<SearchX />}
      title={t('opsui.crud.noMatch', 'Aucun résultat')}
      hint={t('opsui.crud.noMatchHint', 'Essayez un autre mot-clé ou un autre statut.')}
      action={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQuery('')
            setStatusFilter('ALL')
          }}
        >
          {t('opsui.crud.reset', 'Réinitialiser les filtres')}
        </Button>
      }
    />
  ) : null

  return (
    <RequirePermission permission={permission}>
      <div className="space-y-5">
        <PageHeader
          kicker={kicker}
          title={title}
          subtitle={subtitle}
          actions={
            lectureSeule ? undefined : (
              <Button onClick={openCreate}>
                <Plus size={16} strokeWidth={2.4} />
                {createLabel}
              </Button>
            )
          }
        />
        {cnnModule && (source.data || source.isError || missingNote) && (
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center [&>*]:max-w-full [&>p]:h-auto [&>p]:min-h-7 [&>p]:rounded-[14px] [&>p]:py-1 [&>p]:leading-snug sm:[&>p]:rounded-full">
            {(source.data || source.isError) && (
              <CnnSourceBadge
                source={source.data?.source}
                ageSecondes={source.data?.ageSecondes}
                message={source.data?.message}
                readOnlyVerified={source.data?.readOnlyVerified}
              />
            )}
            {lectureSeule && (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ink/[0.05] px-3 text-[12px] font-medium text-ink-2 ring-1 ring-inset ring-hairline dark:bg-white/[0.06]">
                <Lock className="h-3.5 w-3.5" strokeWidth={2.2} />
                {t('opsui.crud.readOnly', 'Lecture seule')}
              </span>
            )}
            {missingNote && (
              <span className="inline-flex min-h-7 items-center gap-1.5 rounded-[14px] bg-ink/[0.05] px-3 py-1 leading-snug sm:rounded-full text-[12px] text-ink-3 ring-1 ring-inset ring-hairline dark:bg-white/[0.06]">
                <Info className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                {missingNote}
              </span>
            )}
          </div>
        )}
        {error && !editor && !toArchive && <Feedback tone="danger">{error}</Feedback>}

        <TableCard
          toolbar={toolbar || undefined}
          loading={rows.isLoading}
          empty={emptyNode}
          footer={
            filtered.length > PAGE_SIZE || pageSize !== PAGE_SIZE ? (
              <Pagination
                page={current}
                pageCount={pageCount}
                total={filtered.length}
                pageSize={pageSize}
                onPage={setPage}
                onPageSize={setPageSize}
                unit={t('opsui.crud.unit', 'éléments')}
              />
            ) : filtered.length > 0 ? (
              <p className="text-[12.5px] text-ink-3 tabular-nums">
                {filtered.length === 1 ? t('opsui.crud.countOne', '1 élément') : t('opsui.crud.countMany', '{{count}} éléments', { count: filtered.length })}
                {filtered.length !== list.length && ` · ${t('opsui.crud.of', 'sur {{total}}', { total: list.length })}`}
              </p>
            ) : undefined
          }
          className={cn(rows.isFetching && !rows.isLoading && 'transition-opacity [&_table]:opacity-70')}
        >
          <Table minWidth={hasMontant || hasZone ? 760 : 680}>
            <THead>
              <tr>
                <Th>{t('common.title')}</Th>
                <Th>{t('common.status')}</Th>
                {hasPriorite && <Th>{t('opsui.crud.priority', 'Priorité')}</Th>}
                {hasZone && <Th>{t('opsui.crud.zone', 'Zone')}</Th>}
                {hasCanal && <Th>{t('opsui.crud.channel', 'Canal')}</Th>}
                {hasMontant && <Th align="right">{t('opsui.crud.amount', 'Montant')}</Th>}
                <Th>{t('common.project')}</Th>
                {hasDate && <Th>{t('opsui.crud.created', 'Créé le')}</Th>}
                {!lectureSeule && (
                  <Th align="right">
                    <span className="sr-only">{t('common.actions')}</span>
                  </Th>
                )}
              </tr>
            </THead>
            <motion.tbody
              key={`${statusFilter}-${needle}-${current}`}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18 }}
              className="[&>tr:last-child>td]:border-b-0"
            >
              {visible.map((row) => (
                <Tr
                  key={row.id}
                  onClick={lectureSeule ? undefined : () => openEdit(row)}
                  accent={row.priorite === 'CRITIQUE' && !['RESOLU', 'CLOTURE'].includes(row.statut) ? 'danger' : undefined}
                >
                  <Td className="max-w-[15rem] sm:max-w-[22rem]">
                    <div className="flex min-w-0 items-center gap-3">
                      <IconTile tone="neutral" size="sm" className="hidden sm:inline-flex">
                        <ModuleIcon />
                      </IconTile>
                      <CellStack title={row.titre} meta={row.description || undefined} />
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={toneOf(row.statut)} dot>
                      {labelOf(row.statut)}
                    </Badge>
                  </Td>
                  {hasPriorite && (
                    <Td>
                      {row.priorite ? (
                        <Badge tone={prioriteBadgeTone(row.priorite)}>{prioriteLabel(row.priorite)}</Badge>
                      ) : (
                        <Dash />
                      )}
                    </Td>
                  )}
                  {hasZone && <Td className="whitespace-nowrap text-ink-2">{row.zone ?? <Dash />}</Td>}
                  {hasCanal && (
                    <Td className="whitespace-nowrap text-ink-2">
                      {row.canal ? t(`cnn.channel.${row.canal}`, { defaultValue: sentence(row.canal.replaceAll('_', ' ')) }) : <Dash />}
                    </Td>
                  )}
                  {hasMontant && (
                    <Td align="right" className="whitespace-nowrap font-medium tabular-nums">
                      {row.montant != null ? row.montant.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : <Dash />}
                    </Td>
                  )}
                  <Td className="whitespace-nowrap text-ink-2">{row.projectCode ? projectLabel(row.projectCode) : <span className="text-ink-3">{projectLabel(null)}</span>}</Td>
                  {hasDate && <Td className="whitespace-nowrap tabular-nums text-ink-3">{formatDate(row.createdAt, lang) ?? <Dash />}</Td>}
                  {!lectureSeule && (
                    <Td align="right" className="w-[1%] whitespace-nowrap">
                      <RowActions>
                        <IconAction label={t('common.edit')} onClick={() => openEdit(row)}>
                          <Pencil />
                        </IconAction>
                        <IconAction
                          label={archiveText}
                          tone="danger"
                          onClick={() => {
                            setToArchive(row)
                            setMotif('')
                            setError(null)
                          }}
                        >
                          <Archive />
                        </IconAction>
                      </RowActions>
                    </Td>
                  )}
                </Tr>
              ))}
            </motion.tbody>
          </Table>
        </TableCard>

        <Modal
          open={Boolean(editor)}
          onClose={() => setEditor(null)}
          kicker={title}
          title={editing ? t('opsui.crud.editTitle', 'Modifier l’élément') : createLabel}
          subtitle={editing ? editing.titre : t('opsui.crud.createHint', 'Les champs marqués sont obligatoires.')}
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => setEditor(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" form="ma-module-form" disabled={save.isPending}>
                {save.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </>
          }
        >
          <form id="ma-module-form" className="space-y-4" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
            {error && <Feedback tone="danger">{error}</Feedback>}
            <label className="block">
              <FieldLabel hint={t('opsui.crud.required', 'Obligatoire')}>{t('common.title')}</FieldLabel>
              <Input
                autoFocus
                aria-invalid={Boolean(form.formState.errors.titre)}
                placeholder={t('opsui.crud.titlePlaceholder', 'Un intitulé court et explicite')}
                {...form.register('titre')}
              />
              <FieldError message={form.formState.errors.titre?.message} />
            </label>
            <label className="block">
              <FieldLabel hint={t('opsui.crud.required', 'Obligatoire')}>{t('common.description')}</FieldLabel>
              <Textarea
                rows={4}
                aria-invalid={Boolean(form.formState.errors.description)}
                placeholder={t('opsui.crud.descriptionPlaceholder', 'Contexte, personnes concernées, prochaines étapes…')}
                {...form.register('description')}
              />
              <FieldError message={form.formState.errors.description?.message} />
            </label>
            <label className="block">
              <FieldLabel>{t('common.status')}</FieldLabel>
              <Select {...form.register('statut')}>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {labelOf(option.value)}
                  </option>
                ))}
              </Select>
              <p className="mt-1.5 text-[12px] leading-snug text-ink-3">{t('crud.statusHint', { status: labelOf(defaultStatut) })}</p>
            </label>
            {scope && (
              <p className="flex items-center gap-2 rounded-[13px] bg-ink/[0.035] px-3.5 py-2.5 text-[12.5px] text-ink-3 dark:bg-white/[0.04]">
                <Info className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
                {t('opsui.crud.scopeNote', 'Rattaché au projet {{scope}}.', { scope: scopeName })}
              </p>
            )}
          </form>
        </Modal>

        <Modal
          open={Boolean(toArchive)}
          onClose={() => setToArchive(null)}
          kicker={title}
          title={t('opsui.crud.archiveTitle', '{{action}} cet élément ?', { action: archiveText })}
          subtitle={t('opsui.crud.archiveHint', 'L’élément reste consultable dans l’historique. Le motif est enregistré dans le journal d’audit.')}
          footer={
            <>
              <Button variant="outline" onClick={() => setToArchive(null)}>
                {cancelText}
              </Button>
              <Button variant="danger" disabled={!motif.trim() || archive.isPending} onClick={() => archive.mutate()}>
                <Archive size={15} />
                {archive.isPending ? t('common.saving') : archiveText}
              </Button>
            </>
          }
        >
          {toArchive && (
            <div className="space-y-4">
              {error && <Feedback tone="danger">{error}</Feedback>}
              <div className="flex items-center gap-3 rounded-[16px] bg-ink/[0.035] p-3.5 ring-1 ring-inset ring-hairline dark:bg-white/[0.04]">
                <IconTile tone="neutral" size="sm">
                  <ModuleIcon />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[14px] font-medium leading-snug text-ink">{toArchive.titre}</p>
                  {toArchive.description && <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-3">{toArchive.description}</p>}
                </div>
                <Badge tone={toneOf(toArchive.statut)} dot>
                  {labelOf(toArchive.statut)}
                </Badge>
              </div>
              <label className="block">
                <FieldLabel hint={t('opsui.crud.required', 'Obligatoire')}>{t('common.reason')}</FieldLabel>
                <Textarea
                  autoFocus
                  rows={3}
                  placeholder={t('opsui.crud.reasonPlaceholder', 'Expliquez brièvement pourquoi.')}
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                />
              </label>
            </div>
          )}
        </Modal>
        <Toast message={notice} onDismiss={() => setNotice(null)} />
      </div>
    </RequirePermission>
  )
}

function SegLabel({ text, count }: { text: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {text}
      <span className="tabular-nums text-[11.5px] font-semibold opacity-60">{count}</span>
    </span>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="ma-fact-in mt-1.5 flex items-center gap-1.5 text-[12.5px] text-status-danger" role="alert">
      <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.2} />
      {message}
    </p>
  )
}

function Dash() {
  return <span className="text-ink-3">–</span>
}
