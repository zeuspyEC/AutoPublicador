import { describe, expect, it } from 'vitest'
import { avisosDe, compararFuentes, informeTexto, kilometraje, mismoModelo, nivelDeVerificacion, textoNivel, valoresPendientes, type AmtConsulta, type RespuestaConsulta } from './informe'

// Misma forma que la respuesta real de /consulta/PLACA (valores inventados)
const respuesta = (cambios: Partial<RespuestaConsulta> = {}): RespuestaConsulta => ({
  placa: 'GSD5678', consultado: '2026-11-27T15:00:00.000Z',
  sri: {
    encontrada: true, registrada: 'GSD5678',
    base: { codigoVehiculo: 1, descripcionMarca: 'CHEVROLET', descripcionModelo: 'GRAND VITARA 2.0L 5P STD TM 4X2', anioAuto: 2012, descripcionPais: 'JAPON', ultimoAnioPagado: 2025, estadoExoneracion: 'NO' },
    rubros: [
      { codigoRubro: 7, descripcionRubro: 'TASA SPPAT', valorRubro: 57.49, anioDesdePago: 2026, anioHastaPago: 2026, codigoTipoDeuda: 'MATRICULA' },
      { codigoRubro: 8, descripcionRubro: 'TRANSFERENCIA DE DOMINIO', valorRubro: 120, anioHastaPago: 2026, codigoTipoDeuda: 'TRANSFERENCIA' },
      { codigoRubro: 9, descripcionRubro: 'PAGADO', valorRubro: 0 },
    ],
    componentes: [{ codigoRubro: 7, componentes: [{ codigoComponente: 'RECARGO', anioFiscal: 2026, valorComponente: 27.23 }, { codigoComponente: 'TASA', anioFiscal: 2026, valorComponente: 30.26 }] }],
    pagos: [{ fechaDePago: '2025-03-08 09:55', tipoDeuda: 'PAGO DEL VALOR DE LA MATRÍCULA', monto: 66.41 }],
    resumenPagos: { totalPagos: 5, traspasos: 1, ultimoTraspaso: '2024-09-23', primerPago: '2022-10-13', ultimoPago: '2025-03-08' },
    impuestoAmbiental: [],
  },
  atm: { encontrada: true, registrada: 'GSD5678', marca: 'CHEVROLET', modelo: 'GRAND VITARA 2.', anio: '2012', revisiones: [{ observacion: 'RENOVACIÓN DE MATRÍCULA', fecha: '2025-08-21', estado: 'APROBADO', revision: 1 }] },
  ...cambios,
})

describe('consulta de placas: verificación cruzada SRI ↔ ATM', () => {
  it('el modelo cortado de ATM coincide con el completo del SRI, pero no uno distinto', () => {
    expect(mismoModelo('GRAND VITARA 2.0L 5P STD TM 4X2', 'GRAND VITARA 2.')).toBe(true)
    expect(mismoModelo('X-TRAIL SENSE CVT AC 2.5', 'X-TRAIL SENSE C')).toBe(true)
    expect(mismoModelo('F-370', 'F-370')).toBe(true)
    expect(mismoModelo('AVEO FAMILY', 'SAIL LS')).toBe(false)
    expect(mismoModelo('', 'SAIL')).toBe(false)
  })
  it('todo coincide → verificada', () => {
    const r = respuesta()
    expect(compararFuentes(r).map((c) => c.estado)).toEqual(['coincide', 'coincide', 'coincide'])
    expect(nivelDeVerificacion(r)).toBe('verificada')
  })
  it('un año distinto → revisar; una sola fuente → una-fuente; ninguna → no-encontrada', () => {
    expect(nivelDeVerificacion(respuesta({ atm: { ...respuesta().atm, anio: '2013' } }))).toBe('revisar')
    const soloAtm = respuesta({ sri: { encontrada: false, error: 'El SRI no tiene registrada la placa GSD5678.' } })
    expect(nivelDeVerificacion(soloAtm)).toBe('una-fuente')
    expect(compararFuentes(soloAtm).map((c) => c.estado)).toEqual(['una-fuente', 'una-fuente', 'una-fuente'])
    expect(nivelDeVerificacion(respuesta({ sri: { encontrada: false }, atm: { encontrada: false } }))).toBe('no-encontrada')
  })
})

describe('consulta de placas: valores e informe', () => {
  it('separa la matrícula del traspaso y suma los recargos', () => {
    expect(valoresPendientes(respuesta().sri)).toMatchObject({ matricula: 57.49, traspaso: 120, recargos: 27.23, total: 177.49 })
  })
  it('el informe en texto trae la verificación, los valores y las fuentes', () => {
    const t = informeTexto(respuesta())
    expect(t).toContain('INFORME DE PLACA GSD5678')
    expect(t).toContain('Verificación: Datos verificados en 2 fuentes oficiales')
    expect(t).toContain('Valores pendientes en el SRI: $177,49')
    expect(t).toContain('Traspasos de dominio: 1 (último 23/09/2024)')
    expect(t).toContain('Revisión técnica ATM: 1 registro(s), la última el 21/08/2025 (APROBADO)')
    expect(t).toContain('Fuentes: SRI')
  })
  it('si no hay deuda lo dice, y sin SRI usa los datos de ATM', () => {
    const r = respuesta({ sri: { ...respuesta().sri, rubros: [] } })
    expect(informeTexto(r)).toContain('Sin valores pendientes en el SRI')
    const t = informeTexto(respuesta({ sri: { encontrada: false } }))
    expect(t).toContain('Marca: CHEVROLET')
    expect(t).not.toContain('valores pendientes')
  })
})

// Forma real de /amt/PLACA (valores inventados)
const amt = (revisiones: AmtConsulta['revisiones'], cambios: Partial<NonNullable<AmtConsulta['vehiculo']>> = {}): AmtConsulta => ({
  encontrada: true, registrada: 'GSD5678',
  vehiculo: { marca: 'CHEVROLET', modelo: 'GRAND VITARA 2.0L 5P STD TM 4X2', anio: '2012', tipo: 'LIVIANO', subtipo: 'AUTOMOVIL 4 TIEMPOS', placaAnterior: null, chasis: 'JN**43', motor: 'QR**6L', ...cambios },
  revisiones,
})
const rev = (fecha: string | null, estado: string, km: number | null, defectos: { elemento: string; resultado: string }[] = []) => ({
  fecha, vence: `${(fecha ?? '2024').slice(0, 4)}-12-31`, estado, centro: 'CENTRO A', intento: 1, kilometraje: km, certificado: null, pruebas: 20,
  defectos: defectos.map((d) => ({ tipo: 'Visual', valor: null, nota: null, defecto: true, ...d })),
})

describe('consulta de placas: AMT Quito (tercera fuente, kilometraje y revisiones)', () => {
  it('tres fuentes que coinciden → verificada en 3; una que difiere → revisar', () => {
    const r = respuesta({ amt: amt([]) })
    expect(nivelDeVerificacion(r)).toBe('verificada')
    expect(textoNivel(r).titulo).toBe('Datos verificados en 3 fuentes oficiales')
    expect(textoNivel(r).texto).toBe('Marca, modelo y año coinciden entre SRI, ATM y AMT.')
    const distinta = respuesta({ amt: amt([], { anio: '2014' }) })
    expect(nivelDeVerificacion(distinta)).toBe('revisar')
    expect(compararFuentes(distinta).find((c) => c.dato === 'Año')).toEqual({ dato: 'Año', valores: { sri: '2012', atm: '2012', amt: '2014' }, estado: 'difiere' })
  })
  it('ordena el odómetro, calcula el promedio por año y detecta un retroceso', () => {
    const k = kilometraje(amt([rev('2025-06-10', 'APROBADO', 150000), rev(null, 'NO SE PRESENTÓ', null), rev('2023-06-01', 'APROBADO', 160000), rev('2021-06-01', 'APROBADO', 120000)]))
    expect(k.lecturas.map((l) => l.km)).toEqual([120000, 160000, 150000])
    expect(k.retrocesos).toEqual([{ antes: { fecha: '2023-06-01', km: 160000 }, despues: { fecha: '2025-06-10', km: 150000 } }])
    expect(k.ultima).toEqual({ fecha: '2025-06-10', km: 150000 })
    expect(k.porAnio).toBe(7454) // 30.000 km en 4,02 años
    expect(kilometraje(undefined).lecturas).toEqual([])
  })
  it('avisa si no se presentó a la última revisión y si la última quedó condicional con defectos graves', () => {
    expect(avisosDe(respuesta({ amt: amt([rev(null, 'NO SE PRESENTÓ', null), rev('2024-05-01', 'APROBADO', 1000)]) }))
      .some((a) => a.includes('NO se presentó a la revisión técnica que vencía el 31/12/2024'))).toBe(true)
    const cond = avisosDe(respuesta({ amt: amt([rev('2025-05-01', 'CONDICIONAL', 1000, [{ elemento: 'PARABRISAS', resultado: 'Peligroso' }, { elemento: 'LUZ', resultado: 'Moderado' }])]) }))
    expect(cond.some((a) => a.includes('«CONDICIONAL» con 1 defecto(s) grave(s): parabrisas'))).toBe(true)
  })
  it('el informe incluye la revisión de la AMT, el kilometraje y el retroceso', () => {
    const t = informeTexto(respuesta({ amt: amt([rev('2025-06-10', 'APROBADO', 150000), rev('2023-06-01', 'APROBADO', 160000)]) }))
    expect(t).toContain('Tipo (AMT): LIVIANO · AUTOMOVIL 4 TIEMPOS')
    expect(t).toContain('Revisión técnica AMT Quito: 2 presentada(s), la última el 10/06/2025 (APROBADO)')
    expect(t).toMatch(/Kilometraje registrado: 150.000 km \(10\/06\/2025\)/)
    expect(t).toContain('⚠ El kilometraje bajó de 160.000 km')
    expect(t).toContain('AMT Quito (web.amt.gob.ec)')
  })
})
