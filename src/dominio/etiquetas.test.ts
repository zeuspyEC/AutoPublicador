import { describe, expect, it } from 'vitest'
import { analizar } from './analizador'
import { ETIQUETAS, migrar, motivoInvalida } from './etiquetas'
import { comentarios, descripciones, titulos } from './plantillas'
import { tieneNumeroLimpio } from './telefono'
import { BENEFICIOS_PREDETERMINADOS, VEHICULO_VACIO, type Perfil, type Vehiculo } from './tipos'

const perfil: Perfil = { nombre: 'Vendedor', telefono: '0987654321', estiloTelefono: 'puntos', horario: 'Todos los días' }
const bases = ['Chevrolet Corsa 1.4 2002 manual 3990', 'Kia Rio 2016', 'Toyota Hilux 2.5 2014 diésel 4x4 matrícula 2026 145000 km único dueño techo pantalla $28500'].map((t) => analizar(t).vehiculo)
const todo = (v: Vehiculo) => {
  const ctx = { v, perfil, beneficios: [...BENEFICIOS_PREDETERMINADOS, { id: 'z', texto: 'Escucho ofertas', activo: true }] }
  return { t: titulos(ctx), d: descripciones(ctx), c: comentarios(ctx) }
}
const CAMPOS = ETIQUETAS.map((e) => e.campo)

describe('etiquetas: se reflejan en todos los textos, marcadas o no (todas las combinaciones)', () => {
  for (const base of bases) for (const deuda of ['', '83.78']) for (let m = 0; m < 32; m++) {
    const v: Vehiculo = { ...base, deuda, mostrarDeuda: !!deuda, notas: 'precio negociable, buen estado, cero multas', etiquetas: ['Llantas nuevas'] }
    CAMPOS.forEach((c, i) => { v[c] = !!(m & (1 << i)) })
    it(`${base.modelo} ${deuda} ${CAMPOS.filter((c) => v[c]).join('+') || 'ninguna'}`, () => {
      const { t, d, c } = todo(v)
      for (const x of [...t, ...d, ...c]) {
        for (const e of ETIQUETAS) {
          if (!v[e.campo]) expect(x.texto, `${x.id} no debe decir ${e.nombre}`).not.toMatch(e.menciona)
          else if (e.sinMarcar) expect(x.texto, x.id).not.toMatch(e.sinMarcar.menciona)
        }
        expect(x.texto, x.id).not.toMatch(/undefined|null|NaN|\n{3,}| {2,}/)
        expect(tieneNumeroLimpio(x.texto), x.id).toBe(false)
      }
      for (const x of d) {
        for (const e of ETIQUETAS) {
          if (v[e.campo]) expect(x.texto, `${x.id} debe decir ${e.nombre}`).toMatch(e.menciona)
          else if (e.sinMarcar) expect(x.texto, x.id).toMatch(e.sinMarcar.menciona)
        }
        expect(x.texto, x.id).toMatch(/llantas nuevas/i)
        expect(x.texto, x.id).toContain('NO DAMOS FINANCIAMIENTO')
      }
      for (const x of t) expect([...x.texto].length, x.texto).toBeLessThanOrEqual(100)
      expect(new Set(d.map((x) => x.texto)).size).toBe(d.length)
      expect(t.some((x) => /LLANTAS NUEVAS/.test(x.texto))).toBe(true)
      expect(c.find((x) => x.id === 'destacados')!.texto).toMatch(/llantas nuevas/)
    })
  }
})

describe('etiquetas propias', () => {
  it('no se aceptan vacías, repetidas, de casillas existentes ni de formas de pago', () => {
    expect(motivoInvalida('Llantas nuevas', [])).toBe('')
    for (const x of ['', 'precio fijo', 'NEGOCIABLE', 'cero multas', 'Financiamiento propio', 'llantas nuevas']) expect(motivoInvalida(x, ['Llantas Nuevas']), x).not.toBe('')
  })
  it('al quitarla desaparece de todo', () => {
    const { t, d, c } = todo({ ...bases[0], etiquetas: [] })
    expect([...t, ...d, ...c].map((x) => x.texto).join()).not.toMatch(/llantas/i)
  })
})

describe('texto libre y datos anteriores', () => {
  it('«precio fijo», «no negociable» y «no recibo cambio» desmarcan', () => {
    expect(analizar('kia rio 2016 9500 precio fijo').vehiculo.negociable).toBe(false)
    expect(analizar('kia rio 2016 9500 no negociable').vehiculo.negociable).toBe(false)
    expect(analizar('kia rio 2016 9500 negociable no recibo cambio').vehiculo).toMatchObject({ negociable: true, recibeCambio: false })
    expect(analizar('kia rio 2016 9500').vehiculo).toMatchObject({ negociable: true, recibeCambio: true })
  })
  it('una publicación antigua toma lo habitual, salvo lo que se desmarcó a mano', () => {
    const { etiquetas: _, ...viejo } = { ...VEHICULO_VACIO, negociable: false, recibeCambio: false }
    expect(migrar(viejo, VEHICULO_VACIO, (c) => c === 'negociable')).toMatchObject({ negociable: false, recibeCambio: true, etiquetas: [] })
    expect(migrar({ ...VEHICULO_VACIO, recibeCambio: false }, VEHICULO_VACIO, () => false).recibeCambio).toBe(false)
  })
})
