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
