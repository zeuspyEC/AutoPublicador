import { describe, expect, it } from 'vitest'
import { analizar } from './analizador'
import { comentarios, descripciones, titulos } from './plantillas'
import { formatearTelefono, normalizarTelefono, telefonoValido, tieneNumeroLimpio } from './telefono'
import { BENEFICIOS_PREDETERMINADOS, type Perfil } from './tipos'

const perfil: Perfil = { nombre: 'Erick Costa', telefono: '0987654321', estiloTelefono: 'guiones', horario: 'Todos los días de 08:30 a 17:30' }

describe('teléfono a prueba de Facebook', () => {
  it('normaliza +593 y 593 al formato nacional', () => {
    expect(normalizarTelefono('+593 98 765 4321')).toBe('0987654321')
    expect(normalizarTelefono('593987654321')).toBe('0987654321')
    expect(normalizarTelefono('987654321')).toBe('0987654321')
  })
  it('valida celulares ecuatorianos', () => {
    expect(telefonoValido('0987654321')).toBe(true)
    expect(telefonoValido('022345678')).toBe(false)
  })
  it('ningún estilo deja el número limpio', () => {
    for (const e of ['guiones', 'puntos', 'diagonales', 'mixto', 'emoji'] as const) {
      const f = formatearTelefono('0987654321', e)
      expect(tieneNumeroLimpio(f), `${e}: ${f}`).toBe(false)
      expect(f.replace(/\D/g, '').replace(/️|⃣/g, '')).toContain('0987')
    }
    expect(formatearTelefono('0987654321', 'guiones')).toBe('0987--654--321')
    expect(formatearTelefono('0987654321', 'puntos')).toBe('0987.654.321')
    expect(formatearTelefono('0987654321', 'diagonales')).toBe('09/87/65/43/21')
  })
})

describe('analizador de texto libre (casos de las publicaciones de ejemplo)', () => {
  it('Peugeot 206 XT 1.6 2008 con techo y pantalla', () => {
    const { vehiculo: v } = analizar('Peugeot 206 XT 1.6 2008 procedencia argentina, techo corredizo, pantalla android, cámara de retro, aros. Matrícula 2025 cero multas. $4990 antes $5300 negociable, recibo carro o moto. A toda prueba')
    expect(v.marca).toBe('Peugeot')
    expect(v.modelo).toBe('206')
    expect(v.version).toBe('XT')
    expect(v.motor).toBe('1.6')
    expect(v.anio).toBe('2008')
    expect(v.procedencia).toBe('Argentina')
    expect(v.matricula).toBe('Al día 2025')
    expect(v.ceroMultas).toBe(true)
    expect(v.precio).toBe('4990')
    expect(v.precioAnterior).toBe('5300')
    expect(v.negociable && v.recibeCambio && v.aTodaPrueba).toBe(true)
    expect(v.equipamiento).toEqual(['Techo corredizo', 'Pantalla Android', 'Cámara de retro', 'Aros deportivos'])
  })
  it('Fiat Premio del año 92 (año de dos dígitos)', () => {
    const { vehiculo: v } = analizar('fiat premio del año 92 al dia toda prueba papeles al dia 2750')
    expect([v.marca, v.modelo, v.anio, v.matricula, v.precio]).toEqual(['Fiat', 'Premio', '1992', 'Al día', '2750'])
  })
  it('Renault Logan 1.6L 2012 manual', () => {
    const { vehiculo: v } = analizar('RENAULT LOGAN 1.6L 2012 AL DÍA MANUAL A TODA PRUEBA $5.990')
    expect([v.marca, v.modelo, v.motor, v.anio, v.transmision, v.precio]).toEqual(['Renault', 'Logan', '1.6', '2012', 'Manual', '5990'])
  })
  it('Chevrolet Vitara Clásico 3P DLX 1997 T/M A/A, ecuatoriano', () => {
    const { vehiculo: v } = analizar('Chevrolet Vitara clásico 3P DLX T/M A/A 1997 ecuatoriano matrícula al día 2025 cero multas 4990')
    expect([v.marca, v.modelo, v.anio, v.puertas, v.transmision, v.procedencia, v.matricula]).toEqual(
      ['Chevrolet', 'Vitara', '1997', '3', 'Manual', 'Ecuador', 'Al día 2025'])
    expect(v.version).toContain('DLX')
    expect(v.precio).toBe('4990') // precio sin símbolo, como se suele escribir
    expect(v.equipamiento).toContain('Aire acondicionado')
  })
  it('solo el modelo: «vitara 97» deduce la marca más común en Ecuador', () => {
    const { vehiculo: v } = analizar('vitara del 97 4x4 120 mil km')
    expect([v.marca, v.modelo, v.anio, v.traccion, v.kilometraje]).toEqual(['Chevrolet', 'Vitara', '1997', '4X4', '120000'])
  })
  it('kilometraje con puntos, automático y diésel', () => {
    const { vehiculo: v } = analizar('Toyota Hilux 2.5 2014 diesel automática 4x4 145.000 km 28500 dólares')
    expect([v.modelo, v.motor, v.anio, v.combustible, v.transmision, v.kilometraje, v.precio]).toEqual(
      ['Hilux', '2.5', '2014', 'Diésel', 'Automática', '145000', '28500'])
  })
  it('precio sin símbolo: no confunde el año, la matrícula, los km ni el motor', () => {
    expect(analizar('kia rio 2016 1.4 85000 km matrícula 2025 11500').vehiculo.precio).toBe('11500')
    expect(analizar('nissan sentra 2010 negociable').vehiculo.precio).toBe('')
    expect(analizar('suzuki forsa del 92 2.750').vehiculo.precio).toBe('2750')
  })
  it('informa los datos importantes que faltan', () => {
    const { faltantes } = analizar('kia rio')
    expect(faltantes).toEqual(['anio', 'motor', 'transmision', 'precio'])
  })
  it('no confunde palabras comunes con modelos sin marca', () => {
    const { vehiculo: v } = analizar('uno de los mejores, premio al mejor precio')
    expect(v.marca).toBe('')
  })
})

describe('plantillas', () => {
  const { vehiculo } = analizar('Peugeot 206 XT 1.6 2008 procedencia argentina techo pantalla cámara aros matrícula 2025 cero multas $4990 negociable a toda prueba')
  const ctx = { v: vehiculo, perfil, beneficios: BENEFICIOS_PREDETERMINADOS }

  it('genera varios títulos distintos con los datos del vehículo', () => {
    const t = titulos(ctx)
    expect(t.length).toBeGreaterThanOrEqual(6)
    expect(new Set(t.map((x) => x.texto)).size).toBe(t.length)
    expect(t[0].texto).toBe('VENDO//CAMBIO 🔥 PEUGEOT 206 1.6L 2008 AL DÍA 2025 ✅ A TODA PRUEBA 💯')
    expect(t[1].texto).toBe('🔥 PEUGEOT 206 XT 1.6L / TECHO + PANTALLA 🚗')
    for (const x of t) expect(x.texto).not.toMatch(/\s{2,}|undefined|null/)
  })
  it('las descripciones llevan nombre, ubicación y el teléfono nunca limpio', () => {
    for (const d of descripciones(ctx)) {
      expect(d.texto, d.id).toContain('0987--654--321')
      expect(tieneNumeroLimpio(d.texto), d.id).toBe(false)
      expect(d.texto, d.id).toMatch(/Erick Costa|ERICK COSTA/)
      expect(d.texto, d.id).toMatch(/Inca|INCA/)
      expect(d.texto, d.id).not.toMatch(/undefined|null|\n{3,}/)
    }
  })
  it('no inventa: sin kilometraje ni color, no aparecen esas líneas', () => {
    const d = descripciones(ctx).find((x) => x.id === 'completa')!.texto
    expect(d).not.toContain('Kilometraje')
    expect(d).not.toContain('Color')
    expect(d).toContain('✅ Año: 2008 (Procedencia Argentina)')
    expect(d).toContain('✅ Matrícula: Al día 2025 (Cero multas)')
  })
  it('redacción: versión en mayúsculas, nombres propios y sin repetir el motor', () => {
    const t = titulos(ctx).find((x) => x.id === 'oportunidad')!.texto
    expect(t).toContain('Peugeot 206 XT del año 08')
    const completa = descripciones(ctx).find((x) => x.id === 'completa')!.texto
    expect(completa).toContain('con techo corredizo y pantalla Android')
    expect(completa).toContain('✅ Marca/Modelo: Peugeot 206 XT 1.6L')
    expect(completa).not.toContain('✅ Motor:') // sin combustible, el motor ya está en Marca/Modelo
    const contacto = descripciones(ctx).find((x) => x.id === 'contacto-primero')!.texto
    expect(contacto).toContain('⏰ Horario de atención: Todos los días de 08:30 a 17:30.')
    const conDiesel = descripciones({ ...ctx, v: { ...vehiculo, combustible: 'Diésel' } }).find((x) => x.id === 'completa')!.texto
    expect(conDiesel).toContain('✅ Motor: 1.6L Diésel')
  })
  it('sin horario configurado no se escribe la línea de horario', () => {
    const d = descripciones({ ...ctx, perfil: { ...perfil, horario: '' } })
    for (const x of d) expect(x.texto).not.toMatch(/HORARIO|Atiendo|ATENDEMOS/)
  })
})

describe('corrección de errores de tipeo y valores de carrocería', () => {
  it('«Mazda Alegro» se corrige a «Allegro» y lo informa', () => {
    const a = analizar('mazda alegro 1.6 2004 manual 4490')
    expect(a.vehiculo.modelo).toBe('Allegro')
    expect(a.correcciones).toEqual(['«alegro» se corrigió a «Allegro»'])
  })
  it('no «corrige» modelos que no se parecen a ninguno', () => {
    const a = analizar('mazda tribute 2008')
    expect(a.vehiculo.modelo).toBe('Tribute')
    expect(a.correcciones).toEqual([])
  })
  it('carrocería con números en letras', async () => {
    const { valorParaCampo } = await import('../componentes/PanelInvestigacion')
    expect(valorParaCampo('carroceria', 'Hatchback tres y cinco puertas')).toBe('Hatchback')
    expect(valorParaCampo('carroceria', 'Sedán 4 puertas')).toBe('Sedán')
    expect(valorParaCampo('carroceria', 'Familiar de cinco puertas')).toBe('Familiar')
  })
})

describe('más variaciones: descripciones, títulos condicionales y comentarios', () => {
  const perfilT: Perfil = { nombre: 'Erick Costa', telefono: '0987654321', estiloTelefono: 'puntos', horario: 'Todos los días de 08:30 a 17:30' }
  const base = analizar('Toyota Hilux 2.5 2014 diésel 4x4 cabina doble 145.000 km, único dueño, matrícula 2025, $28500 negociable, recibo carro o moto').vehiculo
  const ctx = { v: { ...base, carroceria: 'Camioneta' }, perfil: perfilT, beneficios: BENEFICIOS_PREDETERMINADOS }

  it('12 descripciones distintas, todas con contacto, sin número limpio ni huecos', () => {
    const d = descripciones(ctx)
    expect(d.length).toBe(12)
    expect(new Set(d.map((x) => x.texto)).size).toBe(12)
    for (const x of d) {
      expect(x.texto, x.id).toContain('0987.654.321')
      expect(tieneNumeroLimpio(x.texto), x.id).toBe(false)
      expect(x.texto, x.id).not.toMatch(/undefined|null|NaN|\n{3,}| {2,}/)
    }
    expect(d.find((x) => x.id === 'ficha-emoji')!.texto).toContain('🛣️ Kilometraje: 145.000 km')
  })
  it('títulos condicionales solo cuando hay datos que los sostienen', () => {
    const ids = titulos(ctx).map((t) => t.id)
    expect(ids).toEqual(expect.arrayContaining(['kilometraje', 'unico-dueno', 'cambio-moto', 'familia', 'remate']))
    const sinDatos = titulos({ ...ctx, v: analizar('Kia Rio 2016').vehiculo }).map((t) => t.id)
    expect(sinDatos).not.toEqual(expect.arrayContaining(['kilometraje']))
    expect(sinDatos).not.toContain('unico-dueno')
    expect(sinDatos).not.toContain('remate')
    for (const t of titulos(ctx)) expect(t.texto, t.id).not.toMatch(/\s{2,}|undefined/)
  })
  it('comentarios y respuestas rápidas', () => {
    const c = comentarios(ctx)
    expect(c.length).toBeGreaterThanOrEqual(6)
    expect(c.find((x) => x.id === 'precio')!.texto).toContain('$28.500')
    expect(c.find((x) => x.id === 'horario')!.texto).toContain('Atendemos todos los días de 08:30 a 17:30')
    for (const x of c) expect(tieneNumeroLimpio(x.texto), x.id).toBe(false)
  })
})

describe('fusión: la placa (SRI) manda sobre el texto', () => {
  it('caso real del usuario: texto «Chevrolet Corsa 2002» + placa registrada como Chevytaxi 2010', async () => {
    const { fusionar } = await import('./fusion')
    const { interpretarSri } = await import('../servicios/placa')
    const a = analizar('CHEVROLET CORSA 5P A/C 1.4L 2002 10549')
    const sri = interpretarSri('YAA0208', { codigoVehiculo: 1, descripcionMarca: 'CHEVROLET', descripcionModelo: 'CHEVYTAXI A/C', anioAuto: 2010, descripcionPais: 'ECUADOR', ultimoAnioPagado: 2026 }, [])
    const f = fusionar(a.vehiculo, a.origenes, sri, 'sri')
    expect(f.vehiculo.modelo).toBe('Chevytaxi')
    expect(f.vehiculo.anio).toBe('2010')
    expect(f.vehiculo.matricula).toBe('Al día 2026')
    expect(f.vehiculo.precio).toBe('10549') // el precio sí viene del texto
    expect(f.origenes.modelo).toBe('sri')
    expect(f.diferencias.map((d) => `${d.campo}:${d.anterior}→${d.oficial}`)).toEqual(['modelo:Corsa→Chevytaxi', 'anio:2002→2010'])
  })
  it('lo corregido a mano no se pisa', async () => {
    const { fusionar } = await import('./fusion')
    const { interpretarSri } = await import('../servicios/placa')
    const a = analizar('chevrolet aveo 2010')
    const f = fusionar({ ...a.vehiculo, anio: '2011' }, { ...a.origenes, anio: 'manual' }, interpretarSri('PBA1234', { codigoVehiculo: 1, descripcionMarca: 'CHEVROLET', descripcionModelo: 'AVEO', anioAuto: 2010 }, []), 'sri')
    expect(f.vehiculo.anio).toBe('2011')
  })
  it('las fuentes de referencia solo completan campos vacíos', async () => {
    const { fusionar } = await import('./fusion')
    const a = analizar('peugeot 206 2008 manual')
    const r = { resumen: '', avisos: [], fuentes: [], hallazgos: [
      { campo: 'transmision' as const, etiqueta: 'T', valor: 'Automática', opciones: ['Automática'], fuente: { nombre: 'x', url: 'https://es.wikipedia.org' } },
      { campo: 'traccion' as const, etiqueta: 'T', valor: 'Delantera', opciones: ['Delantera'], fuente: { nombre: 'x', url: 'https://es.wikipedia.org' } }] }
    const f = fusionar(a.vehiculo, a.origenes, r, 'wikipedia')
    expect(f.vehiculo.transmision).toBe('Manual')
    expect(f.vehiculo.traccion).toBe('Delantera')
    expect(f.diferencias).toEqual([])
  })
})
