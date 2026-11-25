import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VEHICULO_VACIO } from './tipos'
import { mismaPlaca, placasConocidas, sugerir } from './sugerencias'
import { almacen, type PlacaConsultada, type Publicacion } from '../servicios/almacen'

const INV = { resumen: '', hallazgos: [], avisos: [], fuentes: [] }
const pl = (placa: string, resumen: string, fecha = '2026-11-01'): PlacaConsultada => ({ placa, resumen, fecha, resultado: INV, ...(resumen ? {} : { sinRespuesta: 'no existe' }) })
const pub = (placa: string, modelo: string): Publicacion => ({ id: placa, placa, fecha: '2026-11-02', texto: '', vehiculo: { ...VEHICULO_VACIO, marca: 'Kia', modelo }, origenes: {}, titulo: '', descripcion: '' })
const K = placasConocidas([pl('PVS067', 'Nissan Sentra 1999'), pl('PCH7548', 'Jeep Patriot 2013'), pl('PCH7999', ''), pl('PCB1234', 'Kia Rio 2015'), pl('HAK0679', 'Vitara 1996')], [pub('ABC1111', 'Rio'), pub('PCH7548', 'Otro')])
const de = (q: string) => sugerir(q, K).map((s) => s.placa)

describe('sugerencias de placa', () => {
  it('se delimita con cada carácter', () => {
    expect(de('')).toEqual([])
    expect(de('p')).toHaveLength(4)
    expect(de('PC')).toEqual(['PCH7548', 'PCB1234', 'PCH7999'])
    expect(de('pch-7')).toEqual(['PCH7548', 'PCH7999'])
    expect(de('PCH75')).toEqual(['PCH7548'])
    expect(de('ZZZ9')).toEqual([])
  })
  it('vehículo a la derecha; vacía la que no tuvo respuesta', () => {
    const [a, b] = sugerir('PCH7', K)
    expect(a).toMatchObject({ vehiculo: 'Jeep Patriot 2013', desde: 0, largo: 4 })
    expect(b.vehiculo).toBe('')
    expect(b.consultada).toBeUndefined()
  })
  it('por fragmento, con cero o sin cero, y con un error de digitación', () => {
    expect(de('679')).toEqual(['HAK0679'])
    expect(de('PVS0067')).toEqual(['PVS067'])
    expect(de('HAK6')).toEqual(['HAK0679'])
    expect(mismaPlaca('PVS067', 'PVS-0067')).toBe(true)
    expect(sugerir('PCH7584', K)).toMatchObject([{ placa: 'PCH7548', tipo: 'parecida' }])
    expect(de('PHC7548')).toEqual(['PCH7548'])
  })
  it('incluye publicaciones guardadas, sin repetir placas', () => {
    expect(sugerir('ABC', K)).toMatchObject([{ vehiculo: 'Kia Rio' }])
    expect(K.filter((c) => c.placa === 'PCH7548')).toHaveLength(1)
  })
})

describe('placas sin respuesta en el historial', () => {
  beforeEach(() => { const m = new Map<string, string>(); vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, x: string) => m.set(k, x) }) })
  it('se guardan vacías, no pisan datos y una respuesta posterior las completa', () => {
    almacen.guardarPlacaSinRespuesta('PBA1234', 'no existe')
    expect(almacen.placas()).toMatchObject([{ placa: 'PBA1234', resumen: '', sinRespuesta: 'no existe' }])
    almacen.guardarPlaca(pl('PBA1234', 'Kia Rio'))
    almacen.guardarPlacaSinRespuesta('PBA1234', 'sin conexión')
    expect(almacen.placas()).toEqual([pl('PBA1234', 'Kia Rio')])
  })
})
