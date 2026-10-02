import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge, prioriteTone, statutTone } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { PageHeader } from '../../components/ui/page-header'
import { TableSkeleton } from '../../components/ui/skeleton'
import { ApiError } from '../../lib/api/client'
import {
  assignTicket,
  attachTicketFile,
  changeTicketStatus,
  commentTicket,
  getTicket,
  listTicketAgents,
  listTicketReattributions,
} from '../../lib/api/tickets'
import { Modal } from '../../components/ui/modal'
import { Input } from '../../components/ui/input'
import { hasFullAccess } from '../../lib/rbac/rbac'
import { useAuthStore } from '../../lib/auth/auth-store'
import { readSession } from '../../lib/auth/session'

const TRANSITIONS: Record<string, string[]> = {
  OUVERT: ['EN_COURS', 'EN_ATTENTE', 'ANNULE'],
  EN_COURS: ['EN_ATTENTE', 'RESOLU', 'ANNULE'],
  EN_ATTENTE: ['EN_COURS', 'ANNULE'],
  RESOLU: ['CLOTURE', 'EN_COURS'],
  CLOTURE: [],
  ANNULE: [],
}

const STATUS_LABEL: Record<string, string> = {
  OUVERT: 'Ouvert',
  EN_COURS: 'En cours',
  EN_ATTENTE: 'En attente',
  RESOLU: 'Résolu',
  CLOTURE: 'Clôturé',
  ANNULE: 'Annulé',
}

const TYPE_LABEL: Record<string, string> = {
  DEMANDE_TRAVAIL: 'Demande de travail',
  INCIDENT: 'Incident',
  ANOMALIE_TECHNIQUE: 'Anomalie technique',
  RECLAMATION_CLIENT: 'Réclamation client',
  DEMANDE_ADMINISTRATIVE: 'Demande administrative',
  DEMANDE_ACHAT: 'Demande d’achat',
}

export function TicketDetailPage() {
  const { id } = useParams()
  const ticketId = Number(id)
  const queryClient = useQueryClient()
  const roles = useAuthStore((s) => s.roles)
  const responsable = hasFullAccess(roles)
  const [comment, setComment] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [motif, setMotif] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [assignee, setAssignee] = useState('')
  const agents = useQuery({ queryKey: ['ticket-agents'], queryFn: listTicketAgents })
  const ticket = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => getTicket(ticketId),
    enabled: Number.isFinite(ticketId),
  })
  const history = useQuery({
    queryKey: ['ticket-reattributions', ticketId],
    queryFn: () => listTicketReattributions(ticketId),
    enabled: Number.isFinite(ticketId),
  })
  const statut = useMutation({
    mutationFn: (next: string) => changeTicketStatus(ticketId, next, next === 'ANNULE' ? motif : undefined),
    onSuccess: () => {
      setNotice('Statut enregistré.')
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
    onError: (err) => {
      setNotice(null)
      setError(err instanceof ApiError ? err.message : 'Le changement de statut a échoué.')
    },
  })
  const attribuer = useMutation({
    mutationFn: () => assignTicket(ticketId, Number(assignee)),
    onSuccess: () => {
      setNotice('Ticket réattribué.')
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      void queryClient.invalidateQueries({ queryKey: ['ticket-reattributions', ticketId] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Réattribution impossible.'),
  })
  const commenter = useMutation({
    mutationFn: () => commentTicket(ticketId, comment),
    onSuccess: () => {
      setComment('')
      setNotice('Commentaire enregistré.')
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
    },
    onError: (err) => {
      setNotice(null)
      setError(err instanceof ApiError ? err.message : 'L’enregistrement du commentaire a échoué.')
    },
  })
  const attach = useMutation({
    mutationFn: (file: File) => attachTicketFile(ticketId, file),
    onSuccess: () => {
      setNotice('Pièce jointe enregistrée.')
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Envoi de la pièce jointe impossible.'),
  })

  const t = ticket.data
  if (ticket.isLoading) return <TableSkeleton rows={4} cols={3} />
  if (!t) return <p>Ticket introuvable.</p>

  const locked = t.statut === 'CLOTURE' || t.statut === 'ANNULE'
  const nexts = TRANSITIONS[t.statut] ?? []
  const overdue = t.sla?.echeanceDepassee || t.sla?.depassement

  async function downloadPiece(pieceId: number, nom?: string) {
    const session = readSession()
    const res = await fetch(`/api/tickets/${ticketId}/pieces-jointes/${pieceId}`, {
      headers: session ? { Authorization: `Bearer ${session.accessToken}` } : {},
    })
    if (!res.ok) {
      setError('Téléchargement impossible.')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nom || 'piece'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="Billetterie"
        title={t.reference}
        subtitle={t.titre}
        actions={
          <>
            <Badge tone={prioriteTone(t.priorite)}>{t.priorite}</Badge>
            <Badge tone={statutTone(t.statut)}>{STATUS_LABEL[t.statut] ?? t.statut}</Badge>
          </>
        }
      />
      <Card className={overdue ? 'ring-1 ring-status-danger/40' : undefined}>
        <CardHeader>
          <h2 className="font-semibold">{t.titre}</h2>
        </CardHeader>
        <CardBody className="space-y-3 text-sm">
          <p>{t.description || 'Sans description.'}</p>
          <p>Type : {TYPE_LABEL[t.type] ?? t.type}</p>
          {t.type === 'INCIDENT' && <p>Catégorie d’incident : {t.categorie ?? '—'}</p>}
          <p>Projet : {t.project?.code ?? '—'}</p>
          <p>Département : {t.departementDestinataire?.nom ?? '—'}</p>
          <p>Échéance souhaitée : {t.echeance ? new Date(t.echeance).toLocaleString() : '—'}</p>
          {t.objetLieType && (
            <p>
              Objet lié : {t.objetLieType} {t.objetLieId ?? ''} {t.objetLieLibelle ? `— ${t.objetLieLibelle}` : ''}
            </p>
          )}
          {t.sla && (
            <p>
              SLA {t.sla.engagementHeures} h — prise en charge {t.sla.priseEnChargeMinutes} min, résolution{' '}
              {t.sla.resolutionMinutes} min — {t.sla.respecte ? 'respecté' : 'dépassé'}
            </p>
          )}
          {t.motifAnnulation && <p>Motif d’annulation : {t.motifAnnulation}</p>}
          {locked && (
            <Feedback tone="warning">
              Ticket {STATUS_LABEL[t.statut]}. Champs non modifiables
              {responsable ? `, sauf réouverture par un responsable (${t.sla?.reouvertureJours ?? 30} jours).` : '.'}
            </Feedback>
          )}
          <div className="flex flex-wrap gap-2">
            {nexts
              .filter((s) => s !== 'ANNULE')
              .map((s) => (
                <Button key={s} variant="outline" disabled={statut.isPending} onClick={() => statut.mutate(s)}>
                  {STATUS_LABEL[s] ?? s}
                </Button>
              ))}
            {nexts.includes('ANNULE') && (
              <Button variant="outline" onClick={() => setCancelOpen(true)}>
                Annuler le ticket
              </Button>
            )}
            {locked && responsable && (
              <Button variant="outline" onClick={() => statut.mutate('OUVERT')}>
                Rouvrir
              </Button>
            )}
          </div>
          {!locked && (
            <div className="flex flex-wrap gap-2">
              <select
                className="rounded-xl border border-ma-line bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ma-navy-900"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              >
                <option value="">Réattribuer à…</option>
                {(agents.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.prenom} {a.nom}
                  </option>
                ))}
              </select>
              <Button variant="outline" disabled={!assignee || attribuer.isPending} onClick={() => attribuer.mutate()}>
                Confirmer
              </Button>
            </div>
          )}
          {notice && <Feedback tone="success">{notice}</Feedback>}
          {error && <Feedback tone="danger">{error}</Feedback>}
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Historique de réattribution</h2>
        </CardHeader>
        <CardBody className="space-y-2 text-sm">
          {(history.data ?? []).length === 0 && <p className="text-ma-muted">Aucune réattribution.</p>}
          {(history.data ?? []).map((h) => (
            <p key={h.id}>
              {new Date(h.createdAt).toLocaleString()} — {h.ancienAgent ? `${h.ancienAgent.prenom} ${h.ancienAgent.nom}` : 'non assigné'} →{' '}
              {h.nouvelAgent?.prenom} {h.nouvelAgent?.nom}
            </p>
          ))}
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Commentaires</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          {(t.commentaires ?? []).map((c) => (
            <p key={c.id} className="text-sm">
              <span className="text-ma-muted">{c.createdAt ? new Date(c.createdAt).toLocaleString() : ''} — </span>
              {c.auteur ? `${c.auteur.prenom ?? ''} ${c.auteur.nom ?? ''}`.trim() : 'Agent'} : {c.contenu}
            </p>
          ))}
          {!locked && (
            <>
              <textarea
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ma-navy-950 dark:border-ma-navy-700 dark:bg-ma-navy-900 dark:text-ma-white"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ajouter un commentaire"
              />
              <Button disabled={!comment.trim() || commenter.isPending} onClick={() => commenter.mutate()}>
                Publier
              </Button>
            </>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Pièces jointes</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          {(t.piecesJointes ?? []).map((p) => (
            <button
              key={p.id}
              type="button"
              className="block text-sm text-ma-gold-600 hover:underline"
              onClick={() => void downloadPiece(p.id, p.nomFichier)}
            >
              {p.nomFichier ?? `Fichier ${p.id}`}
            </button>
          ))}
          {!locked && (
            <input
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) attach.mutate(f)
              }}
            />
          )}
        </CardBody>
      </Card>
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Annuler le ticket — motif obligatoire"
        footer={(
          <>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Fermer</Button>
            <Button
              disabled={!motif.trim() || statut.isPending}
              onClick={() => {
                statut.mutate('ANNULE')
                setCancelOpen(false)
              }}
            >
              Confirmer l’annulation
            </Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Input placeholder="Motif d’annulation" value={motif} onChange={(e) => setMotif(e.target.value)} />
          {!motif.trim() && <p className="text-sm text-status-danger">Le motif est obligatoire.</p>}
        </div>
      </Modal>
    </div>
  )
}
