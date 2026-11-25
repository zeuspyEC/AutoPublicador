// Sugerencias de placas mientras se digita: salen solo del historial de este dispositivo (placas consultadas y
// publicaciones guardadas). Se van delimitando con cada carácter; nada se consulta en internet.
import type { PlacaConsultada, Publicacion } from '../servicios/almacen'

export interface Sugerencia {
  placa: string
  vehiculo: string // vacío = la placa no tuvo respuesta
  fecha: string
  usos: number
  tipo: 'empieza' | 'contiene' | 'parecida'
  desde: number // tramo que coincide, para resaltarlo (-1 = ninguno)
  largo: number
  consultada?: PlacaConsultada // con datos del SRI guardados
  publicacion?: Publicacion
}

export type PlacaConocida = Omit<Sugerencia, 'tipo' | 'desde' | 'largo'>

const limpia = (s: string) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/** Une las placas consultadas y las de publicaciones, sin repetir. */
export function placasConocidas(placas: PlacaConsultada[], historial: Publicacion[]): PlacaConocida[] {
  const m = new Map<string, PlacaConocida>()
  for (const p of placas) {
    m.set(limpia(p.placa), { placa: limpia(p.placa), vehiculo: p.resumen, fecha: p.fecha, consultada: p.sinRespuesta ? undefined : p, usos: 1 })
  }
  for (const p of historial) {
    const placa = limpia(p.placa ?? '')
    if (!placa) continue
    const nombre = [p.vehiculo.marca, p.vehiculo.modelo, p.vehiculo.anio].filter(Boolean).join(' ')
    const x = m.get(placa)
    if (!x) m.set(placa, { placa, vehiculo: nombre, fecha: p.fecha, publicacion: p, usos: 1 })
    else {
      x.usos++
      x.vehiculo ||= nombre
      if (!x.publicacion || p.fecha > x.publicacion.fecha) x.publicacion = p
      if (p.fecha > x.fecha) x.fecha = p.fecha
    }
  }
  return [...m.values()]
}

/** PVS067 y PVS0067 son la misma placa: se comparan las dos formas. */
function formas(p: string): string[] {
  const tres = /^([A-Z]{3})(\d{3})$/.exec(p), cuatro = /^([A-Z]{3})0(\d{3})$/.exec(p)
  return tres ? [p, `${tres[1]}0${tres[2]}`] : cuatro ? [p, cuatro[1] + cuatro[2]] : [p]
}
export const mismaPlaca = (a: string, b: string) => formas(limpia(a)).includes(limpia(b))

/** ¿«a» y «b» difieren en un solo error de digitación? (cambiar, faltar, sobrar o intercambiar vecinos) */
function unError(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1)
}

/** Con 4 o más caracteres y sin coincidencias exactas, se toleran errores (también en el tramo digitado hasta ahora). */
const parecida = (p: string, q: string) => [q.length - 1, q.length, q.length + 1].some((n) => unError(p.slice(0, n), q))

export function sugerir(entrada: string, conocidas: PlacaConocida[], max = 6): Sugerencia[] {
  const q = limpia(entrada)
  if (!q) return []
  const r: (Sugerencia & { orden: number })[] = []
  for (const c of conocidas) {
    const enPropia = c.placa.indexOf(q)
    if (enPropia === 0 || formas(c.placa).some((f) => f.startsWith(q))) r.push({ ...c, tipo: 'empieza', orden: 0, desde: enPropia === 0 ? 0 : -1, largo: q.length })
    // Un fragmento de un solo carácter en medio coincide con casi todo: se exige al menos dos
    else if (q.length >= 2 && enPropia > 0) r.push({ ...c, tipo: 'contiene', orden: 1, desde: enPropia, largo: q.length })
  }
  if (!r.length && q.length >= 4) {
    for (const c of conocidas) if (formas(c.placa).some((f) => parecida(f, q))) r.push({ ...c, tipo: 'parecida', orden: 2, desde: -1, largo: 0 })
  }
  // Primero la forma de coincidir; luego las que tienen vehículo; luego las más recientes
  return r.sort((a, b) => a.orden - b.orden || +!a.vehiculo - +!b.vehiculo || b.fecha.localeCompare(a.fecha) || b.usos - a.usos).slice(0, max)
}
