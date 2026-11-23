import { describe, expect, it } from 'vitest'
import { analizar } from '../dominio/analizador'
import { extraerJson, investigarGoogle } from './investigador'

// Respuesta con la forma de la API de Gemini con «búsqueda de Google» (texto + groundingMetadata con las páginas usadas)
function respuestaGemini(texto: string, fuentes: { uri: string; title: string }[]) {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: texto }] }, groundingMetadata: { groundingChunks: fuentes.map((web) => ({ web })) } }],
  }), { status: 200 })
}

describe('investigación en Google (Gemini) — formato de respuesta', () => {
  const { vehiculo } = analizar('Chevrolet Aveo Family 1.5 2015')

  it('convierte el JSON de Gemini en hallazgos con fuente y opciones aplicables', async () => {
    const texto = '```json\n{"motor":"1.5 L","potencia":"83 HP","combustible":"Gasolina","transmision":"Manual","velocidades":"5","traccion":"Delantera","carroceria":"Sedán","puertas":4,"pasajeros":5,"equipamiento":["Dirección hidráulica","Aire acondicionado"],"datos_de_interes":["Consumo urbano aproximado de 40 km/galón"]}\n```'
    let pedido: RequestInit | undefined
    const r = await investigarGoogle(vehiculo, 'CLAVE', async (_url, init) => { pedido = init; return respuestaGemini(texto, [{ uri: 'https://www.chevrolet.com.ec/aveo', title: 'chevrolet.com.ec' }]) })
    expect((pedido!.headers as Record<string, string>)['x-goog-api-key']).toBe('CLAVE')
    expect(JSON.parse(pedido!.body as string).tools).toEqual([{ google_search: {} }])
    const h = (c: string) => r.hallazgos.find((x) => x.campo === c)
    expect(h('motor')?.opciones).toEqual(['1.5'])
    expect(h('transmision')?.valor).toBe('Manual de 5 velocidades')
    expect(h('puertas')?.opciones).toEqual(['4'])
    expect(h('equipamiento')?.opciones).toEqual(['Dirección hidráulica', 'Aire acondicionado'])
    expect(h('motor')?.fuente.url).toBe('https://www.chevrolet.com.ec/aveo')
    expect(r.avisos).toEqual([])
  })

  it('los datos no encontrados (null) no se agregan', async () => {
    const r = await investigarGoogle(vehiculo, 'K', async () => respuestaGemini('{"motor":null,"potencia":null,"combustible":"Gasolina"}', [{ uri: 'https://x.ec', title: 'x' }]))
    expect(r.hallazgos.map((x) => x.etiqueta)).toEqual(['Combustible'])
  })

  it('advierte si Google no indicó las páginas consultadas', async () => {
    const r = await investigarGoogle(vehiculo, 'K', async () => respuestaGemini('{"combustible":"Gasolina"}', []))
    expect(r.avisos[0]).toMatch(/verifica/)
  })

  it('clave inválida: mensaje claro', async () => {
    await expect(investigarGoogle(vehiculo, 'MALA', async () => new Response('{}', { status: 400 }))).rejects.toThrow(/clave de Google no es válida/)
  })

  it('si un modelo de Gemini no existe, prueba el siguiente', async () => {
    const urls: string[] = []
    const r = await investigarGoogle(vehiculo, 'K', async (url) => {
      urls.push(url)
      return urls.length === 1 ? new Response('', { status: 404 }) : respuestaGemini('{"combustible":"Gasolina"}', [{ uri: 'https://x.ec', title: 'x' }])
    })
    expect(urls[1]).toContain('gemini-flash-latest')
    expect(r.hallazgos.length).toBe(1)
  })

  it('extraerJson tolera texto alrededor', () => {
    expect(extraerJson('Aquí está: {"a":1} listo')).toEqual({ a: 1 })
    expect(extraerJson('sin json')).toBeNull()
  })
})
