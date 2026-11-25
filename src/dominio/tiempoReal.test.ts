import { describe, expect, it } from 'vitest'
import { analizar } from './analizador'
import { comentarios, descripciones, publicacionVigente, titulos } from './plantillas'
import { aplicarCambios, SELECCION_VACIA } from './retoques'
import { BENEFICIOS_PREDETERMINADOS, VEHICULO_VACIO, type Perfil, type Vehiculo } from './tipos'

const perfil: Perfil = { nombre: 'Yyy', telefono: '0987654321', estiloTelefono: 'puntos', horario: 'Hhh' }
const v: Vehiculo = { ...VEHICULO_VACIO, marca: 'Zzmarca', modelo: 'Zzmodelo', version: 'Zzver', anio: '2011', motor: '7.7', transmision: 'Automática', combustible: 'Zzcomb', kilometraje: '123456', color: 'Zzcolor', carroceria: 'Zzcarro', traccion: 'Zztrac', puertas: '9', precio: '34567', precioAnterior: '45678', matricula: 'Zzmat', procedencia: 'Zzproc', equipamiento: ['Zzequipo', 'Zzradio', 'Zzaros'], notas: 'Zznota' }
const R: Partial<Record<keyof Vehiculo, RegExp>> = { marca: /zzmarca/i, modelo: /zzmodelo/i, version: /zzver/i, anio: /2011|\b11\b/, motor: /7\.7/, transmision: /autom|a\/t/i, combustible: /zzcomb/i, kilometraje: /123\.456/, color: /zzcolor/i, carroceria: /zzcarro/i, traccion: /zztrac/i, puertas: /9 puertas|puertas: 9/i, precio: /34\.567/, precioAnterior: /45\.678/, matricula: /zzmat|papeles al d/i, procedencia: /zzproc/i, equipamiento: /zzequipo/i, notas: /zznota/i }
const c = (x: Vehiculo, p = perfil, beneficios = BENEFICIOS_PREDETERMINADOS) => ({ v: x, perfil: p, beneficios })

describe('cada dato se refleja al ponerlo y al quitarlo', () => {
  for (const [k, re] of Object.entries(R)) it(k, () => {
    for (const d of descripciones(c(v))) {
      const corta = d.id === 'corta' || d.id === 'minima'
      if (!corta || k === 'precio') expect(d.texto, d.id).toMatch(re)
    }
    const sin = { ...v, [k]: k === 'equipamiento' ? [] : '' }
    for (const x of [...descripciones(c(sin)), ...titulos(c(sin)), ...comentarios(c(sin))]) expect(x.texto, x.id).not.toMatch(re)
  })
  it('perfil, ubicación y beneficios', () => {
    const p2 = { ...perfil, nombre: 'Otro Nombre', telefono: '0991112233', horario: 'Lunes' }
    for (const d of descripciones({ ...c(v, p2), ubicacion: 'Carapungo' })) { expect(d.texto).not.toMatch(/Yyy|0987|Hhh|Inca/i); expect(d.texto).toContain('0991.112.233') }
    for (const x of [...titulos(c(v, p2)), ...comentarios(c(v, p2))]) expect(x.texto).not.toMatch(/0987/)
    const todo = (b: typeof BENEFICIOS_PREDETERMINADOS) => [...titulos(c(v, perfil, b)), ...descripciones(c(v, perfil, b)), ...comentarios(c(v, perfil, b))].map((x) => x.texto).join('\n')
    for (const [id, re] of [['mecanico', /mec[aá]nico de confianza/i], ['garantia', /garant[ií]a/i], ['entrega', /entrega inmediata/i], ['notaria', /notar[ií]a/i]] as const) {
      expect(todo(BENEFICIOS_PREDETERMINADOS)).toMatch(re)
      expect(todo(BENEFICIOS_PREDETERMINADOS.map((b) => (b.id === id ? { ...b, activo: false } : b))), id).not.toMatch(re)
    }
  })
})

describe('un retoque en cualquier línea no deja datos viejos', () => {
  const a = { ...analizar('Chevrolet Corsa 1.4 2002 manual rojo 3990 negociable techo').vehiculo }
  const cambios: [string, Vehiculo, Perfil][] = [['teléfono y nombre', a, { ...perfil, nombre: 'Otra Persona', telefono: '0991112233' }], ['precio', { ...a, precio: '4100' }, perfil], ['color', { ...a, color: '' }, perfil], ['negociable', { ...a, negociable: false }, perfil], ['cambio', { ...a, recibeCambio: false }, perfil], ['modelo', { ...a, modelo: 'Vitara' }, perfil], ['equipo', { ...a, equipamiento: [] }, perfil]]
  for (const [n, v2, p2] of cambios) it(n, () => {
    for (const d of descripciones(c(a))) {
      const nuevo = descripciones(c(v2, p2)).find((x) => x.id === d.id)!.texto
      const palabras = new Set(nuevo.split(/\s+/)), viejas = [...new Set(d.texto.split(/\s+/))].filter((x) => !palabras.has(x) && /\w/.test(x))
      d.texto.split('\n').forEach((l, i, ls) => {
        if (!l) return
        const texto = ls.map((x, j) => (j === i ? x + ' QQQ' : x)).join('\n')
        const r = publicacionVigente(c(v2, p2), { ...SELECCION_VACIA, descId: d.id, retoques: { [`d:${d.id}`]: { base: d.texto, texto } } }).descripcion.split(/\s+/)
        for (const w of viejas) expect(r, `${d.id} línea ${i}: queda «${w}»`).not.toContain(w)
        for (const w of palabras) if (w) expect(r, `${d.id} línea ${i}: falta «${w}»`).toContain(w)
      })
    }
  })
})

describe('los retoques a mano sobreviven a los cambios', () => {
  it('por líneas: cambia, quita y agrega sin perder lo escrito', () => {
    const base = 'uno\nprecio 10\nnegociable\nfin'
    const r = { base, texto: 'uno\nMI LÍNEA\nprecio 10\nnegociable\nfin!' }
    expect(aplicarCambios(r, 'uno\nprecio 20\nnegociable\nfin')).toBe('uno\nMI LÍNEA\nprecio 20\nnegociable\nfin!')
    expect(aplicarCambios(r, 'uno\nprecio 10\nfin')).toBe('uno\nMI LÍNEA\nprecio 10\nfin!')
    expect(aplicarCambios(r, 'uno\nprecio 10\nnegociable\ncero multas\nfin')).toContain('cero multas')
    expect(aplicarCambios({ base, texto: 'uno\nprecio 10 de remate\nnegociable\nfin' }, 'uno\nprecio 20\nnegociable\nfin')).toContain('precio 20')
    expect(aplicarCambios({ base, texto: 'uno\nprecio 10\nfin' }, 'uno\nprecio 10\nconversable\nfin')).toBe('uno\nprecio 10\nfin') // lo borrado se respeta
  })
  it('en todas las plantillas: cambiar precio y quitar negociable con un retoque puesto', () => {
    const a = { ...analizar('Chevrolet Corsa 1.4 2002 manual 3990').vehiculo }
    for (const d of descripciones(c(a))) {
      const s = { ...SELECCION_VACIA, descId: d.id, retoques: { [`d:${d.id}`]: { base: d.texto, texto: d.texto + '\n*** mi frase ***' } } }
      const r = publicacionVigente(c({ ...a, negociable: false, precio: '4100' }), s).descripcion
      expect(r, d.id).toContain('*** mi frase ***')
      expect(r, d.id).toContain('$4.100'); expect(r, d.id).not.toContain('3.990')
      expect(r, d.id).not.toMatch(/negociable|conversable/i); expect(r, d.id).toMatch(/precio fijo/i)
    }
    const t = titulos(c(a))[0]
    const s = { ...SELECCION_VACIA, tituloId: t.id, retoques: { [`t:${t.id}`]: { base: t.texto, texto: 'LINDO ' + t.texto } } }
    const r = publicacionVigente(c({ ...a, recibeCambio: false, anio: '2003' }), s).titulo
    expect(r).toContain('LINDO'); expect(r).toContain('2003'); expect(r).not.toMatch(/CAMBIO/)
  })
})
