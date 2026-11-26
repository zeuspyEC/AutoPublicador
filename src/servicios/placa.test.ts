import { describe, expect, it } from 'vitest'
import { consultarSri, interpretarPegado, interpretarSri, normalizarPlaca, placaValida, resumenDePlaca, type BaseSri, modeloDeDescripcion } from './placa'
import { analizar } from '../dominio/analizador'
import { descripciones, titulos } from '../dominio/plantillas'
import { BENEFICIOS_PREDETERMINADOS } from '../dominio/tipos'

// Registro ficticio con los nombres de campo reales del servicio BaseVehiculo del SRI
const BASE: BaseSri = {
  codigoVehiculo: 123456, descripcionMarca: 'CHEVROLET', descripcionModelo: 'AVEO FAMILY AC 1.5 4P 4X2 TM',
  anioAuto: 2015, descripcionPais: 'ECUADOR', colorVehiculo1: 'PLATEADO', colorVehiculo2: 'PLATEADO', cilindraje: 1498,
  nombreClase: 'AUTOMOVIL', descripcionServicio: 'PARTICULAR', ultimoAnioPagado: 2025, fechaCaducidadMatricula: '2026-05-31T00:00:00',
  prohibidoEnajenar: 'N',
}
const campo = (r: ReturnType<typeof interpretarSri>, c: string) => r.hallazgos.filter((h) => h.campo === c)

describe('placa: validación', () => {
  it('normaliza y valida placas de autos y motos', () => {
    expect(normalizarPlaca(' pba-1234 ')).toBe('PBA1234')
    expect(placaValida('PBA1234')).toBe(true)
    expect(placaValida('PBA123')).toBe(true)
    expect(placaValida('IB123C')).toBe(true)
    expect(placaValida('P1234')).toBe(false)
  })
})

describe('placa: interpretación de la respuesta del SRI', () => {
  it('extrae marca, modelo, versión, motor, puertas, tracción, transmisión y A/C del modelo registrado', () => {
    const r = interpretarSri('PBA1234', BASE, [])
    expect(campo(r, 'marca')[0].opciones).toEqual(['Chevrolet'])
    expect(campo(r, 'modelo')[0].opciones).toEqual(['Aveo Family'])
    expect(campo(r, 'anio')[0].opciones).toEqual(['2015'])
    expect(campo(r, 'motor')[0]).toMatchObject({ valor: '1498 cc', opciones: ['1.5'] })
    expect(campo(r, 'transmision')[0].opciones).toEqual(['Manual'])
    expect(campo(r, 'puertas')[0].opciones).toEqual(['4'])
    expect(campo(r, 'traccion')[0].opciones).toEqual(['4X2'])
    expect(campo(r, 'equipamiento').map((h) => h.valor)).toContain('Aire acondicionado')
    expect(campo(r, 'color')[0]).toMatchObject({ valor: 'Plateado', opciones: ['Plateado'] })
    expect(campo(r, 'procedencia')[0].opciones).toEqual(['Ecuador'])
    expect(campo(r, 'matricula')[0].opciones).toEqual(['Al día 2025'])
    expect(r.hallazgos[0].fuente.nombre).toBe('SRI · placa PBA1234')
    expect(r.avisos).toEqual([])
  })
  it('con valores pendientes no ofrece «matrícula al día» y lo avisa', () => {
    const r = interpretarSri('PBA1234', BASE, [{ descripcionRubro: 'IMPUESTO A LA PROPIEDAD', valorRubro: 45.5 }, { descripcionRubro: 'TASA ANT', valorRubro: 22 }])
    expect(campo(r, 'matricula')).toEqual([])
    expect(r.avisos[0]).toMatch(/pendiente en el SRI: \$67\.50/)
  })
  it('avisa la prohibición de enajenar', () => {
    expect(interpretarSri('PBA1234', { ...BASE, prohibidoEnajenar: 'S' }, []).avisos.join(' ')).toMatch(/prohibición de enajenar/)
  })
  it('clase JEEP se ofrece como SUV', () => {
    expect(campo(interpretarSri('PBA1234', { ...BASE, nombreClase: 'JEEP', descripcionModelo: 'GRAND VITARA SZ 2.0 5P 4X4 TM' }, []), 'carroceria')[0].opciones).toEqual(['SUV'])
  })
  it('nunca usa datos del propietario aunque vinieran en la respuesta', () => {
    const r = interpretarSri('PBA1234', { ...BASE, ...({ nombrePropietario: 'JUAN PEREZ', cedula: '1700000000' } as object) }, [])
    expect(JSON.stringify(r)).not.toMatch(/JUAN|PEREZ|1700000000/)
  })
})

describe('placa: lo que el vendedor pega desde el SRI', () => {
  it('JSON del servicio', () => {
    const r = interpretarPegado('PBA1234', JSON.stringify(BASE))!
    expect(campo(r, 'modelo')[0].opciones).toEqual(['Aveo Family'])
  })
  it('texto copiado de la página de consulta', () => {
    const texto = 'Información del vehículo\nMarca: KIA\nModelo: RIO LX AC 1.4 4P 4X2 TM\nAño de fabricación: 2016\nCilindraje: 1396\nPaís: COREA DEL SUR\nClase: AUTOMOVIL\nServicio: PARTICULAR'
    const r = interpretarPegado('PBA1234', texto)!
    expect(campo(r, 'marca')[0].opciones).toEqual(['Kia'])
    expect(campo(r, 'modelo')[0].opciones).toEqual(['Rio'])
    expect(campo(r, 'anio')[0].opciones).toEqual(['2016'])
    expect(campo(r, 'motor')[0].opciones).toEqual(['1.4'])
    expect(campo(r, 'procedencia')[0].opciones).toEqual(['Corea del Sur'])
  })
  it('texto que no es del SRI → null', () => {
    expect(interpretarPegado('PBA1234', 'hola mundo')).toBeNull()
  })
})

describe('placa: consulta directa', () => {
  it('consulta base y rubros con el código del vehículo', async () => {
    const urls: string[] = []
    const r = await consultarSri('PBA1234', async (url) => {
      urls.push(url)
      return new Response(JSON.stringify(url.includes('BaseVehiculo') ? BASE : [{ descripcionRubro: 'MATRICULA', valorRubro: 0 }]))
    }, 15000, "")
    expect(urls[0]).toContain('numeroPlacaCampvCpn=PBA1234')
    expect(urls[1]).toContain('codigoVehiculo=123456')
    expect(r.base.descripcionMarca).toBe('CHEVROLET')
  })
  it('si el navegador no puede llegar al SRI, lo dice claramente (para usar «pegar»)', async () => {
    await expect(consultarSri('PBA1234', async () => { throw new TypeError('Failed to fetch') })).rejects.toMatchObject({ tipo: 'sin-acceso' })
  })
  it('placa no registrada', async () => {
    await expect(consultarSri('PBA1234', async () => new Response('{}'))).rejects.toMatchObject({ tipo: 'no-existe' })
  })
})

describe('placa: motos, diagnóstico y resumen', () => {
  const MOTO: BaseSri = { codigoVehiculo: 9, descripcionMarca: 'YAMAHA', descripcionModelo: 'FZ 2.0 150', anioAuto: 2021, cilindraje: 149,
    colorVehiculo1: 'NEGRO', nombreClase: 'MOTOCICLETA', descripcionPais: 'INDIA', ultimoAnioPagado: 2025 }
  it('moto: marca, modelo, cilindraje en cc y clase «Moto»', () => {
    const r = interpretarSri('IB123C', MOTO, [])
    expect(campo(r, 'marca')[0].opciones).toEqual(['Yamaha'])
    expect(campo(r, 'modelo')[0].opciones).toEqual(['FZ'])
    expect(campo(r, 'motor')[0].opciones).toEqual(['149 cc'])
    expect(campo(r, 'carroceria')[0].opciones).toEqual(['Moto'])
  })
  it('moto en las plantillas: «149 cc» (no «149 ccL») y frase para moto', () => {
    const v = { ...analizar('yamaha fz 2021').vehiculo, motor: '149 cc', carroceria: 'Moto' }
    const ctx = { v, perfil: { nombre: 'Juan Pérez', telefono: '0987654321', estiloTelefono: 'guiones' as const, horario: '' }, beneficios: BENEFICIOS_PREDETERMINADOS }
    expect(titulos(ctx)[0].texto).toContain('149 cc')
    expect(titulos(ctx)[0].texto).not.toContain('ccL')
    expect(descripciones(ctx)[0].texto).toContain('moverse ágil y económico por la ciudad')
  })
  it('texto libre de moto: «150cc»', () => {
    expect(analizar('bajaj pulsar 200 ns 2019 200cc').vehiculo.motor).toBe('200 cc')
  })
  it('auto de 1600 cc sigue en litros', () => {
    expect(campo(interpretarSri('PBA1234', { ...BASE, cilindraje: 1598 }, []), 'motor')[0].opciones).toEqual(['1.6'])
  })
  it('diagnóstico: si «no-cors» responde, el problema es la política del navegador', async () => {
    const e = await consultarSri('PBA1234', async (_u, init) => {
      if (init?.mode === 'no-cors') return new Response(null, { status: 200 })
      throw new TypeError('Failed to fetch')
    }).catch((x) => x)
    expect(e.message).toMatch(/no permite que otras páginas lean sus datos/)
  })
  it('diagnóstico: si tampoco responde, es la red', async () => {
    const e = await consultarSri('PBA1234', async () => { throw new TypeError('Failed to fetch') }).catch((x) => x)
    expect(e.message).toMatch(/no respondió desde tu conexión/)
  })
  it('resumen para el historial de placas', () => {
    expect(resumenDePlaca(interpretarSri('PBA1234', BASE, []))).toBe('Chevrolet Aveo Family 2015 · Plateado')
  })
})

describe('placa: lectura tolerante de la respuesta', () => {
  it('encuentra los datos aunque cambien los nombres de campo o vengan anidados', () => {
    const r = interpretarSri('YAA0208', { vehiculo: { marca: 'CHEVROLET', modelo: 'CHEVYTAXI A/C', anioModelo: '2010', cilindrajeMotor: '1498', color: 'AMARILLO', clase: 'AUTOMOVIL', servicio: 'ALQUILER', canton: 'QUITO' }, ultimoAnioPagado: 2026 } as unknown as BaseSri, [])
    expect(campo(r, 'modelo')[0].opciones).toEqual(['Chevytaxi'])
    expect(campo(r, 'anio')[0].opciones).toEqual(['2010'])
    expect(campo(r, 'motor')[0].opciones).toEqual(['1.5'])
    expect(campo(r, 'color')[0].opciones).toEqual(['Amarillo'])
    expect(r.hallazgos.find((h) => h.etiqueta === 'Matriculado en')?.valor).toBe('Quito')
    expect(r.avisos.join(' ')).toMatch(/servicio «Alquiler» \(no particular\)/)
  })
  it('ignora ceros y vacíos (cilindraje 0 no se ofrece)', () => {
    const r = interpretarSri('PBA1234', { ...BASE, cilindraje: 0, colorVehiculo1: '' }, [])
    expect(campo(r, 'motor').map((h) => h.valor)).not.toContain('0 cc')
    expect(campo(r, 'color')).toEqual([])
  })
})

describe('placa: servidor propio', () => {
  it('usa el servidor si está configurado', async () => {
    const urls: string[] = []
    const r = await consultarSri('PBA1234', async (url) => { urls.push(url); return new Response(JSON.stringify({ placa: 'PBA1234', base: BASE, rubros: [] })) }, 15000, 'https://placas.ejemplo.workers.dev/')
    expect(urls).toEqual(['https://placas.ejemplo.workers.dev/placa/PBA1234'])
    expect(r.base.descripcionModelo).toBe(BASE.descripcionModelo)
  })
  it('placa no registrada según el servidor → no-existe (sin reintentos)', async () => {
    await expect(consultarSri('PBA1234', async () => new Response('{"error":"x"}', { status: 404 }), 15000, 'https://s.dev')).rejects.toMatchObject({ tipo: 'no-existe' })
  })
  it('si el servidor no responde, intenta directo con el SRI', async () => {
    const urls: string[] = []
    const r = await consultarSri('PBA1234', async (url) => {
      urls.push(url)
      if (url.startsWith('https://s.dev')) throw new TypeError('Failed to fetch')
      return new Response(JSON.stringify(url.includes('BaseVehiculo') ? BASE : []))
    }, 15000, 'https://s.dev')
    // Dos intentos con el servidor y luego directo
    expect(urls.slice(0, 2)).toEqual(['https://s.dev/placa/PBA1234', 'https://s.dev/placa/PBA1234'])
    expect(urls[2]).toContain('srienlinea.sri.gob.ec')
    expect(r.base.descripcionMarca).toBe('CHEVROLET')
  })
})

// Forma real de la respuesta del SRI (2026-11): color, cilindraje y clase llegan en null; el traspaso viene como rubro.
const REAL = { codigoVehiculo: 1, numeroPlaca: 'PBA1234', colorVehiculo1: null, colorVehiculo2: null, cilindraje: null, nombreClase: null,
  descripcionMarca: 'CHEVROLET', descripcionModelo: 'CORSA 5P A/C 1.4L', anioAuto: 2002, descripcionPais: 'COLOMBIA', descripcionServicio: null,
  ultimoAnioPagado: 2026, prohibidoEnajenar: null, estadoExoneracion: 'NO' } as unknown as BaseSri
const TRASPASO = { codigoTipoDeuda: 'TRANSF_DOM', descripcionRubro: '1% TRANSFERENCIA DE DOMINIO', valorRubro: 14.75, anioHastaPago: 2026 }

describe('placa: respuesta real del SRI', () => {
  it('el 1 % de traspaso no es deuda: matrícula al día y valor del traspaso informado', () => {
    const r = interpretarSri('PBA1234', REAL, [TRASPASO])
    expect(campo(r, 'matricula')[0].opciones).toEqual(['Al día 2026'])
    expect(r.avisos.join(' ')).not.toMatch(/pendiente/)
    expect(r.avisos.join(' ')).toMatch(/Transferencia de dominio por pagar en el SRI: \$14\.75/)
  })
  it('matrícula del año pendiente: aviso con años y total, sin «al día»', () => {
    const r = interpretarSri('PBA1234', { ...REAL, ultimoAnioPagado: 2025 } as BaseSri, [TRASPASO,
      { codigoTipoDeuda: 'MATRICULA', descripcionRubro: 'TASA SPPAT', valorRubro: 41.83, anioHastaPago: 2026 },
      { codigoTipoDeuda: 'MATRICULA', descripcionRubro: 'TASAS ANT', valorRubro: 36, anioHastaPago: 2026 }])
    expect(campo(r, 'matricula')).toEqual([])
    expect(r.avisos.join(' ')).toMatch(/Matrícula 2026 pendiente en el SRI: \$77\.83 \(Tasa Sppat, Tasas Ant\)/)
    expect(r.hallazgos.find((h) => h.etiqueta === 'Último año de matrícula pagado')?.valor).toBe('2025')
  })
  it('sin cilindraje: el motor sale del modelo registrado (1.4L); sin color ni clase no se inventa nada', () => {
    const r = interpretarSri('PBA1234', REAL, [])
    expect(campo(r, 'modelo')[0].opciones).toEqual(['Corsa'])
    expect(campo(r, 'motor')[0].opciones).toEqual(['1.4'])
    expect(campo(r, 'puertas')[0].opciones).toEqual(['5'])
    expect(campo(r, 'color')).toEqual([])
    expect(campo(r, 'carroceria')).toEqual([])
  })
  it('moto reconocida por la placa aunque el SRI no informe la clase', () => {
    const r = interpretarSri('AB123C', { ...REAL, descripcionMarca: 'FACTORY BIKE', descripcionModelo: 'F-370', anioAuto: 2022 } as BaseSri, [])
    expect(campo(r, 'carroceria')[0].opciones).toEqual(['Moto'])
    expect(campo(r, 'marca')[0].opciones).toEqual(['Factory Bike'])
  })
  it('último pago de matrícula del historial (el más reciente) y placa registrada con 0', () => {
    const r = interpretarSri('PJM343', REAL, [], [
      { fechaDePago: '2020-12-03 12:54', tipoDeuda: 'PAGO DEL VALOR DE LA MATRÍCULA', monto: 70.1 },
      { fechaDePago: '2024-04-08 02:31', tipoDeuda: 'PAGO DEL VALOR DE LA MATRÍCULA', monto: 69.85 },
      { fechaDePago: '2025-01-01 10:00', tipoDeuda: 'PAGO DEL VALOR DE TRANSFERENCIA DE DOMINIO', monto: 12 }], 'PJM0343')
    expect(r.hallazgos.find((h) => h.etiqueta === 'Último pago de matrícula')?.valor).toBe('2024-04-08 · $69.85')
    expect(r.fuentes[0].nombre).toBe('SRI · placa PJM0343')
  })
})

describe('placa: desglose y detalle de pagos (ConsultaComponente y obtenerDetallesPago, forma real)', () => {
  const RUBROS = [
    { codigoRubro: 1, codigoTipoDeuda: 'MATRICULA', descripcionRubro: 'TASA SPPAT', valorRubro: 41.83, anioHastaPago: 2026 },
    { codigoRubro: 2, codigoTipoDeuda: 'TRANSF_DOM', descripcionRubro: '1% TRANSFERENCIA DE DOMINIO', valorRubro: 79.71, anioHastaPago: 2026 },
  ]
  const EXTRA = {
    componentes: [
      { codigoRubro: 1, componentes: [{ codigoComponente: 'TASA', anioFiscal: 2026, valorComponente: 28.85 }, { codigoComponente: 'RECARGO', anioFiscal: 2026, valorComponente: 12.98 }] },
      { codigoRubro: 2, componentes: [{ codigoComponente: 'TRANSF_DOM', anioFiscal: 2025, valorComponente: 30 }, { codigoComponente: 'TRANSF_DOM', anioFiscal: 2026, valorComponente: 11.89 }] },
    ],
    detallesPago: [
      { fechaDePago: '2025-02-17 04:25', detalle: [{ descripcionRubro: 'TASAS ANT', anio: 2024, valor: 36 }, { descripcionRubro: 'TASAS ANT', anio: 2025, valor: 36 }] },
      { fechaDePago: '2025-02-17 04:25', detalle: [{ descripcionRubro: '1% TRANSFERENCIA DE DOMINIO', anio: 2025, valor: 11.89 }] },
      { fechaDePago: '2023-08-30 11:56', detalle: [{ descripcionRubro: 'TASA SPPAT', anio: 2023, valor: 28.85 }] },
    ],
  }
  it('informa recargos por atraso, años del traspaso pendiente y años de matrícula pagados', () => {
    const r = interpretarSri('PBA1234', { ...REAL, ultimoAnioPagado: 2025 } as BaseSri, RUBROS, [], 'PBA1234', EXTRA)
    const avisos = r.avisos.join(' ')
    expect(avisos).toMatch(/Matrícula 2026 pendiente en el SRI: \$41\.83 \(Tasa Sppat\), incluye \$12\.98 de recargos e intereses por atraso/)
    expect(avisos).toMatch(/Transferencia de dominio por pagar en el SRI: \$79\.71 \(años 2025–2026\)/)
    expect(r.hallazgos.find((h) => h.etiqueta.startsWith('Años de matrícula pagados'))?.valor).toBe('2023, 2024, 2025')
  })
})

describe('placa: descripciones reales de modelos del SRI (verificadas con placas reales)', () => {
  const modeloDe = (marca: string, desc: string) => interpretarSri('PBA1234', { codigoVehiculo: 1, descripcionMarca: marca, descripcionModelo: desc, anioAuto: 2016 }, [])
  const op = (r: ReturnType<typeof modeloDe>, c: string) => r.hallazgos.find((h) => h.campo === c)?.opciones?.[0]
  it('«N200 VAN PASAJEROS 1.2L TM»: el código N200 no se «corrige» a N300', () => {
    const r = modeloDe('CHEVROLET', 'N200 VAN PASAJEROS 1.2L TM')
    expect(op(r, 'modelo')).toBe('N200')
    expect(op(r, 'motor')).toBe('1.2')
    expect(op(r, 'transmision')).toBe('Manual')
  })
  it('«LOGAN 1.6 M/T»: M/T es transmisión manual', () => {
    expect(op(modeloDe('RENAULT', 'LOGAN 1.6 M/T'), 'transmision')).toBe('Manual')
  })
  it('«X-TRAIL SENSE CVT AC 2.5 5P 4X2 TA»: motor, caja, puertas, tracción y A/C', () => {
    const r = modeloDe('NISSAN', 'X-TRAIL SENSE CVT AC 2.5 5P 4X2 TA')
    expect([op(r, 'modelo'), op(r, 'motor'), op(r, 'transmision'), op(r, 'puertas'), op(r, 'traccion')]).toEqual(['X-Trail', '2.5', 'Automática', '5', '4X2'])
  })
  it('marca no catalogada «TUKO TK 150-7»: se conserva el modelo completo', () => {
    expect(op(modeloDe('TUKO', 'TK 150-7'), 'modelo')).toBe('TK 150-7')
    expect(modeloDeDescripcion('F-370')).toBe('F-370')
  })
  it('observación del SRI y rango completo de años adeudados', () => {
    const r = interpretarSri('PBA1234', { ...REAL, ultimoAnioPagado: 2016, observacion: 'Vehículo acogido a la Disposición Transitoria Décima.' } as BaseSri,
      [{ codigoTipoDeuda: 'MATRICULA', descripcionRubro: 'TASA SPPAT', valorRubro: 1066.11, anioDesdePago: 2017, anioHastaPago: 2026 }])
    expect(r.hallazgos.find((h) => h.etiqueta === 'Observación del SRI')?.valor).toMatch(/Disposición Transitoria/)
    expect(r.avisos.join(' ')).toMatch(/Matrícula 2017–2026 pendiente en el SRI: \$1066\.11/)
  })
})

describe('placa: campos adicionales de la respuesta real', () => {
  it('exonerado, eléctrico, cuotas ambientales y resumen de traspasos', () => {
    const r = interpretarSri('PBA1234', { ...REAL, estadoExoneracion: 'SI', verMensajeElectricos: true, aplicaCuota: true } as BaseSri, [], [], 'PBA1234',
      { resumenPagos: { totalPagos: 22, traspasos: 3, ultimoTraspaso: '2024-10-23', primerPago: '2006-07-03' } })
    expect(r.avisos.join(' ')).toMatch(/EXONERADO/)
    const v = (e: string) => r.hallazgos.find((h) => h.etiqueta.startsWith(e))?.valor
    expect(v('Tipo de vehículo según el SRI')).toBe('Eléctrico')
    expect(v('Impuesto ambiental')).toMatch(/cuotas/)
    expect(v('Pagos registrados en el SRI')).toBe('22 (desde 2006)')
    expect(v('Traspasos de dominio pagados')).toBe('3, el último el 2024-10-23')
  })
  it('«NO» en exoneración no genera aviso', () => {
    expect(interpretarSri('PBA1234', REAL, []).avisos.join(' ')).not.toMatch(/EXONERADO/)
  })
})

describe('placa: carrocería escrita en el modelo registrado', () => {
  it('«ALLEGRO SEDAN 1.6»: carrocería Sedán y sin versión «Sedán Sedán»', () => {
    const r = interpretarSri('PBA1234', { codigoVehiculo: 1, descripcionMarca: 'MAZDA', descripcionModelo: 'ALLEGRO SEDAN 1.6', anioAuto: 2004 }, [])
    expect(r.hallazgos.find((h) => h.campo === 'carroceria')?.opciones).toEqual(['Sedán'])
    expect(r.hallazgos.find((h) => h.campo === 'version')).toBeUndefined()
  })
})

describe('placa: cilindraje desde el impuesto ambiental pagado (forma real del servidor)', () => {
  const IACV = [{ anio: 2014, componente: 'Impuesto', valor: 81 }, { anio: 2015, componente: 'Impuesto', valor: 85.05 }, { anio: 2013, componente: 'Interes', valor: 3.31 }]
  it('Jeep Patriot 2010 sin cilindraje en el SRI → motor 2.4 (2400 cc)', () => {
    const r = interpretarSri('PBA1234', { codigoVehiculo: 1, descripcionMarca: 'JEEP', descripcionModelo: 'PATRIOT', anioAuto: 2010 }, [], [], 'PBA1234', { impuestoAmbiental: IACV })
    const m = r.hallazgos.find((h) => h.campo === 'motor')
    expect(m?.opciones).toEqual(['2.4'])
    expect(m?.etiqueta).toMatch(/impuesto ambiental/)
  })
  it('si el modelo registrado ya trae el motor y coincide, se confirma; si no coincide, se avisa', () => {
    const ok = interpretarSri('PBA1234', { codigoVehiculo: 1, descripcionMarca: 'CHEVROLET', descripcionModelo: 'CORSA EVOLUTION 4P 1.8 STD', anioAuto: 2004 }, [], [], 'PBA1234',
      { impuestoAmbiental: [{ anio: 2013, componente: 'Impuesto', valor: 25.2 }] })
    expect(ok.hallazgos.find((h) => h.etiqueta === 'Confirmado por el impuesto ambiental')?.valor).toBe('1800 cc')
    const mal = interpretarSri('PBA1234', { codigoVehiculo: 1, descripcionMarca: 'CHEVROLET', descripcionModelo: 'CORSA 1.4', anioAuto: 2004 }, [], [], 'PBA1234',
      { impuestoAmbiental: [{ anio: 2013, componente: 'Impuesto', valor: 25.2 }] })
    expect(mal.avisos.join(' ')).toMatch(/dice motor 1\.4 pero el impuesto ambiental pagado corresponde a 1800 cc/)
  })
})

describe('placa: textos sin afirmaciones falsas', () => {
  it('con matrícula pendiente la descripción no dice «documentación en regla»; país con minúsculas correctas', () => {
    const a = analizar('Jeep Patriot 2.4 2010')
    const r = interpretarSri('PBA1234', { codigoVehiculo: 1, descripcionMarca: 'JEEP', descripcionModelo: 'PATRIOT', anioAuto: 2010, descripcionPais: 'ESTADOS UNIDOS DE AMÉRICA', ultimoAnioPagado: 2024 }, [{ descripcionRubro: 'TASAS ANT', valorRubro: 97 }])
    expect(r.hallazgos.find((h) => h.campo === 'procedencia')?.opciones).toEqual(['Estados Unidos de América'])
    const ctx = { v: { ...a.vehiculo, matricula: '' }, perfil: { nombre: 'X', telefono: '0987654321', estiloTelefono: 'puntos', horario: '' } as never, beneficios: BENEFICIOS_PREDETERMINADOS }
    expect(descripciones(ctx).map((d) => d.texto).join('\n')).not.toMatch(/documentación en regla|papeles en regla/)
  })
})

describe('placa: monto pendiente para el campo de deuda', () => {
  it('la matrícula pendiente llena «deuda» (sin el 1 % de traspaso)', () => {
    const r = interpretarSri('PBA1234', { ...REAL, ultimoAnioPagado: 2025 } as BaseSri, [TRASPASO,
      { codigoTipoDeuda: 'MATRICULA', descripcionRubro: 'TASA SPPAT', valorRubro: 41.83, anioHastaPago: 2026 },
      { codigoTipoDeuda: 'MATRICULA', descripcionRubro: 'TASAS ANT', valorRubro: 36, anioHastaPago: 2026 }])
    expect(r.hallazgos.find((h) => h.campo === 'deuda')?.opciones).toEqual(['77.83'])
  })
  it('al día: no hay deuda', () => {
    expect(interpretarSri('PBA1234', REAL, [TRASPASO]).hallazgos.find((h) => h.campo === 'deuda')).toBeUndefined()
  })
})
