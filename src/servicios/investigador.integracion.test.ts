// Prueba contra Wikipedia real (necesita internet). Se ejecuta con: npm run test:integracion (vitest --mode integracion)
import { describe, expect, it } from 'vitest'
import { analizar } from '../dominio/analizador'
import { investigarWikipedia } from './investigador'

const activa = import.meta.env.MODE === 'integracion'

describe.runIf(activa)('investigación real en Wikipedia', () => {
  it('Peugeot 206 XT 1.6 2008: carrocería, tracción, transmisión y motores con fuente', async () => {
    const { vehiculo } = analizar('Peugeot 206 XT 1.6 2008')
    const r = await investigarWikipedia(vehiculo)
    const campo = (c: string) => r.hallazgos.find((h) => h.campo === c)
    expect(r.fuentes[0].url).toContain('wikipedia.org/wiki/Peugeot_206')
    expect(campo('carroceria')?.opciones?.length).toBeGreaterThan(0)
    expect(campo('traccion')?.opciones).toContain('Delantera')
    expect(campo('transmision')?.opciones).toEqual(['Manual', 'Automática'])
    expect(campo('motor')?.opciones).toContain('1.6')
    expect(r.avisos).toEqual([])
    expect(r.resumen).toMatch(/Peugeot 206/)
  }, 30000)

  it('avisa cuando el año queda fuera de la producción', async () => {
    const { vehiculo } = analizar('Peugeot 206 1.6 1990')
    const r = await investigarWikipedia(vehiculo)
    expect(r.avisos.join(' ')).toMatch(/Revisa el año: 1990/)
  }, 30000)

  it('Chevrolet Vitara: encuentra el artículo aunque se llame Suzuki Vitara', async () => {
    const { vehiculo } = analizar('Chevrolet Vitara 3P 1997')
    const r = await investigarWikipedia(vehiculo)
    expect(r.fuentes.length).toBeGreaterThan(0)
    expect(r.hallazgos.find((h) => h.campo === 'traccion')?.opciones).toContain('4x4')
  }, 30000)
  it('Mazda Alegro (mal escrito, nombre de Ecuador): encuentra el Mazda 323', async () => {
    const { vehiculo } = analizar('mazda alegro 1.6 2004')
    const r = await investigarWikipedia(vehiculo)
    expect(r.fuentes[0]?.url).toContain('Mazda_323')
    expect(r.avisos[0]).toMatch(/internacionalmente como Mazda 323/)
  }, 30000)
  it('Suzuki Forsa 1989 (así lo registra el SRI): artículo del Suzuki Cultus de esa época, no el Cultus Crescent 1995-2007', async () => {
    const { vehiculo } = analizar('Suzuki Forsa 1989')
    const r = await investigarWikipedia(vehiculo)
    expect(r.fuentes.map((f) => f.nombre).join(' ')).not.toMatch(/Crescent|Baleno/)
    expect(r.fuentes.some((f) => /Suzuki Cultus/.test(f.nombre))).toBe(true)
    expect(r.avisos.join(' ')).not.toMatch(/Revisa el año/)
    expect(r.hallazgos.find((h) => h.etiqueta === 'Período de producción')?.valor).toMatch(/1983/)
  }, 30000)
  it('Chevrolet Chevytaxi 2010 (SRI): datos del Chevrolet Aveo', async () => {
    const { vehiculo } = analizar('Chevrolet Chevytaxi 2010')
    const r = await investigarWikipedia(vehiculo)
    expect(r.fuentes[0]?.url).toContain('Chevrolet_Aveo')
  }, 30000)
  it('Nissan Infinity 1999 (así lo registra el SRI): no toma el artículo matemático «Infinity»', async () => {
    const r = await investigarWikipedia(analizar('Nissan Infinity 1999').vehiculo)
    expect(r.fuentes.map((f) => f.nombre).join(' ')).not.toMatch(/: Infinity$/)
    expect(r.hallazgos).toEqual([])
  }, 30000)
  it('Chevrolet Corsa Evolution 4P (SRI): con 4 puertas la carrocería es Sedán', async () => {
    const r = await investigarWikipedia({ ...analizar('Chevrolet Corsa Evolution 2004').vehiculo, puertas: '4' })
    expect(r.hallazgos.find((h) => h.campo === 'carroceria')?.opciones).toEqual(['Sedán cuatro puertas'])
  }, 30000)
})
