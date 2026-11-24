import { describe, expect, it } from 'vitest'
import { cilindrajeDeValor, cilindrajeDesdeIacv, factorAntiguedad, litros } from './impuestoAmbiental'

// Valores reales del impuesto ambiental pagado al SRI (consultaPagos/obtenerDetallesPago), verificados con placas reales
const imp = (anio: number, valor: number) => ({ anio, componente: 'Impuesto', valor })

describe('cilindraje desde el impuesto ambiental (IACV)', () => {
  it('factor de ajuste por antigüedad', () => {
    expect([0, 4, 5, 10, 11, 15, 16, 20, 21].map(factorAntiguedad)).toEqual([0, 0, 0.05, 0.05, 0.1, 0.1, 0.15, 0.15, 0.2])
  })
  it('Jeep Patriot 2010: $81 (2014) y $85.05 (2015-2019) → 2400 cc (2.4)', () => {
    const r = cilindrajeDesdeIacv([imp(2013, 81), imp(2014, 81), imp(2015, 85.05), imp(2019, 85.05), { anio: 2013, componente: 'Interes', valor: 3.31 }], 2010)
    expect(r).toEqual({ cc: 2400, anios: 4 })
    expect(litros(r!.cc)).toBe('2.4')
  })
  it('Chevrolet Vitara 1993: $9.20 (factor 15 %) y $9.60 (factor 20 %) → 1600 cc', () => {
    expect(cilindrajeDesdeIacv([imp(2012, 9.2), imp(2013, 9.2), imp(2014, 9.6), imp(2016, 9.6)], 1993)).toEqual({ cc: 1600, anios: 4 })
  })
  it('Nissan X-Trail 2016: $90 → 2500 cc; el cobro proporcional del año anterior al modelo se ignora', () => {
    expect(cilindrajeDesdeIacv([imp(2015, 7.5), imp(2016, 90), imp(2019, 90)], 2016)).toEqual({ cc: 2500, anios: 2 })
  })
  it('Corsa Evolution 2004: $25.20 (factor 5 %) → 1800 cc; Nissan 1999: $44 (factor 10 %) → 2000 cc', () => {
    expect(cilindrajeDeValor(25.2, 2013, 2004)).toBe(1800)
    expect(cilindrajeDeValor(44, 2012, 1999)).toBe(2000)
  })
  it('sin impuesto (hasta 1500 cc o exento) no se inventa nada', () => {
    expect(cilindrajeDesdeIacv([], 2010)).toBeNull()
    expect(cilindrajeDeValor(0, 2015, 2010)).toBeNull()
  })
})
