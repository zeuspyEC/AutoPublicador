// Fusión de datos investigados con lo que ya hay en el formulario.
// - Fuentes de referencia (Wikipedia, Google, texto pegado): solo completan campos VACÍOS y solo si hay una única opción.
// - Fuente oficial (SRI por placa): sus datos de identidad del vehículo MANDAN sobre lo escrito en el texto, porque
//   describen el vehículo real de esa placa. Las diferencias se informan para que el vendedor decida.
import type { Investigacion } from '../servicios/investigador'
import type { Origen, Origenes, Vehiculo } from './tipos'

/** Datos de identidad que el SRI conoce con certeza para una placa. */
export const CAMPOS_OFICIALES: (keyof Vehiculo)[] = ['marca', 'modelo', 'anio', 'motor', 'color', 'procedencia', 'matricula', 'carroceria']

export interface Diferencia {
  campo: keyof Vehiculo
  anterior: string // lo que decía el texto
  oficial: string // lo que registra el SRI
}

const comparable = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Valor que se pone en el campo a partir de una opción («Hatchback 3 y 5 puertas» → «Hatchback»). */
export function valorParaCampo(campo: keyof Vehiculo, opcion: string): string {
  if (campo === 'carroceria') return opcion.replace(/\s+(?:de\s+)?(?:\d|dos|tres|cuatro|cinco|seis|siete)\b.*$/i, '').replace(/:$/, '').trim()
  return opcion.trim()
}

export function fusionar(v: Vehiculo, origenes: Origenes, r: Investigacion, origen: Origen): { vehiculo: Vehiculo; origenes: Origenes; diferencias: Diferencia[] } {
  const nv: Vehiculo = { ...v }
  const no: Origenes = { ...origenes }
  const diferencias: Diferencia[] = []
  const oficial = origen === 'sri'
  for (const h of r.hallazgos) {
    if (!h.campo || h.campo === 'equipamiento' || !h.opciones || h.opciones.length !== 1) continue
    const valor = valorParaCampo(h.campo, h.opciones[0])
    if (!valor) continue
    const actual = String(nv[h.campo] ?? '')
    if (!actual) {
      ;(nv as unknown as Record<string, unknown>)[h.campo] = valor
      no[h.campo] = origen
    } else if (oficial && CAMPOS_OFICIALES.includes(h.campo) && comparable(actual) !== comparable(valor) && no[h.campo] !== 'manual') {
      // El SRI manda sobre el texto (pero no sobre lo que el vendedor corrigió a mano)
      diferencias.push({ campo: h.campo, anterior: actual, oficial: valor })
      ;(nv as unknown as Record<string, unknown>)[h.campo] = valor
      no[h.campo] = origen
    }
  }
  return { vehiculo: nv, origenes: no, diferencias }
}
