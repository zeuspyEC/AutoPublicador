// Prueba contra Wikipedia real (necesita internet). Se ejecuta con: npm run test:integracion
import { describe, expect, it } from 'vitest'
import { analizar } from '../dominio/analizador'
import { investigarWikipedia } from './investigador'

const activa = process.env.INTEGRACION === '1'

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
})
