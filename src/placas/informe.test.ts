import { describe, expect, it } from 'vitest'
import { compararFuentes, informeTexto, mismoModelo, nivelDeVerificacion, valoresPendientes, type RespuestaConsulta } from './informe'

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
    expect(compararFuentes(soloAtm).map((c) => c.estado)).toEqual(['solo-atm', 'solo-atm', 'solo-atm'])
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
