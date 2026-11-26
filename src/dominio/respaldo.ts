// Copia de seguridad: todo lo guardado en un solo texto (JSON) para llevarlo a otro teléfono, navegador o a la app instalada.
import type { PlacaConsultada, Publicacion } from '../servicios/almacen'
import type { Ajustes, Perfil } from './tipos'

export interface Respaldo {
  app: 'AutoPublicador'
  version: number
  fecha: string
  perfil: Perfil | null
  ajustes: Ajustes | null
  historial: Publicacion[]
  placas: PlacaConsultada[]
}

type Datos = Pick<Respaldo, 'perfil' | 'ajustes' | 'historial' | 'placas'>

/** Lee un respaldo pegado o abierto desde un archivo; null si no es un respaldo de AutoPublicador. */
export function leerRespaldo(texto: string): Respaldo | null {
  try {
    const r = JSON.parse(texto.trim())
    if (!r || r.app !== 'AutoPublicador' || !Array.isArray(r.historial) || !Array.isArray(r.placas)) return null
    const historial = (r.historial as Publicacion[]).filter((p) => p && typeof p.id === 'string' && p.vehiculo && typeof p.titulo === 'string')
    const placas = (r.placas as PlacaConsultada[]).filter((p) => p && typeof p.placa === 'string' && p.resultado)
    const perfil = r.perfil && typeof r.perfil.nombre === 'string' && typeof r.perfil.telefono === 'string' ? r.perfil : null
    return { app: 'AutoPublicador', version: +r.version || 1, fecha: String(r.fecha ?? ''), perfil, ajustes: r.ajustes && typeof r.ajustes === 'object' ? r.ajustes : null, historial, placas }
  } catch { return null }
}

/**
 * Une un respaldo con lo que ya hay sin perder nada: se agregan las publicaciones y placas que falten; si una existe en
 * los dos lados, se queda la más reciente. El perfil y los ajustes del respaldo solo se usan si aquí no hay.
 */
export function unirRespaldo(r: Datos, actual: Datos): Datos & { nuevas: number; nuevasPlacas: number } {
  const porId = new Map(actual.historial.map((p) => [p.id, p]))
  let nuevas = 0
  for (const p of r.historial) {
    const a = porId.get(p.id)
    if (!a) nuevas++
    if (!a || p.fecha > a.fecha) porId.set(p.id, p)
  }
  const porPlaca = new Map(actual.placas.map((p) => [p.placa, p]))
  let nuevasPlacas = 0
  for (const p of r.placas) {
    const a = porPlaca.get(p.placa)
    if (!a) nuevasPlacas++
    if (!a || (a.sinRespuesta && !p.sinRespuesta) || (!p.sinRespuesta && p.fecha > a.fecha)) porPlaca.set(p.placa, p)
  }
  const recientes = <T extends { fecha: string }>(xs: T[]) => xs.sort((x, y) => (x.fecha < y.fecha ? 1 : x.fecha > y.fecha ? -1 : 0))
  return {
    perfil: actual.perfil ?? r.perfil,
    ajustes: actual.ajustes ?? r.ajustes,
    historial: recientes([...porId.values()]).slice(0, 200),
    placas: recientes([...porPlaca.values()]).slice(0, 300),
    nuevas, nuevasPlacas,
  }
}
