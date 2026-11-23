import { describe, expect, it } from 'vitest'
import { consultarSri, interpretarPegado, interpretarSri, normalizarPlaca, placaValida, resumenDePlaca, type BaseSri } from './placa'
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
    expect(r.avisos[0]).toMatch(/valores pendientes en el SRI por \$67\.50/)
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
    expect(campo(r, 'procedencia')[0].opciones).toEqual(['Corea Del Sur'])
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
    })
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
    const ctx = { v, perfil: { nombre: 'Erick Costa', telefono: '0987654321', estiloTelefono: 'guiones' as const, horario: '' }, beneficios: BENEFICIOS_PREDETERMINADOS }
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
    expect(campo(r, 'motor')).toEqual([])
    expect(campo(r, 'color')).toEqual([])
  })
})
