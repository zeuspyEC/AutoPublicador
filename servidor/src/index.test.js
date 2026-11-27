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

describe('servidor de placas: resumen de todo el historial de pagos', () => {
  it('cuenta traspasos por fecha (aunque haya varios pagos el mismo día) y el rango de pagos', async () => {
    const { resumirPagos } = await import('./index.js')
    expect(resumirPagos([
      { fechaDePago: '2010-09-01 03:37', tipoDeuda: 'PAGO DEL VALOR DE LA MATRÍCULA' },
      { fechaDePago: '2016-12-08 03:21', tipoDeuda: 'PAGO DEL VALOR DE TRANSFERENCIA DE DOMINIO' },
      { fechaDePago: '2016-12-08 05:00', tipoDeuda: 'PAGO DEL VALOR DE TRANSFERENCIA DE DOMINIO' },
      { fechaDePago: '2024-10-23 09:25', tipoDeuda: 'PAGO DEL VALOR DE TRANSFERENCIA DE DOMINIO' },
    ])).toEqual({ totalPagos: 4, traspasos: 2, ultimoTraspaso: '2024-10-23', primerPago: '2010-09-01', ultimoPago: '2024-10-23' })
  })
})

// HTML sintético con la misma estructura que la página de ATM Guayaquil
const atmHtml = (placa, filas = '') => `<h3><i></i> INFORMACION DEL VEHICULO ${placa}</h3><ul><li>MARCA : CHEVROLET
  </li><li>MODELO : GRAND VITARA 2.</li><li>A&Ntilde;O : 2012</li></ul>
  ${filas ? `<table><thead><tr><th>Observación</th></tr></thead><tbody>${filas}</tbody></table>` : `Veh&iacute;culo ${placa} no tiene revisiones.`}`
const filaAtm = (obs, fecha, estado, n) => `<tr><td>${obs}</td><td>${fecha}</td><td>${estado}</td><td>${n}</td><td><a onClick="printReporte('1','APR');">ver</a></td></tr>`

describe('servidor de placas: ATM Guayaquil', () => {
  it('lee marca, modelo, año y las filas de revisiones (fecha a formato año-mes-día)', async () => {
    const { leerAtm } = await import('./index.js')
    expect(leerAtm(atmHtml('GSD5678', filaAtm('RENOVACIÓN DE MATRÍCULA', '21-08-2025', 'APROBADO', 1))))
      .toEqual({ marca: 'CHEVROLET', modelo: 'GRAND VITARA 2.', anio: '2012', revisiones: [{ observacion: 'RENOVACIÓN DE MATRÍCULA', fecha: '2025-08-21', estado: 'APROBADO', revision: 1 }] })
    expect(leerAtm(atmHtml('GSB1234')).revisiones).toEqual([])
    expect(leerAtm('<html>Error</html>')).toBeNull()
  })
  it('junta las revisiones de todos los años sin repetir y prueba la placa antigua con 0', async () => {
    const { consultarAtm } = await import('./index.js')
    const cuerpos = []
    const r = await consultarAtm('PJM343', async (_url, init) => {
      cuerpos.push(init.body)
      if (!init.body.includes('PJM0343')) return new Response('<html></html>')
      const anio = init.body.match(/ps_anio=(\d+)/)[1]
      const filas = anio === '2025' ? filaAtm('MATRÍCULA', '21-08-2025', 'APROBADO', 1) + filaAtm('MATRÍCULA', '10-08-2025', 'CONDICIONADO', 2)
        : anio === '2024' ? filaAtm('MATRÍCULA', '21-08-2025', 'APROBADO', 1) : ''
      return new Response(atmHtml('PJM0343', filas))
    }, new Date('2026-06-01'))
    expect(cuerpos[0]).toBe('ps_placa=PJM0343&ps_anio=2026')
    expect(r.registrada).toBe('PJM0343')
    expect(r.revisiones.map((x) => x.fecha)).toEqual(['2025-08-21', '2025-08-10'])
    expect(r.hasta).toBe(2026)
  })
  it('/consulta une SRI y ATM, y si el SRI no tiene la placa igual entrega ATM', async () => {
    const r = await manejar(pedido('/consulta/GSD5678'), async (url, init) => {
      if (url.includes('atm.gob.ec')) return new Response(atmHtml('GSD5678'))
      return new Response('null')
    })
    const j = await r.json()
    expect(r.status).toBe(200)
    expect(j.sri).toEqual({ encontrada: false, error: 'El SRI no tiene registrada la placa GSD5678.' })
    expect(j.atm).toMatchObject({ encontrada: true, marca: 'CHEVROLET', anio: '2012' })
  })
})

// Forma real de la API pública de la AMT (valores inventados)
const amtVehiculo = { numVehiculo: '555', placa: 'PJM0343', chasis: 'JN**********43', motor: 'QR**********6L', placaAnt: '', anio: '1992', marca: 'SUZUKI', modelo: 'FORSA', tipo: 'LIVIANO', subTipo: 'AUTOMOVIL 4 TIEMPOS' }
const amtRevisiones = [
  { numRevision: '2', centroRevision: 'CENTRO A', fechaPresentacion: '2025-06-10', fechaVencimiento: '2025-12-31', estadoRevision: 'APROBADO', codRevision: '22' },
  { numRevision: '1', centroRevision: 'CENTRO A', fechaPresentacion: '2025-06-01', fechaVencimiento: '2025-12-31', estadoRevision: 'CONDICIONAL', codRevision: '21' },
  { numRevision: '1', centroRevision: '', fechaPresentacion: 'Ninguna', fechaVencimiento: '2024-12-31', estadoRevision: 'NO SE PRESENTÓ', codRevision: '20' },
]
const medicion = (causa, maquina, valor = '30.00', unidad = '%', descripcion = '') => ({ codigoCausa: causa, descCausa: causa === 'OK' ? 'OK' : 'Grave', descripcionMaquina: maquina, valorMedido: valor, unidadMedida: unidad, descripcion })
const amtDetalle = (km, defectos = []) => ({ revision: { kilometraje: km, numCertificado: '135', numAdhesivo: '0069', fechaEmision: '2025-06-10' },
  defectosMecatronicos: [medicion('OK', 'FRENO'), ...defectos], defectosVisuales: [medicion('GRV', 'PARABRISAS', '0.00', '***', 'franjas')], defectosMedibles: [] })

describe('servidor de placas: AMT Quito', () => {
  const pedirAmt = (urls) => async (url, init) => {
    urls.push([url, init?.body])
    const b = JSON.parse(init.body)
    if (url.endsWith('vehiculo/getData')) return b.dato === 'PJM0343'
      ? new Response(JSON.stringify({ codRetorno: '0001', retorno: { vehiculo: amtVehiculo, revisiones: amtRevisiones } }))
      : new Response('<html>404</html>', { status: 404 })
    if (url.endsWith('revision/getCabecera')) return new Response(JSON.stringify({ codRetorno: '0001', retorno: amtDetalle(b.codRevision === '22' ? '00175729' : '00175700', [medicion('MDO', 'SUSPENSIÓN')]) }))
    return new Response('', { status: 404 })
  }
  it('prueba la placa antigua con 0, pide el detalle solo de las revisiones presentadas y lee kilometraje y defectos', async () => {
    const { consultarAmt } = await import('./index.js')
    const urls = []
    const r = await consultarAmt('PJM343', pedirAmt(urls))
    expect(r.registrada).toBe('PJM0343')
    expect(r.vehiculo).toMatchObject({ marca: 'SUZUKI', tipo: 'LIVIANO', subtipo: 'AUTOMOVIL 4 TIEMPOS', chasis: 'JN**********43', placaAnterior: null })
    expect(urls.filter(([u]) => u.endsWith('getCabecera')).map(([, b]) => JSON.parse(b).codRevision)).toEqual(['22', '21'])
    expect(r.revisiones.map((x) => [x.fecha, x.estado, x.kilometraje])).toEqual([['2025-06-10', 'APROBADO', 175729], ['2025-06-01', 'CONDICIONAL', 175700], [null, 'NO SE PRESENTÓ', null]])
    expect(r.revisiones[0].defectos.map((d) => [d.tipo, d.elemento, d.nota])).toEqual([['Mecatrónico', 'SUSPENSIÓN', null], ['Visual', 'PARABRISAS', 'franjas']])
    expect(r.revisiones[0].mediciones).toHaveLength(3) // solo la última trae todas las mediciones
    expect(r.revisiones[1].mediciones).toBeUndefined()
    expect(r.revisiones[0].defectos[1].valor).toBeNull() // «***» no es una unidad
  })
  it('/amt responde aunque la AMT no tenga la placa', async () => {
    const r = await manejar(pedido('/amt/GSD5678'), pedirAmt([]))
    expect(await r.json()).toMatchObject({ placa: 'GSD5678', amt: { encontrada: false } })
  })
})
