import { useQuery } from '@tanstack/react-query'
import { api } from './client'

/**
 * Administration Colis na Nga depuis MA Workspace.
 * Tout passe par le relais du Core (/api/cnn/admin/**) qui appelle l'API admin de
 * Colis na Nga : mêmes règles métier, mêmes notifications, même audit que l'application.
 */
const BASE = '/api/cnn/admin'
/** Lectures : en direct dans la base Colis na Nga (lecture seule), sans dépendre du relais. */
const READ = '/api/cnn/lecture'

export type CnnAction = 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE'
export type CnnScope =
  | 'VIEW_CNN_DASHBOARD'
  | 'MANAGE_CNN_ORDERS'
  | 'MANAGE_CNN_AGENTS'
  | 'MANAGE_CNN_MOTARDS'
  | 'MANAGE_CNN_ASSOCIATIONS'
  | 'MANAGE_CNN_CLIENTS'
  | 'MANAGE_CNN_SUBSCRIPTIONS'
  | 'MANAGE_CNN_PAYMENTS'
  | 'MANAGE_CNN_SETTINGS'
  | 'MANAGE_CNN_ADMINS'

export type CnnRelayStatus = {
  configured: boolean
  /** Le backend Colis na Nga accepte le relais (nouvelle version déployée et activée). */
  relayReady?: boolean
  /** Raison technique quand le relais ne répond pas (pour le diagnostic). */
  relayReason?: string | null
  scopes: Partial<Record<CnnScope, Record<CnnAction, boolean>>>
}

export type OrderStatus =
  | 'PENDING'
  | 'PENDING_MOTARD_ACCEPTANCE'
  | 'AGENT_EN_ROUTE'
  | 'LIVREUR_EN_ROUTE'
  | 'COURIER_AT_PICKUP'
  | 'AWAITING_PICKUP_PAYMENT'
  | 'COLLECTED'
  | 'IN_TRANSIT'
  | 'AWAITING_DELIVERY_PAYMENT'
  | 'DELIVERED'
  | 'CANCELLED'

export type CnnDashboard = {
  agentsTotal: number
  agentsOnDuty: number
  motardsTotal: number
  motardsOnDuty: number
  motardsPendingValidation: number
  activeOrders: number
  deliveriesToday: number
  activeAdmins: number
  associationsTotal: number
  clients: number
  subscriptions: number
}

export type CnnOrder = {
  id: string
  clientId: string | null
  deliveryAgentId: string | null
  partnerMotardId: string | null
  courierType: 'COMPANY_AGENT' | 'PARTNER_MOTARD' | null
  pickupAddress: string | null
  deliveryAddress: string | null
  pickupContactName: string | null
  pickupContactPhone: string | null
  parcelType: string | null
  parcelDescription: string | null
  isSecret: boolean | null
  requiresReturnTrip: boolean | null
  estimatedDistanceKm: number | null
  estimatedPrice: number | null
  paymentTiming: 'AT_PICKUP' | 'AT_DELIVERY' | null
  paymentMode: string | null
  orderStatus: OrderStatus
  thirdPartyOrder: boolean | null
  archived: boolean | null
  createdAt: string | null
  updatedAt: string | null
  clientFirstName: string | null
  clientPhone: string | null
  recipientName: string | null
  recipientPhone: string | null
}

export type CnnAgent = {
  id: string
  phone: string
  email: string | null
  status: 'ON_DUTY' | 'OFF_DUTY' | null
  latitude: number | null
  longitude: number | null
  lastPositionAt: string | null
  active: boolean | null
  profilePhotoUrl: string | null
  firstName: string | null
  lastName: string | null
}

export type MotardValidationStatus = 'PENDING_VALIDATION' | 'ASSOCIATION_VALIDATED' | 'APPROVED' | 'REJECTED'

export type CnnMotard = {
  id: string
  phone: string
  email: string | null
  firstName: string | null
  lastName: string | null
  motoRegistrationNumber: string | null
  associationId: string | null
  associationName: string | null
  validationStatus: MotardValidationStatus
  status: 'ON_DUTY' | 'OFF_DUTY' | null
  creditBalance: number | null
  lastPositionAt: string | null
  active: boolean | null
  profilePhotoUrl: string | null
  emergencyPhone: string | null
  pendingDeletionRequestId: string | null
  pendingDeletionReason: string | null
}

export type CnnAssociation = {
  id: string
  name: string
  phone: string
  email: string | null
  active: boolean | null
  totalRevenue: number | null
  createdAt: string | null
  profilePhotoUrl: string | null
  commissionPercent: number | null
}

export type CnnAssociationDetail = CnnAssociation & {
  totalMotards: number
  approvedMotards: number
  pendingMotards: number
}

function qs(params: Record<string, string | undefined | null>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') search.set(key, value)
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const cnnAdmin = {
  status: () => api.get<CnnRelayStatus>('/api/cnn/admin-relay/status'),
  dashboard: () => api.get<CnnDashboard>(`${BASE}/dashboard`),

  orders: (status?: string, search?: string) => api.get<CnnOrder[]>(`${READ}/orders${qs({ status, search })}`),
  cancelOrder: (id: string) => api.post<CnnOrder>(`${BASE}/orders/${id}/cancel`),
  deleteOrder: (id: string) => api.del<void>(`${BASE}/orders/${id}`),

  agents: (status?: string, search?: string) => api.get<CnnAgent[]>(`${READ}/agents${qs({ status, search })}`),
  createAgent: (body: { phone: string; password: string; email?: string; firstName: string; lastName: string; gender: 'MALE' | 'FEMALE'; birthDate: string }) =>
    api.post<CnnAgent>(`${BASE}/agents`, body),
  updateAgent: (id: string, body: { phone?: string; email?: string }) => api.put<CnnAgent>(`${BASE}/agents/${id}`, body),
  setAgentActive: (id: string, active: boolean) => api.patch<CnnAgent>(`${BASE}/agents/${id}/${active ? 'activate' : 'deactivate'}`),
  deleteAgent: (id: string) => api.del<void>(`${BASE}/agents/${id}`),

  motards: (validationStatus?: string, search?: string) =>
    api.get<CnnMotard[]>(`${READ}/motards${qs({ validationStatus, search })}`),
  approveMotard: (id: string) => api.patch<CnnMotard>(`${BASE}/motards/${id}/approve`),
  rejectMotard: (id: string, reason: string) => api.patch<{ message: string }>(`${BASE}/motards/${id}/reject`, { reason }),
  setMotardActive: (id: string, active: boolean) => api.patch<CnnMotard>(`${BASE}/motards/${id}/${active ? 'activate' : 'deactivate'}`),
  updateMotard: (
    id: string,
    body: { phone?: string; email?: string; firstName?: string; lastName?: string; motoRegistrationNumber?: string; emergencyPhone?: string },
  ) => api.put<CnnMotard>(`${BASE}/motards/${id}`, body),
  deleteMotard: (id: string) => api.del<void>(`${BASE}/motards/${id}`),

  associations: (search?: string) => api.get<CnnAssociation[]>(`${READ}/associations${qs({ search })}`),
  association: (id: string) => api.get<CnnAssociationDetail>(`${READ}/associations/${id}`),
  associationMotards: (id: string) => api.get<CnnMotard[]>(`${READ}/associations/${id}/motards`),
  createAssociation: (body: { name: string; phone: string; email?: string; password: string }) =>
    api.post<CnnAssociation>(`${BASE}/associations`, body),
  updateAssociation: (id: string, body: { name?: string; phone?: string; email?: string }) =>
    api.put<CnnAssociation>(`${BASE}/associations/${id}`, body),
  setAssociationActive: (id: string, active: boolean) =>
    api.patch<CnnAssociation>(`${BASE}/associations/${id}/${active ? 'activate' : 'deactivate'}`),
  resetAssociationPassword: (id: string, newPassword: string) =>
    api.post<void>(`${BASE}/associations/${id}/reset-password`, { newPassword }),
  deleteAssociation: (id: string) => api.del<void>(`${BASE}/associations/${id}`),
}

/** Droits de l'agent sur chaque domaine Colis na Nga (calculés par le Core). */
export function useCnnRelay() {
  const query = useQuery({ queryKey: ['cnn-relay-status'], queryFn: cnnAdmin.status, staleTime: 60_000 })
  const writable = Boolean(query.data?.relayReady)
  // Consulter : toujours possible (lecture directe). Modifier : seulement quand le relais répond.
  const can = (scope: CnnScope, action: CnnAction) =>
    Boolean(query.data?.scopes?.[scope]?.[action]) && (action === 'VIEW' || writable)
  return { ...query, configured: query.data?.configured ?? false, writable, can }
}

// ── Synthèse (lecture seule, base Colis na Nga) ────────────────────────────────

type N = number | null
export type CnnSynthese = {
  disponible: boolean
  message: string | null
  calculeLe: string
  readOnlyVerified: boolean
  tauxChange: { usdCdf: number; usdRwf: number | null; majLe: string; source: string } | null
  commandes?: {
    enAttente: N; enCours: N; livreesAujourdhui: N; total: N; livrees: N; annulees: N; actives: N
    creeesAujourdhui: N; creeesCeMois: N; tauxReussite: N; secretes: N; sensibles: N; archivees: N
    parLivreur: N; parMotard: N; chiffreLivre: N
  }
  parStatut?: { statut: string; volume: number }[] | null
  volume30j?: { jour: string; volume: number }[] | null
  livreurs?: { total: N; enService: N; desactives: N }
  motards?: { total: N; enService: N; aValider: N; attenteAssociation: N; approuves: N; refuses: N; creditsEnCirculation: N }
  clients?: { total: N; desactives: N; entreprises: N; entreprisesEnAttente: N; nouveauxCeMois: N }
  abonnements?: {
    actifs: N; total: N; expirant30j: N
    facturesParStatut: { statut: string; nombre: number; montant: number; devise: string | null }[] | null
  }
  revenus?: {
    total: N; paiements: N; mois: N; paiementsMois: N; jour: N; paiementsJour: N; enAttente: N
    parMode: { mode: string; nombre: number; montant: number }[] | null
  }
  mobileMoney?: {
    reussies: { devise: string; nombre: number; montant: number }[] | null
    enCours: N; echouees: N
    parObjet: { objet: string; nombre: number }[] | null
  }
  creditsMotards?: { achats: N; creditsVendus: N; montant: N; partAssociations: N; creditsOfferts: N }
  support?: {
    remboursements: { statut: string; nombre: number }[] | null
    remboursementsEnAttente: N; appelsUrgence: N; appelsUrgenceAujourdhui: N; signalementsOuverts: N; suppressionsMotardEnAttente: N
  }
  associations?: { total: N; actives: N; revenusCumules: N; top: { nom: string; revenus: number; motards: number }[] | null }
  adminsActifs?: N
  notes?: { nombre: N; moyenne: N }
  enService?: { type: 'LIVREUR' | 'MOTARD'; nom: string; telephone: string; dernierePosition: string | null; localise: boolean }[] | null
  dernieresCommandes?: {
    id: string; statut: OrderStatus; depart: string | null; arrivee: string | null; prix: number | null
    typeCoursier: string | null; client: string | null; clientTelephone: string | null; creeLe: string | null
  }[] | null
}

export const fetchCnnSynthese = () => api.get<CnnSynthese>('/api/cnn/synthese')

// ── Carte en direct (lecture seule, base Colis na Nga) ─────────────────────────

export type CnnMapCourier = {
  id: string
  type: 'LIVREUR' | 'MOTARD'
  firstName: string | null
  lastName: string | null
  phone: string | null
  photo: string | null
  status: 'ON_DUTY' | 'OFF_DUTY' | null
  active: boolean | null
  lat: number | null
  lng: number | null
  lastPositionAt: string | null
  courses: number
  associationId?: string | null
  associationName?: string | null
  creditBalance?: number | null
}

export type CnnMapOrder = {
  id: string
  status: OrderStatus
  courierType: 'COMPANY_AGENT' | 'PARTNER_MOTARD' | null
  agentId: string | null
  motardId: string | null
  clientFirstName: string | null
  clientPhone: string | null
  pickupAddress: string | null
  deliveryAddress: string | null
  pickupLat: number | null
  pickupLng: number | null
  deliveryLat: number | null
  deliveryLng: number | null
  price: number | null
  createdAt: string | null
  updatedAt: string | null
}

export type CnnMapData = {
  calculeLe: string
  livreurs: CnnMapCourier[] | null
  motards: CnnMapCourier[] | null
  courses: CnnMapOrder[] | null
  associations: { id: string; name: string; active: boolean | null; motards: number; enService: number }[] | null
  urgences: { id: string; orderId: string | null; callerName: string | null; callerRole: string | null; reason: string | null; calledAt: string | null }[] | null
  activite: { id: string; status: OrderStatus; clientFirstName: string | null; deliveryAddress: string | null; createdAt: string | null; at: string | null }[] | null
}

export const fetchCnnMap = () => api.get<CnnMapData>('/api/cnn/lecture/carte')

// ── Itinéraire d'une commande (lecture seule, base Colis na Nga) ───────────────

export type CnnTraceSearchItem = {
  id: string
  status: OrderStatus
  courierType: 'COMPANY_AGENT' | 'PARTNER_MOTARD' | null
  pickupAddress: string | null
  deliveryAddress: string | null
  price: number | null
  createdAt: string | null
  updatedAt: string | null
  recipientName: string | null
  clientFirstName: string | null
  clientLastName: string | null
  clientPhone: string | null
  courierFirstName: string | null
  courierLastName: string | null
}

export type CnnItineraire = {
  commande: {
    id: string
    status: OrderStatus
    courierType: 'COMPANY_AGENT' | 'PARTNER_MOTARD' | null
    agentId: string | null
    motardId: string | null
    clientFirstName: string | null
    clientLastName: string | null
    clientPhone: string | null
    pickupAddress: string | null
    deliveryAddress: string | null
    pickupLat: number | null
    pickupLng: number | null
    deliveryLat: number | null
    deliveryLng: number | null
    pickupContactName: string | null
    pickupContactPhone: string | null
    recipientName: string | null
    recipientPhone: string | null
    parcelType: string | null
    distanceKm: number | null
    price: number | null
    paymentMode: string | null
    paymentTiming: string | null
    returnTrip: boolean | null
    createdAt: string | null
    updatedAt: string | null
  }
  coursier: (CnnMapCourier & { type: 'LIVREUR' | 'MOTARD' }) | null
  arrets: {
    stopOrder: number
    trackingNumber: string | null
    address: string | null
    lat: number | null
    lng: number | null
    recipientName: string | null
    recipientPhone: string | null
    deliveryStatus: string | null
    paymentStatus: string | null
  }[] | null
  chronologie: { status: string; at: string | null; role: string | null; stopOrder: number }[] | null
  /** Tracé GPS enregistré pendant la course ; null si la table n'existe pas encore côté Colis na Nga. */
  trace: { lat: number; lng: number; at: string | null }[] | null
  /** Trace GPS collée aux routes (Roads API de Google, via le backend Colis na Nga), si disponible. */
  traceRoute?: { lat: number; lng: number }[] | null
}

export const fetchCnnTraceSearch = (search?: string, status?: string) =>
  api.get<CnnTraceSearchItem[]>(`${READ}/carte/commandes${qs({ search, status })}`)
export const fetchCnnItineraire = (id: string) => api.get<CnnItineraire>(`${READ}/orders/${id}/itineraire`)

// ── Statistiques (lecture seule, base Colis na Nga) ────────────────────────────

export type CnnStatKpis = {
  commandes?: number
  livrees?: number
  annulees?: number
  tauxLivraison?: number | null
  chiffreLivre?: number | null
  panierMoyen?: number | null
  distanceMoyenne?: number | null
  nouveauxClients: number | null
  nouveauxMotards: number | null
  creditsVendus: number | null
  revenusCredits: number | null
  revenusAbonnements: number | null
  noteMoyenne: number | null
  urgences: number | null
  signalements: number | null
}
type KV = { cle: string; valeur: number }
export type CnnStatistiques = {
  calculeLe: string
  periode: { jours: number; debut: string; fin: string; granularite: 'jour' | 'mois' }
  kpis: CnnStatKpis | null
  kpisPrecedents: CnnStatKpis | null
  serie: { date: string; creees: number; livrees: number; annulees: number; chiffre: number }[] | null
  parStatut: KV[] | null
  parCoursier: KV[] | null
  parPaiement: KV[] | null
  parTypeColis: KV[] | null
  parHeure: { heure: number; valeur: number }[] | null
  parJourSemaine: { jour: number; valeur: number }[] | null
  inscriptions: { date: string; CLIENT: number; DELIVERY_AGENT: number; PARTNER_MOTARD: number; ASSOCIATION: number }[] | null
  credits: { date: string; credits: number; offerts: number; montant: number }[] | null
  abonnements: { date: string; paiements: number; montant: number }[] | null
  notes: { note: number; valeur: number }[] | null
  topLivreurs: { id: string; nom: string | null; courses: number; livrees: number }[] | null
  topMotards: { id: string; nom: string | null; courses: number; livrees: number }[] | null
  topAssociations: { nom: string; courses: number; livrees: number }[] | null
  signalements: KV[] | null
  urgences: KV[] | null
  remboursements: KV[] | null
}

export const fetchCnnStatistiques = (jours: number) => api.get<CnnStatistiques>(`${READ}/statistiques?jours=${jours}`)

// ── Abonnements, factures et crédits (API admin Colis na Nga, via le relais) ──

export type SubscriptionStatus = 'PENDING' | 'VALIDATED' | 'CANCELLED' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED'
export type PaymentMode = 'CASH' | 'MOBILE_MONEY' | 'MPESA' | 'ORANGE_MONEY' | 'AIRTEL_MONEY' | 'AFRIMONEY' | 'BANK_TRANSFER'
export const PAYMENT_MODES: PaymentMode[] = ['CASH', 'MOBILE_MONEY', 'MPESA', 'ORANGE_MONEY', 'AIRTEL_MONEY', 'AFRIMONEY', 'BANK_TRANSFER']

export type CnnSubscription = {
  id: string
  subscribedClientId: string | null
  planType: string | null
  monthlyPrice: number | null
  startDate: string | null
  expirationDate: string | null
  status: SubscriptionStatus
  clientCount: number
  coursesLimit: number | null
  currency: string | null
  allowCustomDuration: boolean | null
  pricePerCourse: number | null
}
export type CnnSubscriptionInput = {
  planType?: string
  monthlyPrice: number
  startDate?: string
  expirationDate?: string
  status: SubscriptionStatus
  coursesLimit?: number
  currency?: string
  allowCustomDuration?: boolean
  pricePerCourse?: number
}
export type CnnSubscribedClient = {
  id: string
  phone: string | null
  email: string | null
  companyName: string | null
  companyInfo: string | null
  status: SubscriptionStatus
  validatedAt: string | null
  billingTerms: string | null
  active: boolean | null
}
export type InvoiceStatus = 'PAID' | 'PENDING' | 'UNPAID'
export type CnnInvoice = {
  id: string
  clientId: string | null
  subscriptionPaymentId: string | null
  planLabel: string | null
  amount: number | null
  currency: string | null
  paymentMode: PaymentMode | null
  paymentTiming: string | null
  issuedAt: string | null
  dueAt: string | null
  status: InvoiceStatus
  pdfUrl: string | null
  clientName: string | null
  exclusiveCourier: boolean | null
  exclusivitySurcharge: number | null
}
export type CnnCreditPurchase = {
  id: string
  motardId: string
  motardName: string | null
  motardPhone: string | null
  associationName: string | null
  creditsPurchased: number
  amountPaid: number | null
  associationRevenue: number | null
  paymentMode: PaymentMode | null
  isFreeStarter: boolean | null
  purchasedAt: string | null
}

// ── Signalements, urgences, remboursements ─────────────────────────────────────

export type MotardReportCategory = 'BEHAVIOR' | 'FRAUD' | 'NO_SHOW' | 'PARCEL_ISSUE' | 'ACCIDENT' | 'OTHER'
export type CnnMotardReport = {
  id: string
  associationId: string | null
  associationName: string | null
  motardId: string | null
  motardName: string | null
  motardPhone: string | null
  category: MotardReportCategory
  details: string | null
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED'
  adminDecision: string | null
  motardDeactivated: boolean | null
  handledByName: string | null
  handledAt: string | null
  createdAt: string | null
}
export type CnnEmergencyCall = {
  id: string
  callerId: string | null
  callerName: string | null
  callerRole: string | null
  orderId: string | null
  reason: string | null
  phoneDialed: string | null
  calledAt: string | null
}
export type CnnEmergencyContact = { phone: string | null; secondaryPhone: string | null; whatsapp: string | null; hours: string | null; script: string | null }
export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
export type CnnRefund = {
  id: string
  paymentId: string | null
  subscriptionPaymentId: string | null
  orderId: string | null
  requestedBy: string | null
  reason: string | null
  status: RefundStatus
  amount: number | null
  currency: string | null
  requestedAt: string | null
  resolvedAt: string | null
  completedAt: string | null
  adminNote: string | null
}

// ── Tarification ───────────────────────────────────────────────────────────────

export type CnnPricing = {
  id: string
  unitDeliveryPrice: number | null
  pricePerKm: number | null
  minimumPrice: number | null
  sensitiveMultiplier: number | null
  secretMultiplier: number | null
  returnTripMultiplier: number | null
  fragileMultiplier: number | null
  weightMultiplierPerKg: number | null
  extraMultipliers: Record<string, number> | null
  usdToCdfRate: number | null
  updatedAt: string | null
  updatedBy: string | null
}
export type CnnPricingUpdate = Partial<Omit<CnnPricing, 'id' | 'unitDeliveryPrice' | 'usdToCdfRate' | 'updatedAt' | 'updatedBy'>>
export type CnnExchangeRate = { usdToCdf: number | null; usdToRwf: number | null; fetchedAt: string | null }

export const cnnOps = {
  subscriptions: () => api.get<CnnSubscription[]>(`${BASE}/subscriptions`),
  createSubscription: (body: CnnSubscriptionInput) => api.post<CnnSubscription>(`${BASE}/subscriptions`, body),
  updateSubscription: (id: string, body: CnnSubscriptionInput) => api.patch<CnnSubscription>(`${BASE}/subscriptions/${id}`, body),
  deleteSubscription: (id: string) => api.del<void>(`${BASE}/subscriptions/${id}`),
  subscriptionClients: (id: string) => api.get<CnnSubscribedClient[]>(`${BASE}/subscriptions/${id}/clients`),

  subscribedClients: () => api.get<CnnSubscribedClient[]>(`${BASE}/subscribed-clients`),
  validateClient: (id: string) => api.patch<CnnSubscribedClient>(`${BASE}/subscribed-clients/${id}/validate`),
  setClientSubscriptionActive: (id: string, active: boolean) =>
    api.patch<CnnSubscribedClient>(`${BASE}/subscribed-clients/${id}/${active ? 'activate' : 'deactivate'}`),

  invoices: (status?: string) => api.get<CnnInvoice[]>(`${BASE}/subscription-invoices${qs({ status })}`),
  setInvoiceStatus: (id: string, status: InvoiceStatus) => api.patch<CnnInvoice>(`${BASE}/subscription-invoices/${id}/status`, { status }),

  credits: () => api.get<CnnCreditPurchase[]>(`${READ}/credits`),
  assignCredits: (motardId: string, body: { creditCount: number; paymentMode: PaymentMode; offered: boolean }) =>
    api.post<unknown>(`${BASE}/motards/${motardId}/assign-credits`, body),

  motardReports: (status?: string) => api.get<CnnMotardReport[]>(`${BASE}/motard-reports${qs({ status })}`),
  decideReport: (id: string, body: { status: 'RESOLVED' | 'DISMISSED'; decision?: string; deactivateMotard?: boolean }) =>
    api.patch<CnnMotardReport>(`${BASE}/motard-reports/${id}`, body),

  emergencyCalls: () => api.get<CnnEmergencyCall[]>(`${BASE}/emergency-calls`),
  emergencyContact: () => api.get<CnnEmergencyContact>(`${BASE}/emergency-contact`),
  updateEmergencyContact: (body: CnnEmergencyContact) => api.put<CnnEmergencyContact>(`${BASE}/emergency-contact`, body),

  refunds: () => api.get<CnnRefund[]>(`${BASE}/refunds`),
  approveRefund: (id: string) => api.patch<CnnRefund>(`${BASE}/refunds/${id}/approve`),
  rejectRefund: (id: string, message: string) => api.patch<CnnRefund>(`${BASE}/refunds/${id}/reject`, { message }),
  completeRefund: (id: string) => api.patch<CnnRefund>(`${BASE}/refunds/${id}/complete`),

  pricing: () => api.get<CnnPricing>(`${BASE}/pricing`),
  updatePricing: (body: CnnPricingUpdate) => api.patch<CnnPricing>(`${BASE}/pricing`, body),
  exchangeRates: () => api.get<CnnExchangeRate>(`${BASE}/exchange-rates`),
}

// ── Clients (lecture directe ; modifications via le relais) ────────────────────

export type CnnClient = {
  id: string
  type: 'ONE_TIME' | 'SUBSCRIBED'
  firstName: string | null
  lastName: string | null
  phone: string | null
  email: string | null
  profilePhotoUrl: string | null
  active: boolean | null
  createdAt: string | null
  companyName: string | null
  subscriptionStatus: SubscriptionStatus | null
  validatedAt: string | null
  planType: string | null
  orders: number
  delivered: number
  spent: number | null
  lastOrderAt: string | null
}

export const cnnClients = {
  list: (type?: string, search?: string) => api.get<CnnClient[]>(`${READ}/clients${qs({ type, search })}`),
  orders: (id: string) => api.get<CnnOrder[]>(`${READ}/clients/${id}/orders`),
  update: (id: string, body: { phone?: string; email?: string; firstName?: string; lastName?: string }) => api.put<unknown>(`${BASE}/clients/${id}`, body),
  setActive: (id: string, active: boolean) => api.patch<unknown>(`${BASE}/clients/${id}/${active ? 'activate' : 'deactivate'}`),
  subscribe: (id: string, body: { companyName: string; companyInfo?: string; billingTerms?: string }) => api.post<unknown>(`${BASE}/clients/${id}/subscribe`, body),
  remove: (id: string) => api.del<void>(`${BASE}/clients/${id}`),
}
