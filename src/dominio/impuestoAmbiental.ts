// Cilindraje a partir del Impuesto Ambiental a la Contaminación Vehicular (IACV) que el SRI cobró de 2012 a 2019.
// Ley de Fomento Ambiental (2011): IACV = (cilindraje − 1500) × tarifa × (1 + factor de ajuste por antigüedad).
// Con el valor pagado cada año (dato oficial del SRI) se despeja el cilindraje registrado del vehículo.
// Hasta 1500 cc el impuesto era 0 (exento), así que en esos vehículos no hay de dónde despejarlo.

export interface LineaIacv { anio?: number; componente?: string; valor?: number }

/** Tramos de cilindraje y tarifa por centímetro cúbico. */
const TRAMOS: [number, number, number][] = [
  [1501, 2000, 0.08], [2001, 2500, 0.09], [2501, 3000, 0.11], [3001, 3500, 0.12], [3501, 4000, 0.24], [4001, 20000, 0.35],
]

/** Factor de ajuste por antigüedad (años desde el año del modelo). */
export function factorAntiguedad(edad: number): number {
  if (edad < 5) return 0
  if (edad <= 10) return 0.05
  if (edad <= 15) return 0.1
  if (edad <= 20) return 0.15
  return 0.2
}

/** Cilindraje que corresponde a un valor de IACV de un año; null si no encaja en ningún tramo. */
export function cilindrajeDeValor(valor: number, anioFiscal: number, anioModelo: number): number | null {
  const edad = anioFiscal - anioModelo
  if (!(valor > 0) || edad < 0) return null // antes del año del modelo el cobro es proporcional: no sirve
  const base = valor / (1 + factorAntiguedad(edad))
  for (const [desde, hasta, tarifa] of TRAMOS) {
    const cc = 1500 + base / tarifa
    if (cc >= desde - 0.5 && cc <= hasta + 0.5) return Math.round(cc)
  }
  return null
}

/**
 * Cilindraje más repetido entre los años pagados (cada año es un cálculo independiente que debe coincidir).
 * Devuelve también cuántos años lo confirman.
 */
export function cilindrajeDesdeIacv(lineas: LineaIacv[], anioModelo: number): { cc: number; anios: number } | null {
  if (!anioModelo) return null
  const votos = new Map<number, Set<number>>()
  for (const l of lineas) {
    if (!/^impuesto$/i.test((l.componente ?? '').trim()) || !l.anio || l.valor === undefined) continue
    const cc = cilindrajeDeValor(+l.valor, +l.anio, anioModelo)
    if (cc) votos.set(cc, (votos.get(cc) ?? new Set()).add(+l.anio))
  }
  const mejor = [...votos.entries()].sort((a, b) => b[1].size - a[1].size)[0]
  return mejor ? { cc: mejor[0], anios: mejor[1].size } : null
}

/** 2400 cc → «2.4»; 1998 cc → «2.0» (como se escribe el motor en Ecuador). */
export const litros = (cc: number) => (Math.round(cc / 100) / 10).toFixed(1)
