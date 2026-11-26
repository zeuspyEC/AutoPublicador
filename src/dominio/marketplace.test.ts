import { describe, expect, it } from 'vitest'
import { analizar } from './analizador'
import { etiquetasMarketplace, LIMITE_ETIQUETAS_FB } from './marketplace'
import { VEHICULO_VACIO, type Vehiculo } from './tipos'

const de = (t: string, extra: Partial<Vehiculo> = {}) => etiquetasMarketplace({ ...analizar(t).vehiculo, ...extra })

describe('etiquetas para Marketplace', () => {
  it('Corsa económico: marca, modelo, año, tipo y ciudad primero', () => {
    const e = de('Chevrolet Corsa 1.4 2002 manual rojo 3990 negociable a toda prueba')
    expect(e.slice(0, 4)).toEqual(['chevrolet corsa', 'corsa 2002', 'chevrolet', 'corsa'])
    expect(e).toContain('carro económico')
    expect(e).toContain('carros usados quito')
    expect(e).toContain('carro barato')
    expect(e).toContain('carro manual')
    expect(e).toContain('a toda prueba')
  })
  it('una casilla desmarcada no genera su etiqueta', () => {
    const e = de('Chevrolet Corsa 1.4 2002 3990', { negociable: false, recibeCambio: false, aTodaPrueba: false })
    expect(e).not.toContain('precio negociable')
    expect(e.join()).not.toMatch(/parte de pago|toda prueba/)
  })
  it('género y tipo correctos aunque falte la carrocería', () => {
    const k = de('Kia Sportage 2.0 2014 automática 15500')
    expect(k).toContain('suv automático'); expect(k).toContain('suv familiar')
    expect(de('Toyota Hilux 2.7 2015 4x4 automática 18500')).toEqual(expect.arrayContaining(['camioneta 4x4', 'camioneta automática', 'camionetas usadas quito']))
    expect(de('Yamaha FZ 150cc 2020 1400')).toContain('motos usadas quito')
    expect(de('Chevrolet Aveo 1.6 2012 automático 7000').join()).not.toMatch(/autom[aá]tica/)
  })
  it('camioneta 4x4 y moto', () => {
    expect(de('Toyota Hilux 2.7 2015 4x4 camioneta 18500')).toContain('camioneta 4x4')
    expect(de('Yamaha FZ 150cc 2020 1400')).toContain('moto económica')
  })
  it('sin repetidos, sin vacíos, sin financiamiento y como máximo 20', () => {
    for (const t of ['Chevrolet Corsa 1.4 2002 3990', 'Kia Sportage 2.0 2014 automática suv full equipo 15500 cero multas aire acondicionado', '']) {
      const e = de(t, { etiquetas: ['Único dueño', 'Con crédito'] })
      expect(e.length).toBeLessThanOrEqual(LIMITE_ETIQUETAS_FB)
      expect(new Set(e).size).toBe(e.length)
      expect(e.every((x) => x.trim() === x && x.length > 0 && x.length <= 40)).toBe(true)
      expect(e.join()).not.toMatch(/financi|cr[eé]dito|cuotas/)
    }
    expect(etiquetasMarketplace(VEHICULO_VACIO).every((x) => !/undefined|null/.test(x))).toBe(true)
  })
  it('ciudad según la ubicación', () => {
    expect(etiquetasMarketplace({ ...VEHICULO_VACIO, marca: 'Kia', modelo: 'Rio' }, 'Centro de Cuenca')).toContain('carros usados cuenca')
  })
})
