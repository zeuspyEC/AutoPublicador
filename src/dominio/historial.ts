// Ayudas del historial: buscar, contar por estado de venta y saber hace cuánto se guardó cada publicación.
import type { EstadoVenta, Publicacion } from '../servicios/almacen'

export const ESTADOS: { id: EstadoVenta; nombre: string; icono: string }[] = [
  { id: 'disponible', nombre: 'Disponible', icono: '🚗' },
  { id: 'reservado', nombre: 'Reservado', icono: '⏳' },
  { id: 'vendido', nombre: 'Vendido', icono: '✅' },
]

export const estadoDe = (p: Publicacion): EstadoVenta => p.estado ?? 'disponible'

const sinTildes = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Busca por placa, marca, modelo, versión, año, color o título; cada palabra escrita debe aparecer. */
export function buscarEnHistorial(lista: Publicacion[], consulta: string, estado: EstadoVenta | 'todos' = 'todos'): Publicacion[] {
  const palabras = sinTildes(consulta).split(/\s+/).filter(Boolean).map((w) => w.replace(/[^a-z0-9]/g, '')).filter(Boolean)
  return lista.filter((p) => {
    if (estado !== 'todos' && estadoDe(p) !== estado) return false
    if (!palabras.length) return true
    const v = p.vehiculo
    const pajar = sinTildes([p.placa, v.marca, v.modelo, v.version, v.anio, v.color, v.motor, p.titulo].filter(Boolean).join(' ')).replace(/[^a-z0-9 ]/g, '')
    return palabras.every((w) => pajar.includes(w))
  })
}

export function contarEstados(lista: Publicacion[]): Record<EstadoVenta, number> {
  const c: Record<EstadoVenta, number> = { disponible: 0, reservado: 0, vendido: 0 }
  for (const p of lista) c[estadoDe(p)]++
  return c
}

/** «hoy», «ayer», «hace 3 días», «hace 2 semanas», «hace 4 meses». */
export function haceCuanto(iso: string, ahora = new Date()): string {
  const d = new Date(iso)
  if (isNaN(+d)) return ''
  const dia = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())
  const dias = Math.round((dia(ahora) - dia(d)) / 86400000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 14) return `hace ${dias} días`
  if (dias < 60) return `hace ${Math.floor(dias / 7)} semanas`
  const meses = Math.floor(dias / 30)
  return meses < 12 ? `hace ${meses} meses` : `hace ${Math.floor(dias / 365)} ${Math.floor(dias / 365) === 1 ? 'año' : 'años'}`
}

/** Días desde que se guardó: sirve para recordar que conviene volver a subir la publicación. */
export const diasDesde = (iso: string, ahora = new Date()) => Math.max(0, Math.floor((+ahora - +new Date(iso)) / 86400000))
