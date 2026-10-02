import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge, statutTone } from './badge'
import { Button } from './button'
import { Card, CardBody } from './card'
import { Feedback } from './feedback'
import { Input } from './input'
import { Modal } from './modal'
import { PageHeader } from './page-header'
import { ScopeEmpty } from './scope-empty'
import { TableSkeleton } from './skeleton'
import { Toast } from './toast'
import { cn } from '../../lib/utils'
import { ApiError } from '../../lib/api/client'
import { archiveOps, createOps, listOps, updateOps, type OpsRecord } from '../../lib/api/ops'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { useProjectStore } from '../../lib/projects/project-store'
import { projectLabel } from '../../lib/rbac/rbac'

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

function FieldLabel({ children }: { children: string }) {
  return <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-ma-muted">{children}</span>
}

function fieldClass(invalid?: boolean) {
  return cn(
    'w-full rounded-lg border bg-white px-3 py-2.5 text-sm dark:bg-ma-navy-900',
    invalid ? 'border-status-danger' : 'border-slate-200 dark:border-ma-navy-700',
  )
}

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
  const { t } = useTranslation()
  const archiveText = archiveLabel ?? t('crud.archive')
  const queryClient = useQueryClient()
  const projectCode = useProjectStore((s) => s.currentProject)
  const scope = projectCode === 'ENTREPRISE' ? undefined : projectCode
  const [editor, setEditor] = useState<'create' | OpsRecord | null>(null)
  const [toArchive, setToArchive] = useState<OpsRecord | null>(null)
  const [motif, setMotif] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const statusOptions = STATUTS[module] ?? [
    { value: 'ACTIF', label: 'Actif' },
    { value: 'EN_COURS', label: 'En cours' },
    { value: 'ARCHIVE', label: 'Archivé' },
  ]
  const defaultStatut = DEFAULT_STATUT[module] ?? 'ACTIF'

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
      setNotice(
        created
          ? module === 'COURSE'
            ? t('crud.courseSaved')
            : t('crud.saved')
          : t('crud.updated'),
      )
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

  const list = (rows.data ?? []).filter(
    (row) => !scope || row.projectCode === scope || (!row.projectCode && scope === undefined),
  )

  return (
    <RequirePermission permission={permission}>
      <div className="space-y-4">
        <PageHeader
          kicker={kicker}
          title={title}
          subtitle={subtitle}
          actions={
            <Button onClick={openCreate}>
              <Plus size={15} />
              {createLabel}
            </Button>
          }
        />
        {error && <Feedback tone="danger">{error}</Feedback>}
        <Card>
          <CardBody className="overflow-x-auto p-0">
            {(rows.isLoading || rows.isFetching) && <TableSkeleton />}
            {!rows.isLoading && !rows.isFetching && (
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted dark:text-ma-gray-300">
                  <tr>
                    <th className="px-4 py-3">{t('common.title')}</th>
                    <th className="px-4 py-3">{t('common.status')}</th>
                    <th className="px-4 py-3">{t('common.project')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((row) => (
                    <tr key={row.id} className="border-t border-ma-line/80 dark:border-white/8">
                      <td className="px-4 py-3 font-medium">{row.titre}</td>
                      <td className="px-4 py-3">
                        <Badge tone={statutTone(row.statut)}>{row.statut}</Badge>
                      </td>
                      <td className="px-4 py-3 text-ma-muted">{row.projectCode ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" onClick={() => openEdit(row)}>
                          {t('common.edit')}
                        </Button>{' '}
                        <Button
                          variant="outline"
                          onClick={() => {
                            setToArchive(row)
                            setMotif('')
                            setError(null)
                          }}
                        >
                          {archiveText}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!rows.isLoading && !rows.isFetching && list.length === 0 && (
              <div className="p-4">
                <ScopeEmpty context={t('crud.empty', { scope: projectLabel(scope ?? null) })} />
              </div>
            )}
            {rows.isError && (
              <div className="p-4">
                <Feedback tone="danger">
                  {rows.error instanceof ApiError ? rows.error.message : t('crud.loadFail')}
                </Feedback>
              </div>
            )}
          </CardBody>
        </Card>
        <Modal
          open={Boolean(editor)}
          onClose={() => setEditor(null)}
          title={editor === 'create' ? createLabel : t('common.edit')}
          footer={(
            <>
              <Button type="button" variant="outline" onClick={() => setEditor(null)}>{t('common.close')}</Button>
              <Button type="submit" form="ma-module-form" disabled={save.isPending}>
                {save.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </>
          )}
        >
          <form id="ma-module-form" className="space-y-4" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
            <label className="block">
              <FieldLabel>{t('common.title')}</FieldLabel>
              <Input className={fieldClass(Boolean(form.formState.errors.titre))} {...form.register('titre')} />
              {form.formState.errors.titre && (
                <p className="mt-1 text-sm text-status-danger">{form.formState.errors.titre.message}</p>
              )}
            </label>
            <label className="block">
              <FieldLabel>{t('common.description')}</FieldLabel>
              <textarea
                className={fieldClass(Boolean(form.formState.errors.description))}
                rows={3}
                {...form.register('description')}
              />
              {form.formState.errors.description && (
                <p className="mt-1 text-sm text-status-danger">{form.formState.errors.description.message}</p>
              )}
            </label>
            <label className="block">
              <FieldLabel>{t('common.status')}</FieldLabel>
              <select className={fieldClass()} {...form.register('statut')}>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-ma-muted">
                {t('crud.statusHint', { status: statusOptions.find((s) => s.value === defaultStatut)?.label ?? defaultStatut })}
              </p>
            </label>
          </form>
        </Modal>
        <Modal
          open={Boolean(toArchive)}
          onClose={() => setToArchive(null)}
          title={t('crud.motifRequired', { action: archiveText })}
          footer={(
            <>
              <Button variant="outline" onClick={() => setToArchive(null)}>{t('common.close')}</Button>
              <Button disabled={!motif.trim() || archive.isPending} onClick={() => archive.mutate()}>{t('common.confirm')}</Button>
            </>
          )}
        >
          <div className="space-y-3">
            <textarea
              className="w-full rounded-xl border border-ma-line bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ma-navy-900"
              rows={3}
              placeholder={t('common.reason')}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
            />
          </div>
        </Modal>
        <Toast message={notice} onDismiss={() => setNotice(null)} />
      </div>
    </RequirePermission>
  )
}
