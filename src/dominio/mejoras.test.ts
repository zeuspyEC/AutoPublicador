import { describe, expect, it } from 'vitest'
import { buscarEnHistorial, contarEstados, haceCuanto } from './historial'
import { comentarios, rellenarRespuesta } from './plantillas'
import { leerRespaldo, unirRespaldo } from './respaldo'
import { BENEFICIOS_PREDETERMINADOS, VEHICULO_VACIO, type Perfil } from './tipos'
import type { PlacaConsultada, Publicacion } from '../servicios/almacen'

const perfil: Perfil = { nombre: 'Juan Pérez', telefono: '0987654321', estiloTelefono: 'puntos', horario: 'Lunes a sábado de 9:00 a 18:00' }
const pub = (id: string, fecha: string, extra: Partial<Publicacion['vehiculo']> = {}, otros: Partial<Publicacion> = {}): Publicacion => ({
  id, fecha, texto: '', vehiculo: { ...VEHICULO_VACIO, ...extra }, origenes: {}, titulo: `${extra.marca ?? ''} ${extra.modelo ?? ''}`.trim(), descripcion: '', ...otros,
})
const placa = (p: string, fecha: string, sinRespuesta?: string): PlacaConsultada => ({ placa: p, fecha, resumen: sinRespuesta ? '' : 'Chevrolet Aveo 2015', sinRespuesta, resultado: { resumen: '', hallazgos: [], avisos: [], fuentes: [] } })

describe('historial: buscar, estados y antigüedad', () => {
  const lista = [
    pub('1', '2026-11-20T10:00:00Z', { marca: 'Chevrolet', modelo: 'Vitara', anio: '1997', color: 'Plateado' }, { placa: 'PBA1234' }),
    pub('2', '2026-11-21T10:00:00Z', { marca: 'Toyota', modelo: 'Hilux', anio: '2014' }, { estado: 'vendido' }),
    pub('3', '2026-11-22T10:00:00Z', { marca: 'Peugeot', modelo: '206', anio: '2008' }, { estado: 'reservado' }),
  ]
  it('busca por placa, marca, modelo, año o color sin importar tildes ni mayúsculas', () => {
    expect(buscarEnHistorial(lista, 'pba').map((p) => p.id)).toEqual(['1'])
    expect(buscarEnHistorial(lista, 'vitara 1997').map((p) => p.id)).toEqual(['1'])
    expect(buscarEnHistorial(lista, 'PLATEADO').map((p) => p.id)).toEqual(['1'])
    expect(buscarEnHistorial(lista, 'hilux 2008')).toEqual([])
    expect(buscarEnHistorial(lista, '').length).toBe(3)
  })
  it('filtra y cuenta por estado (sin estado = disponible)', () => {
    expect(buscarEnHistorial(lista, '', 'vendido').map((p) => p.id)).toEqual(['2'])
    expect(buscarEnHistorial(lista, '', 'disponible').map((p) => p.id)).toEqual(['1'])
    expect(contarEstados(lista)).toEqual({ disponible: 1, reservado: 1, vendido: 1 })
  })
  it('dice hace cuánto se guardó', () => {
    const ahora = new Date(2026, 10, 26, 12)
    expect(haceCuanto(new Date(2026, 10, 26, 8).toISOString(), ahora)).toBe('hoy')
    expect(haceCuanto(new Date(2026, 10, 25, 23).toISOString(), ahora)).toBe('ayer')
    expect(haceCuanto(new Date(2026, 10, 19, 12).toISOString(), ahora)).toBe('hace 7 días')
    expect(haceCuanto(new Date(2026, 9, 26, 12).toISOString(), ahora)).toBe('hace 4 semanas')
    expect(haceCuanto(new Date(2026, 6, 26, 12).toISOString(), ahora)).toBe('hace 4 meses')
    expect(haceCuanto('no es fecha', ahora)).toBe('')
  })
})

describe('respuestas propias', () => {
  const ctx = { v: { ...VEHICULO_VACIO, marca: 'Chevrolet', modelo: 'Corsa', anio: '2002', precio: '3990' }, perfil, beneficios: BENEFICIOS_PREDETERMINADOS, ubicacion: 'Norte de Quito' }
  it('reemplaza los campos con los datos actuales (sin importar tildes ni mayúsculas)', () => {
    expect(rellenarRespuesta(ctx, 'El {vehiculo} está en {PRECIO}. {Teléfono} — {nombre}, {ubicación}. {horario}'))
      .toBe('El Chevrolet Corsa 2002 está en $3.990. 0987.654.321 — Juan Pérez, Norte de Quito. Lunes a sábado de 9:00 a 18:00')
  })
  it('deja igual lo que no es un campo y quita el precio si no hay', () => {
    expect(rellenarRespuesta({ ...ctx, v: { ...ctx.v, precio: '' } }, 'Precio: {precio} {otro}')).toBe('Precio: {otro}')
  })
  it('aparecen al final de las respuestas y las vacías no salen', () => {
    const c = comentarios({ ...ctx, respuestas: [{ id: 'a', nombre: 'Saludo', texto: 'Hola, el {vehiculo} sigue disponible' }, { id: 'b', nombre: 'Vacía', texto: '  ' }] })
    expect(c.at(-1)).toEqual({ id: 'propia-a', nombre: 'Saludo', texto: 'Hola, el Chevrolet Corsa 2002 sigue disponible' })
    expect(c.some((x) => x.nombre === 'Vacía')).toBe(false)
  })
})

describe('copia de seguridad', () => {
  const respaldo = { app: 'AutoPublicador', version: 1, fecha: '2026-11-26', perfil, ajustes: null, historial: [pub('1', '2026-11-20T10:00:00Z', { marca: 'Kia' }), pub('2', '2026-11-25T10:00:00Z', { marca: 'Mazda' })], placas: [placa('PBA1234', '2026-11-20T00:00:00Z'), placa('PCH7548', '2026-11-21T00:00:00Z')] }
  it('reconoce un respaldo y rechaza cualquier otro texto', () => {
    expect(leerRespaldo(JSON.stringify(respaldo))?.historial.length).toBe(2)
    expect(leerRespaldo('hola')).toBeNull()
    expect(leerRespaldo('{"app":"Otra","historial":[],"placas":[]}')).toBeNull()
    expect(leerRespaldo(JSON.stringify({ ...respaldo, historial: [{ basura: 1 }, ...respaldo.historial] }))?.historial.length).toBe(2)
  })
  it('une sin perder nada: suma lo que falta y se queda con lo más reciente', () => {
    const actual = { perfil: { ...perfil, nombre: 'Otro vendedor' }, ajustes: null, historial: [pub('1', '2026-11-22T10:00:00Z', { marca: 'Kia', modelo: 'Rio' }), pub('9', '2026-11-23T10:00:00Z')], placas: [placa('PBA1234', '2026-11-22T00:00:00Z', 'sin conexión')] }
    const u = unirRespaldo(leerRespaldo(JSON.stringify(respaldo))!, actual)
    expect(u.historial.map((p) => p.id)).toEqual(['2', '9', '1'])
    expect(u.historial.find((p) => p.id === '1')!.vehiculo.modelo).toBe('Rio') // la de aquí era más reciente
    expect(u.nuevas).toBe(1)
    expect(u.placas.find((p) => p.placa === 'PBA1234')!.sinRespuesta).toBeUndefined() // una placa con datos gana a una sin respuesta
    expect(u.nuevasPlacas).toBe(1)
    expect(u.perfil!.nombre).toBe('Otro vendedor') // el perfil de este dispositivo no se pisa
  })
})
