import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Bike, Building2, Crosshair, Flag, Motorbike, Package, Radio, Route, UserRound, X } from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { Feedback } from '../../components/ui/feedback'
import { PageHeader } from '../../components/ui/page-header'
import { Segmented } from '../../components/ui/segmented'
import { ProjectLogo } from '../../components/ui/brand-marks'
import { useThemeStore } from '../../lib/theme/theme-store'
import { GOOGLE_MAPS_KEY, createHtmlMarker, pathLengthKm, routeThrough, googleMapStyleDark, googleMapStyleLight, loadGoogleMaps, onGoogleAuthFailure, type HtmlMarker } from '../../lib/maps/google'
import { fetchCnnItineraire, fetchCnnMap, type CnnMapCourier, type CnnMapOrder } from '../../lib/api/cnnAdmin'
import { cn } from '../../lib/utils'
import { OrderStatusBadge, fmtMoney, fullName, isFinalOrder, relayErrorMessage, useLocaleTag } from './shared'
import { TraceDetail, TraceFinder } from './CnnTrace'

/** Centre de Kinshasa (vue par défaut quand rien n'est localisé). */
const KINSHASA = { lat: -4.3217, lng: 15.3222 }
/** Au-delà, la position d'un coursier est considérée comme ancienne (marqueur estompé). */
const STALE_MINUTES = 15

const COLORS = {
  livreur: '#F05A1A',
  motard: '#14977F',
  demande: '#7350E6',
  course: '#D9A21C',
  arrivee: '#2B3A7C',
  trace: '#2563EB',
}

/** Itinéraire : couleurs vives, lisibles sur la carte claire comme sur la sombre. */
const ROUTE = {
  depart: '#F59E0B',
  arret: '#8B5CF6',
  livraison: '#EF4444',
  prevu: '#FBBF24',
  reel: { light: '#1D4ED8', dark: '#3B82F6' },
}

/** Marqueur d'étape : pastille, double halo animé et étiquette. */
function routePin(icon: string, color: string, label: string) {
  return `<div class="ma-route-pin" style="--pin:${color}"><span class="ma-route-halo"></span><span class="ma-route-halo is-late"></span><span class="ma-route-core">${icon}</span><span class="ma-route-label">${esc(label)}</span></div>`
}

type Layer = 'livreurs' | 'motards' | 'demandes' | 'courses' | 'trajets'
type Tab = 'live' | 'coursiers' | 'courses' | 'associations' | 'itineraires'

const num = (v: number | string | null | undefined) => (v == null || v === '' ? null : Number(v))
const hasPos = (lat: unknown, lng: unknown) => num(lat as number) != null && num(lng as number) != null

function minutesSince(iso: string | null | undefined) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? null : Math.max(0, Math.round((Date.now() - t) / 60000))
}

function esc(text: unknown) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

/** Pastille ronde avec icône (style MA), en HTML posé sur la carte Google. */
function pinIcon(icon: ReactNode, color: string, opts: { size?: number; faded?: boolean; ring?: boolean } = {}) {
  const size = opts.size ?? 34
  const svg = renderToStaticMarkup(<>{icon}</>)
  return `<span class="ma-pin-dot${opts.faded ? ' is-faded' : ''}${opts.ring ? ' is-busy' : ''}" style="--pin:${color};width:${size}px;height:${size}px">${svg}</span>`
}

const ICON = (node: ReactNode) => node
const motoSvg = ICON(<Motorbike width={18} height={18} strokeWidth={2.2} color="#fff" />)
const partnerSvg = ICON(<Motorbike width={17} height={17} strokeWidth={2.2} color="#fff" />)
const clientSvg = ICON(<UserRound width={16} height={16} strokeWidth={2.4} color="#fff" />)
const pickupSvg = ICON(<Package width={14} height={14} strokeWidth={2.4} color="#fff" />)
const flagSvg = ICON(<Flag width={13} height={13} strokeWidth={2.4} color="#fff" />)

export function CnnLiveMapPage() {
  const { t } = useTranslation()
  const locale = useLocaleTag()
  const dark = useThemeStore((s) => s.theme === 'dark')
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ livreurs: true, motards: true, demandes: true, courses: true, trajets: true })
  const [showOffDuty, setShowOffDuty] = useState(false)
  const [association, setAssociation] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('live')
  const [params, setParams] = useSearchParams()
  const traceId = params.get('commande')
  const openTrace = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('commande', id)
    else next.delete('commande')
    setParams(next, { replace: true })
  }
  const [replay, setReplay] = useState(0)
  const [playing, setPlaying] = useState(false)

  const map = useQuery({ queryKey: ['cnn-map'], queryFn: fetchCnnMap, refetchInterval: traceId ? 30_000 : 5_000 })
  const d = map.data

  // Itinéraire d'une commande (en cours : rafraîchi toutes les 10 s).
  const itin = useQuery({
    queryKey: ['cnn-itineraire', traceId],
    queryFn: () => fetchCnnItineraire(traceId!),
    enabled: Boolean(traceId),
    refetchInterval: (q) => (q.state.data && !isFinalOrder(q.state.data.commande.status) ? 10_000 : false),
  })
  const tracePoints = useMemo(() => itin.data?.trace ?? [], [itin.data])
  useEffect(() => {
    setReplay(0)
    setPlaying(false)
  }, [traceId])
  useEffect(() => {
    // Sans relecture en cours, le marqueur suit le dernier point connu.
    if (!playing) setReplay(Math.max(0, tracePoints.length - 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracePoints.length])
  useEffect(() => {
    if (!playing || tracePoints.length < 2) return
    const step = Math.max(1, Math.round(tracePoints.length / 240))
    const id = window.setInterval(() => {
      setReplay((i) => {
        if (i + step >= tracePoints.length - 1) {
          setPlaying(false)
          return tracePoints.length - 1
        }
        return i + step
      })
    }, 60)
    return () => window.clearInterval(id)
  }, [playing, tracePoints.length])

  const livreurs = useMemo(() => (d?.livreurs ?? []).filter((c) => showOffDuty || c.status === 'ON_DUTY'), [d, showOffDuty])
  const motards = useMemo(
    () => (d?.motards ?? []).filter((c) => (showOffDuty || c.status === 'ON_DUTY') && (!association || c.associationId === association)),
    [d, showOffDuty, association],
  )
  const courses = useMemo(() => d?.courses ?? [], [d])
  const demandes = useMemo(() => courses.filter((o) => o.status === 'PENDING' || o.status === 'PENDING_MOTARD_ACCEPTANCE'), [courses])
  const enCours = useMemo(() => courses.filter((o) => !(o.status === 'PENDING' || o.status === 'PENDING_MOTARD_ACCEPTANCE')), [courses])

  // ── Carte Google (la même que l'application Colis na Nga) ─────────────────
  const host = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const mapsApi = useRef<typeof google.maps | null>(null)
  const info = useRef<google.maps.InfoWindow | null>(null)
  const overlays = useRef<(HtmlMarker | google.maps.Polyline)[]>([])
  const traceOverlays = useRef<(HtmlMarker | google.maps.Polyline)[]>([])
  const animated = useRef<google.maps.Polyline[]>([])
  const replayMarker = useRef<HtmlMarker | null>(null)
  const plannedRoutes = useRef(new Map<string, google.maps.LatLngLiteral[] | null>())
  /** Trajet emprunté aligné sur les routes, par commande : nombre de points GPS couverts et date du calcul. */
  const snappedRoutes = useRef(new Map<string, { count: number; at: number; path: google.maps.LatLngLiteral[] | null }>())
  const [plannedTick, setPlannedTick] = useState(0)
  const markers = useRef(new Map<string, { marker: HtmlMarker; popup: string }>())
  const fitted = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<'NO_KEY' | 'AUTH' | 'LOAD' | null>(GOOGLE_MAPS_KEY ? null : 'NO_KEY')

  useEffect(() => {
    if (!host.current || mapRef.current || !GOOGLE_MAPS_KEY) return
    let cancelled = false
    const off = onGoogleAuthFailure(() => setMapError('AUTH'))
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !host.current) return
        mapsApi.current = maps
        mapRef.current = new maps.Map(host.current, {
          center: KINSHASA,
          zoom: 12,
          styles: document.documentElement.classList.contains('dark') ? googleMapStyleDark : googleMapStyleLight,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: maps.ControlPosition.RIGHT_BOTTOM },
          gestureHandling: 'greedy',
          clickableIcons: false,
          backgroundColor: 'transparent',
        })
        info.current = new maps.InfoWindow()
        setMapReady(true)
      })
      .catch(() => setMapError('LOAD'))
    return () => {
      cancelled = true
      off()
    }
  }, [])

  useEffect(() => {
    mapRef.current?.setOptions({ styles: dark ? googleMapStyleDark : googleMapStyleLight })
  }, [dark, mapReady])

  useEffect(() => {
    const m = mapRef.current
    const maps = mapsApi.current
    if (!m || !maps || !d) return
    overlays.current.forEach((o) => o.setMap(null))
    overlays.current = []
    markers.current.clear()
    // Pendant le suivi d'un itinéraire, seule la commande choisie reste sur la carte.
    if (traceId) return
    const bounds = new maps.LatLngBounds()
    let count = 0
    const positions = new Map<string, google.maps.LatLngLiteral>()

    const openInfo = (marker: HtmlMarker, popup: string) => {
      info.current?.setContent(popup)
      info.current?.setPosition(marker.position)
      info.current?.setOptions({ pixelOffset: new maps.Size(0, -18) })
      info.current?.open({ map: m })
    }
    const add = (key: string | null, pos: google.maps.LatLngLiteral, html: string, popup: string, z: number) => {
      const marker = createHtmlMarker(maps, pos, html, () => openInfo(marker, popup), z)
      marker.setMap(m)
      overlays.current.push(marker)
      if (key) markers.current.set(key, { marker, popup })
      bounds.extend(pos)
      count++
    }
    const line = (path: google.maps.LatLngLiteral[], color: string, dashed: boolean) => {
      const poly = new maps.Polyline({
        path,
        map: m,
        strokeColor: color,
        strokeOpacity: dashed ? 0 : 0.9,
        strokeWeight: dashed ? 3 : 2.5,
        icons: dashed ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, scale: 3 }, offset: '0', repeat: '14px' }] : undefined,
        clickable: false,
      })
      overlays.current.push(poly)
    }

    const courierPopup = (c: CnnMapCourier) => {
      const age = minutesSince(c.lastPositionAt)
      return `<div class="ma-pop"><strong>${esc(fullName(c.firstName, c.lastName, c.phone))}</strong>
        <span>${esc(c.type === 'LIVREUR' ? t('cnnMap.livreurCnn', 'Livreur Colis na Nga') : `${t('cnnMap.motardOf', 'Motard')} · ${c.associationName ?? ''}`)}</span>
        <span>${esc(c.phone ?? '')}</span>
        <span>${esc(c.courses > 0 ? t('cnnMap.onJob', 'En course ({{n}})', { n: c.courses }) : c.status === 'ON_DUTY' ? t('cnnMap.available', 'Disponible') : t('cnnAdmin.common.offDuty', 'Hors service'))}</span>
        <em>${esc(age == null ? t('cnnMap.noPosition', 'Position inconnue') : t('cnnMap.seen', 'Position il y a {{n}} min', { n: age }))}</em></div>`
    }

    const couriers: [CnnMapCourier[], boolean][] = [
      [livreurs, layers.livreurs],
      [motards, layers.motards],
    ]
    for (const [list, visible] of couriers) {
      for (const c of list) {
        if (!hasPos(c.lat, c.lng)) continue
        const pos = { lat: num(c.lat)!, lng: num(c.lng)! }
        positions.set(c.id, pos)
        if (!visible) continue
        const age = minutesSince(c.lastPositionAt)
        const faded = c.status !== 'ON_DUTY' || age == null || age > STALE_MINUTES
        const html =
          c.type === 'LIVREUR'
            ? pinIcon(motoSvg, COLORS.livreur, { size: 36, faded, ring: c.courses > 0 })
            : pinIcon(partnerSvg, COLORS.motard, { size: 32, faded, ring: c.courses > 0 })
        add(`c:${c.id}`, pos, html, courierPopup(c), c.type === 'LIVREUR' ? 60 : 50)
      }
    }

    const orderPopup = (o: CnnMapOrder, title: string) =>
      `<div class="ma-pop"><strong>${esc(title)} · ${esc(o.id.slice(0, 8).toUpperCase())}</strong>
        <span>${esc([o.clientFirstName, o.clientPhone].filter(Boolean).join(' · '))}</span>
        <span>${esc(o.pickupAddress ?? '')}</span><span>→ ${esc(o.deliveryAddress ?? '')}</span>
        <span>${esc(t(`cnnAdmin.orderStatus.${o.status}`, { defaultValue: o.status }))} · ${esc(fmtMoney(o.price, locale))}</span></div>`

    if (layers.demandes) {
      for (const o of demandes) {
        if (!hasPos(o.pickupLat, o.pickupLng)) continue
        add(`o:${o.id}`, { lat: num(o.pickupLat)!, lng: num(o.pickupLng)! }, pinIcon(clientSvg, COLORS.demande, { size: 30, ring: true }), orderPopup(o, t('cnnMap.request', 'Demande client')), 70)
      }
    }
    if (layers.courses) {
      for (const o of enCours) {
        const courier = o.agentId ? positions.get(o.agentId) : o.motardId ? positions.get(o.motardId) : undefined
        const pickup = hasPos(o.pickupLat, o.pickupLng) ? { lat: num(o.pickupLat)!, lng: num(o.pickupLng)! } : null
        const dest = hasPos(o.deliveryLat, o.deliveryLng) ? { lat: num(o.deliveryLat)!, lng: num(o.deliveryLng)! } : null
        if (pickup) add(`o:${o.id}`, pickup, pinIcon(pickupSvg, COLORS.course, { size: 24 }), orderPopup(o, t('cnnMap.order', 'Course')), 30)
        if (dest) add(null, dest, pinIcon(flagSvg, COLORS.arrivee, { size: 22 }), orderPopup(o, t('cnnMap.destination', 'Arrivée')), 20)
        if (layers.trajets) {
          if (pickup && dest) line([pickup, dest], COLORS.course, true)
          if (courier) {
            const collected = o.status === 'COLLECTED' || o.status === 'IN_TRANSIT' || o.status === 'AWAITING_DELIVERY_PAYMENT'
            const next = collected ? dest : pickup
            if (next) line([courier, next], o.courierType === 'PARTNER_MOTARD' ? COLORS.motard : COLORS.livreur, false)
          }
        }
      }
    }

    if (!fitted.current && count > 0) {
      fitted.current = true
      m.fitBounds(bounds, 60)
      if ((m.getZoom() ?? 12) > 14) m.setZoom(14)
    }
  }, [d, livreurs, motards, demandes, enCours, layers, locale, t, mapReady, traceId])

  // ── Itinéraire : départ, arrêts, trajet prévu (pointillés) et trajet réel (trait plein) ──
  const traceFitted = useRef<string | null>(null)
  useEffect(() => {
    const m = mapRef.current
    const maps = mapsApi.current
    traceOverlays.current.forEach((o) => o.setMap(null))
    traceOverlays.current = []
    animated.current = []
    replayMarker.current?.setMap(null)
    replayMarker.current = null
    if (!traceId) traceFitted.current = null
    if (!m || !maps || !traceId || !itin.data) return
    const data = itin.data
    const o = data.commande
    const bounds = new maps.LatLngBounds()
    const pin = (pos: google.maps.LatLngLiteral, html: string, popup: string, z: number) => {
      const marker = createHtmlMarker(maps, pos, html, () => {
        info.current?.setContent(popup)
        info.current?.setPosition(marker.position)
        info.current?.setOptions({ pixelOffset: new maps.Size(0, -18) })
        info.current?.open({ map: m })
      }, z)
      marker.setMap(m)
      traceOverlays.current.push(marker)
      bounds.extend(pos)
      return marker
    }
    const pickup = hasPos(o.pickupLat, o.pickupLng) ? { lat: num(o.pickupLat)!, lng: num(o.pickupLng)! } : null
    const stops = (data.arrets ?? []).filter((s) => hasPos(s.lat, s.lng)).map((s) => ({ ...s, pos: { lat: num(s.lat)!, lng: num(s.lng)! } }))
    if (!stops.length && hasPos(o.deliveryLat, o.deliveryLng)) {
      stops.push({ stopOrder: 0, trackingNumber: null, address: o.deliveryAddress, lat: o.deliveryLat, lng: o.deliveryLng, recipientName: o.recipientName, recipientPhone: o.recipientPhone, deliveryStatus: null, paymentStatus: null, pos: { lat: num(o.deliveryLat)!, lng: num(o.deliveryLng)! } })
    }
    if (pickup) pin(pickup, routePin(renderToStaticMarkup(<Package strokeWidth={2.4} color="#fff" />), ROUTE.depart, t('cnnTrace.start', 'Départ')), `<div class="ma-pop"><strong>${esc(t('cnnTrace.pickup', 'Récupération'))}</strong><span>${esc(o.pickupAddress ?? '')}</span></div>`, 90)
    stops.forEach((s, i) => {
      const last = i === stops.length - 1
      const html = last
        ? routePin(renderToStaticMarkup(<Flag strokeWidth={2.4} color="#fff" />), ROUTE.livraison, t('cnnTrace.delivery', 'Livraison'))
        : routePin(String(i + 1), ROUTE.arret, t('cnnTrace.stop', 'Arrêt {{n}}', { n: i + 1 }))
      pin(s.pos, html, `<div class="ma-pop"><strong>${esc(stops.length > 1 ? t('cnnTrace.stop', 'Arrêt {{n}}', { n: i + 1 }) : t('cnnTrace.delivery', 'Livraison'))}</strong><span>${esc(s.address ?? '')}</span><span>${esc([s.recipientName, s.recipientPhone].filter(Boolean).join(' · '))}</span></div>`, last ? 92 : 91)
    })

    // Trajet prévu : itinéraire routier Google si disponible, sinon lignes directes.
    const waypoints = [pickup, ...stops.map((s) => s.pos)].filter(Boolean) as google.maps.LatLngLiteral[]
    const planned = plannedRoutes.current.get(o.id)
    const plannedPath = planned ?? waypoints
    const casing = dark ? '#05070d' : '#ffffff'
    const hasReal = tracePoints.length >= 2
    if (plannedPath.length >= 2) {
      // Trajet prévu : bordure contrastée, trait ambré épais et tirets qui défilent (effet « en direct »).
      const plannedOpacity = hasReal ? 0.55 : 1
      traceOverlays.current.push(
        new maps.Polyline({ path: plannedPath, map: m, strokeColor: casing, strokeOpacity: 0.95 * plannedOpacity, strokeWeight: hasReal ? 7 : 10, clickable: false, zIndex: 4 }),
        new maps.Polyline({ path: plannedPath, map: m, strokeColor: ROUTE.prevu, strokeOpacity: plannedOpacity, strokeWeight: hasReal ? 4 : 6, clickable: false, zIndex: 5 }),
      )
      const flow = new maps.Polyline({
        path: plannedPath,
        map: m,
        strokeOpacity: 0,
        icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: dark ? '#fff7d6' : '#7a4b00', strokeWeight: 3, scale: 2.4 }, offset: '0', repeat: '22px' }],
        clickable: false,
        zIndex: 6,
      })
      traceOverlays.current.push(flow)
      animated.current.push(flow)
    }
    if (planned === undefined && waypoints.length >= 2) {
      plannedRoutes.current.set(o.id, null)
      routeThrough(maps, waypoints, { stopover: true })
        .then((route) => {
          if (route) {
            plannedRoutes.current.set(o.id, route)
            setPlannedTick((n) => n + 1)
          }
        })
        .catch(() => undefined)
    }

    // Trajet réellement emprunté : points GPS enregistrés, alignés sur les routes (Directions API).
    // Si l'alignement est impossible ou s'écarte trop du GPS, on trace les points GPS bruts.
    const path = tracePoints.map((p) => ({ lat: p.lat, lng: p.lng }))
    if (path.length >= 2) {
      const active = !isFinalOrder(o.status)
      const snap = snappedRoutes.current.get(o.id)
      const stale = !snap || (snap.count !== path.length && (!active || Date.now() - snap.at > 60_000))
      if (stale && snap?.path !== undefined && snap?.count === -1) {
        // calcul déjà en cours
      } else if (stale) {
        const count = path.length
        snappedRoutes.current.set(o.id, { count: -1, at: Date.now(), path: snap?.path ?? null })
        routeThrough(maps, path)
          .then((route) => {
            const gps = pathLengthKm(path)
            const ok = route && pathLengthKm(route) <= Math.max(gps * 1.35, gps + 0.4)
            snappedRoutes.current.set(o.id, { count, at: Date.now(), path: ok ? route : null })
            setPlannedTick((n) => n + 1)
          })
          .catch(() => snappedRoutes.current.set(o.id, { count, at: Date.now(), path: null }))
      }
      const current = snappedRoutes.current.get(o.id)
      const covered = current && current.count > 0 ? current.count : 0
      const segments: google.maps.LatLngLiteral[][] = []
      if (current?.path && covered >= 2) {
        segments.push(current.path)
        if (covered < path.length) segments.push(path.slice(covered - 1))
      } else {
        segments.push(path)
      }
      const real = dark ? ROUTE.reel.dark : ROUTE.reel.light
      for (const seg of segments) {
        // Halo lumineux, bordure contrastée, trait plein, puis flèches qui avancent dans le sens du trajet.
        const glow = new maps.Polyline({ path: seg, map: m, strokeColor: real, strokeOpacity: dark ? 0.35 : 0.22, strokeWeight: 18, clickable: false, zIndex: 7 })
        const outline = new maps.Polyline({ path: seg, map: m, strokeColor: casing, strokeOpacity: 1, strokeWeight: 11, clickable: false, zIndex: 8 })
        const lineReal = new maps.Polyline({ path: seg, map: m, strokeColor: real, strokeOpacity: 1, strokeWeight: 7, clickable: false, zIndex: 9 })
        const arrows = new maps.Polyline({
          path: seg,
          map: m,
          strokeOpacity: 0,
          icons: [{ icon: { path: maps.SymbolPath.FORWARD_OPEN_ARROW, strokeColor: '#ffffff', strokeOpacity: 1, strokeWeight: 2.5, scale: 2.6 }, offset: '0', repeat: '70px' }],
          clickable: false,
          zIndex: 10,
        })
        traceOverlays.current.push(glow, outline, lineReal, arrows)
        animated.current.push(arrows)
      }
      path.forEach((p) => bounds.extend(p))
      const start = createHtmlMarker(maps, path[0], `<span class="ma-route-start" style="--pin:${dark ? ROUTE.reel.dark : ROUTE.reel.light}"></span>`, () => undefined, 85)
      start.setMap(m)
      traceOverlays.current.push(start)
    }

    // Coursier : position relue (relecture) ou position actuelle pendant une course en cours.
    const courierColor = o.courierType === 'PARTNER_MOTARD' ? COLORS.motard : COLORS.livreur
    const live = data.coursier && !isFinalOrder(o.status) && hasPos(data.coursier.lat, data.coursier.lng) ? { lat: num(data.coursier.lat)!, lng: num(data.coursier.lng)! } : null
    const startPos = path.length ? path[Math.min(replay, path.length - 1)] : live
    if (startPos) {
      const rm = createHtmlMarker(maps, startPos, pinIcon(motoSvg, courierColor, { size: 40, ring: true }), () => undefined, 95)
      rm.setMap(m)
      replayMarker.current = rm
      bounds.extend(startPos)
    }

    if (traceFitted.current !== o.id && !bounds.isEmpty()) {
      traceFitted.current = o.id
      m.fitBounds(bounds, 70)
      if ((m.getZoom() ?? 12) > 16) m.setZoom(16)
    }
    // La relecture déplace seulement le marqueur (effet suivant) : `replay` n'est pas une dépendance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traceId, itin.data, tracePoints, mapReady, plannedTick, t, dark])

  // Animation des tirets et des flèches de l'itinéraire (désactivée si l'utilisateur réduit les animations).
  useEffect(() => {
    if (!traceId || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let step = 0
    const id = window.setInterval(() => {
      step = (step + 1) % 1000
      for (const line of animated.current) {
        const icons = line.get('icons') as google.maps.IconSequence[] | undefined
        if (!icons?.length) continue
        const repeat = parseFloat(String(icons[0].repeat ?? '22'))
        icons[0] = { ...icons[0], offset: `${(step * 1.2) % repeat}px` }
        line.set('icons', icons)
      }
    }, 50)
    return () => window.clearInterval(id)
  }, [traceId])

  useEffect(() => {
    const marker = replayMarker.current
    const p = tracePoints[Math.min(replay, tracePoints.length - 1)]
    if (!marker || !p || !mapsApi.current) return
    marker.position = new mapsApi.current.LatLng(p.lat, p.lng)
    marker.draw()
  }, [replay, tracePoints])

  const focus = (key: string, lat?: number | null, lng?: number | null) => {
    const m = mapRef.current
    if (!m) return
    const entry = markers.current.get(key)
    if (entry) {
      m.panTo(entry.marker.position)
      m.setZoom(Math.max(m.getZoom() ?? 12, 15))
      info.current?.setContent(entry.popup)
      info.current?.setPosition(entry.marker.position)
      info.current?.open({ map: m })
    } else if (lat != null && lng != null) {
      m.panTo({ lat, lng })
      m.setZoom(15)
    }
  }

  const recenter = () => {
    const m = mapRef.current
    const maps = mapsApi.current
    if (!m || !maps) return
    const all = Array.from(markers.current.values())
    if (all.length) {
      const b = new maps.LatLngBounds()
      all.forEach((x) => b.extend(x.marker.position))
      m.fitBounds(b, 60)
    } else {
      m.setCenter(KINSHASA)
      m.setZoom(12)
    }
  }

  // ── Compteurs ──────────────────────────────────────────────────────────────
  const onDuty = (list: CnnMapCourier[] | null | undefined) => (list ?? []).filter((c) => c.status === 'ON_DUTY').length
  const counts = {
    livreurs: onDuty(d?.livreurs),
    motards: onDuty(d?.motards),
    demandes: demandes.length,
    courses: enCours.length,
  }
  const layerChips: { key: Layer; label: string; color: string; icon: ReactNode; count?: number }[] = [
    { key: 'livreurs', label: t('cnnMap.layerAgents', 'Livreurs'), color: COLORS.livreur, icon: <Motorbike />, count: counts.livreurs },
    { key: 'motards', label: t('cnnMap.layerMotards', 'Motards partenaires'), color: COLORS.motard, icon: <Bike />, count: counts.motards },
    { key: 'demandes', label: t('cnnMap.layerRequests', 'Demandes clients'), color: COLORS.demande, icon: <UserRound />, count: counts.demandes },
    { key: 'courses', label: t('cnnMap.layerOrders', 'Courses en cours'), color: COLORS.course, icon: <Package />, count: counts.courses },
    { key: 'trajets', label: t('cnnMap.layerRoutes', 'Trajets'), color: COLORS.arrivee, icon: <Route /> },
  ]

  const updated = d?.calculeLe ? new Date(d.calculeLe).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null

  return (
    <div className="space-y-5">
      <PageHeader
        kicker="Colis na Nga"
        title={
          <span className="flex items-center gap-3">
            <ProjectLogo code="CNN" size="md" />
            <span>{t('cnnMap.title', 'Carte en direct')}</span>
          </span>
        }
        subtitle={t('cnnMap.subtitle', 'Livreurs, motards, demandes des clients et courses, suivis en temps réel.')}
        actions={
          <Badge tone={map.isError ? 'danger' : 'success'} dot className="h-7 px-3 text-[12px]">
            <Radio className="h-3.5 w-3.5" />
            {map.isError ? t('cnnMap.offline', 'Flux interrompu') : updated ? t('cnnMap.live', 'En direct · {{time}}', { time: updated }) : t('cnnMap.loading', 'Connexion…')}
          </Badge>
        }
      />
      {map.isError && <Feedback tone="danger">{relayErrorMessage(map.error, (k, v) => t(k, v))}</Feedback>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Carte */}
        <div className="clay relative overflow-hidden rounded-[var(--radius-ma)] ring-1 ring-hairline">
          <div ref={host} className="ma-map h-[calc(100dvh-250px)] min-h-[520px] w-full" />
          {mapError && (
            <div className="absolute inset-0 z-[600] flex items-center justify-center bg-canvas/80 p-6 backdrop-blur-sm">
              <div className="max-w-md text-center">
                <p className="text-[15px] font-semibold text-ink">{t('cnnMap.mapUnavailable', 'Carte Google indisponible')}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
                  {mapError === 'NO_KEY'
                    ? t('cnnMap.noKey', 'Ajoutez la clé Google Maps (VITE_GOOGLE_MAPS_API_KEY) dans frontend/.env.local, puis relancez npm run dev.')
                    : mapError === 'AUTH'
                      ? t('cnnMap.authFail', 'Google refuse la clé : activez « Maps JavaScript API » et autorisez http://localhost:5173/* pour cette clé dans Google Cloud.')
                      : t('cnnMap.loadFail', 'Impossible de charger Google Maps. Vérifiez la connexion internet.')}
                </p>
              </div>
            </div>
          )}
          {traceId && (
            <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex flex-wrap gap-2">
              <span className="glass-strong pointer-events-auto inline-flex h-9 items-center gap-2 rounded-full pl-3 pr-1.5 text-[12.5px] font-semibold text-ink">
                <Route className="h-3.5 w-3.5" style={{ color: COLORS.trace }} />
                {t('cnnTrace.chip', 'Itinéraire de la commande {{id}}', { id: traceId.slice(0, 8).toUpperCase() })}
                <button type="button" onClick={() => openTrace(null)} aria-label={t('cnnTrace.close', 'Revenir au direct')} className="press inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-ink/[0.06]">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
              <span className="glass-strong pointer-events-auto inline-flex h-9 items-center gap-3 rounded-full px-3 text-[12px] text-ink-2">
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-6 rounded-full" style={{ background: dark ? ROUTE.reel.dark : ROUTE.reel.light }} />{t('cnnTrace.legendReal', 'Trajet emprunté')}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-6 rounded-full" style={{ background: ROUTE.prevu }} />{t('cnnTrace.legendPlanned', 'Trajet prévu')}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ROUTE.depart }} />{t('cnnTrace.start', 'Départ')}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ROUTE.arret }} />{t('cnnTrace.stops', 'Arrêts')}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ROUTE.livraison }} />{t('cnnTrace.delivery', 'Livraison')}</span>
              </span>
            </div>
          )}
          <div className={cn('pointer-events-none absolute inset-x-3 top-3 z-[500] flex flex-wrap gap-2', traceId && 'hidden')}>
            {layerChips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setLayers((l) => ({ ...l, [c.key]: !l[c.key] }))}
                aria-pressed={layers[c.key]}
                className={cn(
                  'glass-strong press pointer-events-auto inline-flex h-9 items-center gap-2 rounded-full px-3 text-[12.5px] font-semibold transition-opacity [&_svg]:h-3.5 [&_svg]:w-3.5',
                  layers[c.key] ? 'text-ink' : 'text-ink-3 opacity-60',
                )}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: c.color }}>
                  {c.icon}
                </span>
                {c.label}
                {c.count != null && <span className="tabular-nums text-ink-3">{c.count}</span>}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowOffDuty((v) => !v)}
              aria-pressed={showOffDuty}
              className={cn('glass-strong press pointer-events-auto inline-flex h-9 items-center rounded-full px-3 text-[12.5px] font-semibold', showOffDuty ? 'text-ink' : 'text-ink-3')}
            >
              {showOffDuty ? t('cnnMap.hideOff', 'Masquer hors service') : t('cnnMap.showOff', 'Afficher hors service')}
            </button>
          </div>
          <button
            type="button"
            onClick={recenter}
            title={t('cnnMap.recenter', 'Recentrer')}
            aria-label={t('cnnMap.recenter', 'Recentrer')}
            className="glass-strong press absolute bottom-[92px] right-[10px] z-[500] inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-ink"
          >
            <Crosshair className="h-4 w-4" />
          </button>
        </div>

        {/* Panneau latéral */}
        <aside className="clay flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-ma)] ring-1 ring-hairline xl:h-[calc(100dvh-250px)] xl:min-h-[520px]">
          {traceId ? (
            <div className="flex min-h-0 flex-1 flex-col pt-3">
              <TraceDetail
                data={itin.data}
                loading={itin.isLoading}
                error={itin.isError ? itin.error : null}
                onBack={() => openTrace(null)}
                replay={replay}
                onReplay={setReplay}
                playing={playing}
                onPlaying={setPlaying}
                colors={{ pickup: ROUTE.depart, stop: ROUTE.arret, delivery: ROUTE.livraison, trace: dark ? ROUTE.reel.dark : ROUTE.reel.light }}
              />
            </div>
          ) : (
          <>
          <div className="grid grid-cols-2 gap-2 p-4">
            <Stat label={t('cnnMap.statAgents', 'Livreurs en service')} value={counts.livreurs} color={COLORS.livreur} />
            <Stat label={t('cnnMap.statMotards', 'Motards en service')} value={counts.motards} color={COLORS.motard} />
            <Stat label={t('cnnMap.statRequests', 'Demandes en attente')} value={counts.demandes} color={COLORS.demande} />
            <Stat label={t('cnnMap.statOrders', 'Courses en cours')} value={counts.courses} color={COLORS.course} />
          </div>
          <div className="px-4 pb-3">
            <Segmented<Tab>
              size="sm"
              value={tab}
              onChange={setTab}
              ariaLabel={t('cnnMap.panel', 'Panneau')}
              className="w-full"
              options={[
                { value: 'live', label: t('cnnMap.tabLive', 'Activité') },
                { value: 'coursiers', label: t('cnnMap.tabCouriers', 'Coursiers') },
                { value: 'courses', label: t('cnnMap.tabOrders', 'Courses') },
                { value: 'associations', label: t('cnnMap.tabAssociations', 'Associations') },
                { value: 'itineraires', label: t('cnnMap.tabTraces', 'Itinéraires') },
              ]}
            />
          </div>
          {tab === 'itineraires' && (
            <div className="flex min-h-0 flex-1 flex-col border-t border-hairline pt-3">
              <TraceFinder onPick={(id) => openTrace(id)} />
            </div>
          )}
          <div className={cn('ma-scroll min-h-0 flex-1 overflow-y-auto border-t border-hairline', tab === 'itineraires' && 'hidden')}>
            {tab === 'live' && (
              <ul className="divide-y divide-hairline">
                {(d?.urgences ?? []).map((u) => (
                  <li key={u.id}>
                    <button type="button" onClick={() => u.orderId && openTrace(u.orderId)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-status-danger/5">
                      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-status-danger/12 text-status-danger">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-ink">
                          {t('cnnMap.emergency', 'Appel d’urgence')} · {u.callerName || '–'}
                        </span>
                        <span className="block truncate text-[12px] text-ink-3">{u.reason || u.callerRole || ''}</span>
                      </span>
                      <Ago iso={u.calledAt} />
                    </button>
                  </li>
                ))}
                {(d?.activite ?? []).map((a) => (
                  <li key={`a-${a.id}`}>
                    <button type="button" onClick={() => openTrace(a.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-ink/[0.03] dark:hover:bg-white/[0.04]">
                      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink-2 dark:bg-white/[0.08]">
                        <Package className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="mb-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] font-semibold text-ink">{a.clientFirstName || t('cnnAdmin.orders.client', 'Client')}</span>
                          <OrderStatusBadge status={a.status} />
                        </span>
                        <span className="block truncate text-[12px] text-ink-3">→ {a.deliveryAddress || '–'}</span>
                      </span>
                      <Ago iso={a.at} />
                    </button>
                  </li>
                ))}
                {!map.isLoading && (d?.activite ?? []).length === 0 && (d?.urgences ?? []).length === 0 && <Empty text={t('cnnMap.noActivity', 'Aucune activité récente.')} />}
              </ul>
            )}

            {tab === 'coursiers' && (
              <ul className="divide-y divide-hairline">
                {[...livreurs, ...motards].map((c) => {
                  const age = minutesSince(c.lastPositionAt)
                  const located = hasPos(c.lat, c.lng)
                  return (
                    <li key={`${c.type}-${c.id}`}>
                      <button type="button" onClick={() => focus(`c:${c.id}`)} disabled={!located} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink/[0.03] disabled:cursor-default dark:hover:bg-white/[0.04]">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white" style={{ background: c.type === 'LIVREUR' ? COLORS.livreur : COLORS.motard, opacity: c.status === 'ON_DUTY' ? 1 : 0.5 }}>
                          <Motorbike className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-ink">{fullName(c.firstName, c.lastName, c.phone)}</span>
                          <span className="block truncate text-[12px] text-ink-3">
                            {c.type === 'LIVREUR' ? t('cnnMap.livreurCnn', 'Livreur Colis na Nga') : c.associationName || t('cnnMap.motardOf', 'Motard')}
                            {' · '}
                            {!located ? t('cnnMap.noPosition', 'Position inconnue') : age == null ? '' : t('cnnMap.seenShort', 'il y a {{n}} min', { n: age })}
                          </span>
                        </span>
                        {c.courses > 0 ? (
                          <Badge tone="gold">{t('cnnMap.onJobShort', 'En course')}</Badge>
                        ) : c.status === 'ON_DUTY' ? (
                          <Badge tone="success" dot>{t('cnnMap.available', 'Disponible')}</Badge>
                        ) : (
                          <Badge tone="muted">{t('cnnAdmin.common.offDuty', 'Hors service')}</Badge>
                        )}
                      </button>
                    </li>
                  )
                })}
                {!map.isLoading && livreurs.length + motards.length === 0 && <Empty text={t('cnnMap.noCouriers', 'Aucun coursier en service.')} />}
              </ul>
            )}

            {tab === 'courses' && (
              <ul className="divide-y divide-hairline">
                {courses.map((o) => (
                  <li key={o.id}>
                    <button type="button" onClick={() => focus(`o:${o.id}`, num(o.pickupLat), num(o.pickupLng))} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-ink/[0.03] dark:hover:bg-white/[0.04]">
                      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white" style={{ background: o.status === 'PENDING' || o.status === 'PENDING_MOTARD_ACCEPTANCE' ? COLORS.demande : COLORS.course }}>
                        {o.status === 'PENDING' || o.status === 'PENDING_MOTARD_ACCEPTANCE' ? <UserRound className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="mb-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] font-semibold text-ink">{o.clientFirstName || t('cnnAdmin.orders.client', 'Client')}</span>
                          <OrderStatusBadge status={o.status} />
                        </span>
                        <span className="block truncate text-[12px] text-ink-3">{o.pickupAddress || '–'}</span>
                        <span className="block truncate text-[12px] text-ink-3">→ {o.deliveryAddress || '–'}</span>
                      </span>
                      <span className="shrink-0 text-[12px] font-medium tabular-nums text-ink-2">{fmtMoney(o.price, locale)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openTrace(o.id)}
                      className="mx-4 mb-3 -mt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent-ink hover:underline"
                    >
                      <Route className="h-3.5 w-3.5" />
                      {t('cnnTrace.follow', 'Suivre l’itinéraire')}
                    </button>
                  </li>
                ))}
                {!map.isLoading && courses.length === 0 && <Empty text={t('cnnMap.noOrders', 'Aucune course en cours.')} />}
              </ul>
            )}

            {tab === 'associations' && (
              <ul className="divide-y divide-hairline">
                {(d?.associations ?? []).map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setAssociation((cur) => (cur === a.id ? null : a.id))}
                      aria-pressed={association === a.id}
                      className={cn('flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink/[0.03] dark:hover:bg-white/[0.04]', association === a.id && 'bg-ma-gold-500/10')}
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/14 text-violet-600 dark:text-violet-300">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-ink">{a.name}</span>
                        <span className="block text-[12px] text-ink-3">
                          {t('cnnMap.assoMotards', '{{on}} en service sur {{total}} motards', { on: a.enService, total: a.motards })}
                        </span>
                      </span>
                      {association === a.id ? <Badge tone="gold">{t('cnnMap.filtered', 'Filtré')}</Badge> : !a.active && <Badge tone="muted">{t('cnnAdmin.common.inactive', 'Désactivé')}</Badge>}
                    </button>
                  </li>
                ))}
                {!map.isLoading && (d?.associations ?? []).length === 0 && <Empty text={t('cnnAdmin.associations.empty', 'Aucune association')} />}
              </ul>
            )}
          </div>
          {association && tab !== 'itineraires' && (
            <div className="border-t border-hairline px-4 py-2.5 text-[12px] text-ink-3">
              {t('cnnMap.filterHint', 'Seuls les motards de cette association sont affichés.')}{' '}
              <button type="button" className="font-semibold text-accent-ink hover:underline" onClick={() => setAssociation(null)}>
                {t('cnnMap.clearFilter', 'Tout afficher')}
              </button>
            </div>
          )}
          </>
          )}
        </aside>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="clay-field rounded-[14px] px-3 py-2.5">
      <p className="flex items-center gap-1.5 truncate text-[11.5px] text-ink-3">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        {label}
      </p>
      <p className="mt-0.5 text-[22px] font-bold tabular-nums tracking-[-0.03em] text-ink">{value}</p>
    </div>
  )
}

function Ago({ iso }: { iso: string | null | undefined }) {
  const { t } = useTranslation()
  const n = minutesSince(iso)
  if (n == null) return null
  const label = n < 1 ? t('cnnMap.now', 'à l’instant') : n < 60 ? t('cnnMap.min', '{{n}} min', { n }) : n < 1440 ? t('cnnMap.hours', '{{n}} h', { n: Math.floor(n / 60) }) : t('cnnMap.days', '{{n}} j', { n: Math.floor(n / 1440) })
  return <span className="shrink-0 text-[11.5px] tabular-nums text-ink-3">{label}</span>
}

function Empty({ text }: { text: string }) {
  return <li className="px-4 py-10 text-center text-[13px] text-ink-3">{text}</li>
}
