import { describe, expect, it } from 'vitest'
import { manejar, placaValida, sinDatosPersonales } from './index.js'

const BASE = { codigoVehiculo: 1, descripcionMarca: 'CHEVROLET', descripcionModelo: 'AVEO', anioAuto: 2015, nombreClase: 'AUTOMOVIL',
  nombrePropietario: 'PERSONA DE PRUEBA', cedulaPropietario: '1700000000', propietario: { direccion: 'X', telefono: '099' } }
const sri = (base = BASE, rubros = []) => async (url) => new Response(JSON.stringify(url.includes('BaseVehiculo') ? base : rubros))
const pedido = (ruta, origen = 'https://zeuspyec.github.io', metodo = 'GET') => new Request(`https://placas.ejemplo.workers.dev${ruta}`, { method: metodo, headers: origen ? { Origin: origen } : {} })

describe('servidor de placas', () => {
  it('devuelve la base y los rubros con permiso CORS para la app', async () => {
    const r = await manejar(pedido('/placa/pba-1234'), sri(BASE, [{ descripcionRubro: 'MATRICULA', valorRubro: 0 }]))
    expect(r.status).toBe(200)
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://zeuspyec.github.io')
    const j = await r.json()
    expect(j.placa).toBe('PBA1234')
    expect(j.base.descripcionModelo).toBe('AVEO')
    expect(j.base.nombreClase).toBe('AUTOMOVIL') // «nombreClase» no es un dato personal
    expect(j.rubros).toHaveLength(1)
  })
  it('nunca devuelve datos personales', async () => {
    const j = await (await manejar(pedido('/placa/PBA1234'), sri())).json()
    expect(JSON.stringify(j)).not.toMatch(/PERSONA|1700000000|direccion|telefono|propietario/i)
  })
  it('otros sitios no reciben permiso CORS', async () => {
    const r = await manejar(pedido('/placa/PBA1234', 'https://otro-sitio.com'), sri())
    expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
  it('preflight OPTIONS', async () => {
    const r = await manejar(pedido('/placa/PBA1234', 'https://zeuspyec.github.io', 'OPTIONS'), sri())
    expect(r.status).toBe(204)
    expect(r.headers.get('Access-Control-Allow-Methods')).toContain('GET')
  })
  it('placa no válida → 400; no registrada → 404; SRI caído → 502', async () => {
    expect((await manejar(pedido('/placa/XX1'), sri())).status).toBe(400)
    expect((await manejar(pedido('/placa/PBA1234'), sri({}))).status).toBe(404)
    expect((await manejar(pedido('/placa/PBA1234'), async () => { throw new Error('timeout') })).status).toBe(502)
  })
  it('salud y rutas', async () => {
    expect((await manejar(pedido('/salud'), sri())).status).toBe(200)
    expect((await manejar(pedido('/otra'), sri())).status).toBe(404)
  })
  it('validación y limpieza', () => {
    expect(placaValida('JQ094F')).toBe(true)
    expect(sinDatosPersonales({ a: 1, nombrePropietario: 'x', n: [{ cedula: '1' }] })).toEqual({ a: 1, n: [{}] })
  })
})

describe('servidor de placas: más datos del SRI', () => {
  it('placa antigua de 3 números: prueba con el 0 (PJM343 → PJM0343)', async () => {
    const urls = []
    const r = await manejar(pedido('/placa/PJM343'), async (url) => {
      urls.push(url)
      if (url.includes('BaseVehiculo')) return new Response(JSON.stringify(url.endsWith('PJM0343') ? BASE : {}))
      return new Response('[]')
    })
    const j = await r.json()
    expect(r.status).toBe(200)
    expect(j.registrada).toBe('PJM0343')
    expect(urls.some((u) => u.includes('consultaPagos') && u.endsWith('PJM0343'))).toBe(true)
  })
  it('incluye el historial de pagos y el plan excepcional, sin datos personales', async () => {
    const r = await manejar(pedido('/placa/PBA1234'), async (url) => new Response(JSON.stringify(
      url.includes('BaseVehiculo') ? BASE : url.includes('consultaPagos') ? { data: [{ fechaDePago: '2026-03-01', monto: 80, nombreContribuyente: 'X' }] } : [])))
    const j = await r.json()
    expect(j.pagos).toEqual([{ fechaDePago: '2026-03-01', monto: 80 }])
    expect(j.planExcepcional).toEqual([])
  })
  it('si una consulta opcional falla, igual responde con la base', async () => {
    const r = await manejar(pedido('/placa/PBA1234'), async (url) => {
      if (url.includes('BaseVehiculo')) return new Response(JSON.stringify(BASE))
      throw new Error('timeout')
    })
    expect(r.status).toBe(200)
    expect((await r.json()).rubros).toEqual([])
  })
})

describe('servidor de placas: desglose y detalle de pagos', () => {
  it('pide ConsultaComponente por cada rubro y obtenerDetallesPago de los pagos recientes', async () => {
    const urls = []
    const r = await manejar(pedido('/placa/PBA1234'), async (url) => {
      urls.push(url)
      if (url.includes('BaseVehiculo')) return new Response(JSON.stringify(BASE))
      if (url.includes('ConsultaRubros')) return new Response(JSON.stringify([{ codigoRubro: 77, valorRubro: 41.83 }]))
      if (url.includes('ConsultaComponente')) return new Response(JSON.stringify([{ codigoComponente: 'RECARGO', valorComponente: 12.98 }]))
      if (url.includes('obtenerPorPlacaCampvCpn')) return new Response(JSON.stringify([{ codigoRecaudacion: 5, fechaDePago: '2025-02-17', monto: 80 }]))
      if (url.includes('obtenerDetallesPago')) return new Response(JSON.stringify([{ descripcionRubro: 'TASAS ANT', anio: 2025, valor: 36, nombreContribuyente: 'X' }]))
      return new Response('[]')
    })
    const j = await r.json()
    expect(urls.some((u) => u.endsWith('codigoConsultaRubro=77'))).toBe(true)
    expect(urls.some((u) => u.endsWith('codigoRecaudacion=5'))).toBe(true)
    expect(j.componentes).toEqual([{ codigoRubro: 77, componentes: [{ codigoComponente: 'RECARGO', valorComponente: 12.98 }] }])
    expect(j.detallesPago).toEqual([{ fechaDePago: '2025-02-17', detalle: [{ descripcionRubro: 'TASAS ANT', anio: 2025, valor: 36 }] }])
    expect(j.pagos[0]).toEqual({ fechaDePago: '2025-02-17', tipoDeuda: undefined, monto: 80 }) // sin código de recaudación
  })
})
