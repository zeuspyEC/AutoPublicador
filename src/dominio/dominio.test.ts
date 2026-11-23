import { describe, expect, it } from 'vitest'
import { analizar } from './analizador'
import { descripciones, titulos } from './plantillas'
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
