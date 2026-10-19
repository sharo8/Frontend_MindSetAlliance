/// <reference types="google.maps" />

/**
 * Google Maps, la même carte que l'application Colis na Nga (mêmes styles clair et sombre).
 * Clé : VITE_GOOGLE_MAPS_API_KEY dans frontend/.env.local (jamais commité).
 */

export const GOOGLE_MAPS_KEY: string = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? ''

let loading: Promise<typeof google.maps> | null = null
let authFailed = false
const authListeners = new Set<() => void>()

/** Google appelle cette fonction globale quand la clé est refusée (API non activée, domaine non autorisé…). */
;(window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
  authFailed = true
  authListeners.forEach((fn) => fn())
}

export function onGoogleAuthFailure(fn: () => void) {
  if (authFailed) fn()
  authListeners.add(fn)
  return () => authListeners.delete(fn)
}

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error('NO_KEY'))
  if (window.google?.maps) return Promise.resolve(window.google.maps)
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const callback = '__maGoogleMapsReady'
      ;(window as unknown as Record<string, () => void>)[callback] = () => resolve(window.google.maps)
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&v=weekly&language=fr&region=CD&callback=${callback}`
      script.async = true
      script.onerror = () => {
        loading = null
        reject(new Error('LOAD_FAILED'))
      }
      document.head.appendChild(script)
    })
  }
  return loading
}

// Styles repris tels quels de l'application Colis na Nga (src/config/mapStyle.ts).
export const googleMapStyleLight: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#F7F8FC' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F7F8FC' }, { weight: 4 }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#D0D6E4' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'on' }] },
  { featureType: 'landscape', elementType: 'geometry.fill', stylers: [{ color: '#F7F8FC' }] },
  { featureType: 'landscape.natural', elementType: 'geometry.fill', stylers: [{ color: '#EAF6EF' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#DFF3E6' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#2F6F4E' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ color: '#EEF2FF' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#CBD5E1' }, { weight: 0.6 }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#CBD5E1' }, { weight: 1.2 }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#0F172A' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#FFE2CF' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#F5B999' }, { weight: 1.3 }] },
  { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#B9DAFF' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
]

export const googleMapStyleDark: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0F1117' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#C7D2FE' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0F1117' }, { weight: 4 }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#3A4058' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#A5B4FC' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'on' }] },
  { featureType: 'landscape', elementType: 'geometry.fill', stylers: [{ color: '#0F1117' }] },
  { featureType: 'landscape.natural', elementType: 'geometry.fill', stylers: [{ color: '#0D1D16' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#0E241A' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#86EFAC' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ color: '#1A2233' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#3D4663' }, { weight: 0.8 }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2A3347' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#7C86A8' }, { weight: 1.6 }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#E2E8F0' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#313B54' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#B8C1DA' }, { weight: 1.5 }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#242C40' }] },
  { featureType: 'road.local', elementType: 'geometry.stroke', stylers: [{ color: '#4F5A74' }, { weight: 0.9 }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3A2E2E' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#B98A6F' }, { weight: 1.8 }] },
  { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A2A4D' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#C7D2FE' }] },
]

/**
 * Marqueur HTML (nos pastilles MA) posé sur la carte Google.
 * Classe créée à la demande : google.maps n'existe qu'après le chargement du script.
 */
export type HtmlMarker = google.maps.OverlayView & {
  position: google.maps.LatLng
  element: HTMLDivElement
  setHtml(html: string): void
}

export function createHtmlMarker(
  maps: typeof google.maps,
  position: google.maps.LatLngLiteral,
  html: string,
  onClick: () => void,
  zIndex = 1,
): HtmlMarker {
  class Marker extends maps.OverlayView {
    position: google.maps.LatLng
    element: HTMLDivElement
    constructor() {
      super()
      this.position = new maps.LatLng(position)
      this.element = document.createElement('div')
      this.element.className = 'ma-gpin'
      this.element.style.zIndex = String(zIndex)
      this.element.innerHTML = html
      this.element.addEventListener('click', (e) => {
        e.stopPropagation()
        onClick()
      })
    }
    setHtml(next: string) {
      this.element.innerHTML = next
    }
    onAdd() {
      this.getPanes()?.overlayMouseTarget.appendChild(this.element)
    }
    draw() {
      const point = this.getProjection()?.fromLatLngToDivPixel(this.position)
      if (point) {
        this.element.style.left = `${point.x}px`
        this.element.style.top = `${point.y}px`
      }
    }
    onRemove() {
      this.element.remove()
    }
  }
  return new Marker()
}

type LL = google.maps.LatLngLiteral

function km(a: LL, b: LL) {
  const r = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(h))
}

export function pathLengthKm(path: LL[]) {
  let total = 0
  for (let i = 1; i < path.length; i++) total += km(path[i - 1], path[i])
  return total
}

/** Garde un point tous les `spacingKm` environ (plus le premier et le dernier). */
function thin(points: LL[], spacingKm: number) {
  if (points.length <= 2) return points
  const out: LL[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    if (km(out[out.length - 1], points[i]) >= spacingKm) out.push(points[i])
  }
  out.push(points[points.length - 1])
  return out
}

/**
 * Itinéraire routier passant par des points (Directions API de Google, mode route).
 * - Trajet prévu : départ, arrêts, arrivée.
 * - Trajet emprunté : points GPS enregistrés, alignés sur les routes réelles.
 * Requêtes de 25 points au plus, enchaînées. Renvoie null si le service refuse (clé sans « Directions API »).
 */
export async function routeThrough(maps: typeof google.maps, points: LL[], opts: { stopover?: boolean } = {}): Promise<LL[] | null> {
  if (points.length < 2) return null
  let spacing = 0.12
  let kept = opts.stopover ? points : thin(points, spacing)
  while (!opts.stopover && kept.length > 24 * 8 + 1) {
    spacing *= 1.5
    kept = thin(points, spacing)
  }
  const service = new maps.DirectionsService()
  const out: LL[] = []
  for (let start = 0; start < kept.length - 1; start += 24) {
    const chunk = kept.slice(start, Math.min(kept.length, start + 25))
    if (chunk.length < 2) break
    const res = await new Promise<google.maps.DirectionsResult | null>((resolve) => {
      service.route(
        {
          origin: chunk[0],
          destination: chunk[chunk.length - 1],
          waypoints: chunk.slice(1, -1).map((p) => ({ location: p, stopover: Boolean(opts.stopover) })),
          travelMode: maps.TravelMode.DRIVING,
          optimizeWaypoints: false,
        },
        (r, status) => resolve(status === 'OK' && r ? r : null),
      )
    })
    if (!res?.routes?.[0]) return null
    for (const leg of res.routes[0].legs) {
      for (const step of leg.steps) {
        for (const p of step.path) out.push({ lat: p.lat(), lng: p.lng() })
      }
    }
  }
  return out.length >= 2 ? out : null
}
