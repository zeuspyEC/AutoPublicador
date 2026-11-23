import { describe, expect, it } from 'vitest'
import { BENEFICIOS_PREDETERMINADOS, UBICACION_PREDETERMINADA } from '../dominio/tipos'
import { placasDeTexto, procesarLote } from './lote'

const PERFIL = { nombre: 'Vendedor Prueba', telefono: '0987654321', estiloTelefono: 'puntos', horario: '' } as never
const AJUSTES = { beneficios: BENEFICIOS_PREDETERMINADOS, claveGemini: '', ubicacion: UBICACION_PREDETERMINADA, servidorPlacas: 'https://s.dev' }

describe('varias placas', () => {
  it('extrae placas válidas de cualquier separador, sin repetir, y avisa las inválidas', () => {
    expect(placasDeTexto('PVS067.\nmcy0327, HAK-0679 PUB0356\nMBA2633,\nPCH7548. PJH665 mcy0327 XX1')).toEqual({
      validas: ['PVS067', 'MCY0327', 'HAK0679', 'PUB0356', 'MBA2633', 'PCH7548', 'PJH665'], invalidas: ['XX1'],
    })
  })
  it('cada placa: datos del SRI + publicación con título y descripción; los errores no detienen el lote', async () => {
    const pedir = async (url: string) => {
      if (url.includes('/placa/PBA1234')) return new Response(JSON.stringify({ registrada: 'PBA1234', rubros: [], pagos: [],
        base: { codigoVehiculo: 1, descripcionMarca: 'KIA', descripcionModelo: 'CERATO LX AC 1.6 4P 4X2 TM', anioAuto: 2014, descripcionPais: 'ECUADOR', ultimoAnioPagado: 2026 } }))
      if (url.includes('/placa/')) return new Response('{"error":"x"}', { status: 404 })
      return new Response(JSON.stringify({ query: { search: [] } })) // Wikipedia sin resultados
    }
    const avance: string[] = []
    const r = await procesarLote(['PBA1234', 'PBB9999'], PERFIL, AJUSTES, (n, x) => avance.push(`${n}:${x.placa}:${x.ok}`), pedir)
    expect(avance).toEqual(['1:PBA1234:true', '2:PBB9999:false'])
    expect(r[0].vehiculo).toMatchObject({ marca: 'Kia', modelo: 'Cerato', anio: '2014', motor: '1.6', transmision: 'Manual', puertas: '4', matricula: 'Al día 2026' })
    expect(r[0].publicacion?.titulo).toMatch(/KIA CERATO/)
    expect(r[0].publicacion?.descripcion).toMatch(/Kia Cerato/)
    expect(r[0].publicacion?.placa).toBe('PBA1234')
    expect(r[1].error).toMatch(/no tiene registrada/)
  })
})
