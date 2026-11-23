import { beforeEach, describe, expect, it } from 'vitest'
import { analizar } from '../dominio/analizador'
import { diagnosticar, extraerJson, interpretarError, investigarGoogle, olvidarModelos, ordenarModelos } from './google'

// Simulador de la API de Gemini: lista de modelos + generateContent con reglas por modelo y por uso de búsqueda
type Regla = (modelo: string, conBusqueda: boolean) => Response
function servidor(modelos: string[], regla: Regla, llamadas: string[] = []) {
  return async (url: string, init?: RequestInit) => {
    if (url.includes('/models?')) return new Response(JSON.stringify({ models: modelos.map((n) => ({ name: `models/${n}`, supportedGenerationMethods: ['generateContent'] })) }))
    const modelo = url.match(/models\/([^:]+):generateContent/)![1]
    const conBusqueda = !!JSON.parse(init!.body as string).tools
    llamadas.push(`${modelo}${conBusqueda ? '+busqueda' : ''}`)
    return regla(modelo, conBusqueda)
  }
}
const ok = (texto: string, fuentes: { uri: string; title: string }[] = []) => new Response(JSON.stringify({
  candidates: [{ content: { parts: [{ text: texto }] }, groundingMetadata: { groundingChunks: fuentes.map((web) => ({ web })) } }],
}))
const err = (estado: number, cuerpo: object) => new Response(JSON.stringify({ error: cuerpo }), { status: estado })
const CUOTA = { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'You exceeded your current quota, please check your plan and billing details.',
  details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '37s' }] }
const JSON_AVEO = '```json\n{"motor":"1.5 L","potencia":"83 HP","combustible":"Gasolina","transmision":"Manual","velocidades":"5","traccion":"Delantera","carroceria":"Sedán","puertas":4,"pasajeros":5,"equipamiento":["Dirección hidráulica","Aire acondicionado"],"datos_de_interes":["Repuestos económicos"]}\n```'

describe('Google (Gemini): modelos, errores y respaldo', () => {
  const { vehiculo } = analizar('Chevrolet Aveo Family 1.5 2015')
  beforeEach(() => olvidarModelos())

  it('ordena los modelos: flash reciente, flash-lite, latest y descarta los que no son de texto', () => {
    expect(ordenarModelos(['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest',
      'text-embedding-004', 'gemini-2.5-flash-image', 'gemini-2.5-flash-preview-tts']))
      .toEqual(['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'])
  })

  it('con búsqueda: convierte el JSON en hallazgos con la página consultada', async () => {
    const llamadas: string[] = []
    const r = await investigarGoogle(vehiculo, 'K', servidor(['gemini-2.5-flash'], () => ok(JSON_AVEO, [{ uri: 'https://www.chevrolet.com.ec/aveo', title: 'chevrolet.com.ec' }]), llamadas))
    expect(llamadas).toEqual(['gemini-2.5-flash+busqueda'])
    const h = (c: string) => r.hallazgos.find((x) => x.campo === c)
    expect(h('motor')?.opciones).toEqual(['1.5'])
    expect(h('transmision')?.valor).toBe('Manual de 5 velocidades')
    expect(h('motor')?.fuente.url).toBe('https://www.chevrolet.com.ec/aveo')
    expect(r.avisos).toEqual([])
  })

  it('cuota agotada con búsqueda (429, caso real del usuario): prueba otros modelos y luego sin búsqueda, marcado para verificar', async () => {
    const llamadas: string[] = []
    const r = await investigarGoogle(vehiculo, 'K', servidor(['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
      (_m, busqueda) => (busqueda ? err(429, CUOTA) : ok(JSON_AVEO)), llamadas))
    expect(llamadas).toEqual(['gemini-2.5-flash+busqueda', 'gemini-2.5-flash-lite+busqueda', 'gemini-2.5-flash'])
    expect(r.hallazgos.find((x) => x.campo === 'motor')?.fuente.nombre).toMatch(/sin búsqueda.*verificar/)
    expect(r.avisos[0]).toMatch(/no permitió buscar en la web/)
  })

  it('cuota agotada en todo: explica el motivo y cuándo se libera', async () => {
    await expect(investigarGoogle(vehiculo, 'K', servidor(['gemini-2.5-flash'], () => err(429, CUOTA))))
      .rejects.toThrow('Tu proyecto de Google no tiene cuota disponible para este uso (se libera en 37s).')
  })

  it('clave inválida: se detiene enseguida con un mensaje claro', async () => {
    const pedir = async () => err(400, { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.', details: [{ reason: 'API_KEY_INVALID' }] })
    await expect(investigarGoogle(vehiculo, 'MALA', pedir)).rejects.toThrow(/La clave no es válida/)
  })

  it('modelo inexistente (404): pasa al siguiente', async () => {
    const llamadas: string[] = []
    const r = await investigarGoogle(vehiculo, 'K', servidor(['gemini-2.5-flash', 'gemini-2.0-flash'],
      (m) => (m === 'gemini-2.5-flash' ? err(404, { code: 404, status: 'NOT_FOUND', message: 'models/gemini-2.5-flash is not found' }) : ok(JSON_AVEO, [{ uri: 'https://x.ec', title: 'x' }])), llamadas))
    expect(llamadas[1]).toBe('gemini-2.0-flash+busqueda')
    expect(r.hallazgos.length).toBeGreaterThan(3)
  })

  it('los datos no encontrados (null) no se agregan', async () => {
    const r = await investigarGoogle(vehiculo, 'K', servidor(['gemini-2.5-flash'], () => ok('{"motor":null,"potencia":null,"combustible":"Gasolina"}', [{ uri: 'https://x.ec', title: 'x' }])))
    expect(r.hallazgos.map((x) => x.etiqueta)).toEqual(['Combustible'])
  })

  it('diagnóstico: distingue «con búsqueda», «solo sin búsqueda» y clave mala', async () => {
    const conTodo = await diagnosticar('K', servidor(['gemini-2.5-flash'], () => ok('OK')))
    expect(conTodo.conclusion).toMatch(/funciona con búsqueda/)
    const sinBusqueda = await diagnosticar('K', servidor(['gemini-2.5-flash'], (_m, b) => (b ? err(429, CUOTA) : ok('OK'))))
    expect(sinBusqueda.ok).toBe(true)
    expect(sinBusqueda.conclusion).toMatch(/no permite la búsqueda/)
    const mala = await diagnosticar('M', async () => err(400, { message: 'API key not valid.', details: [{ reason: 'API_KEY_INVALID' }] }))
    expect(mala.ok).toBe(false)
    expect(mala.conclusion).toMatch(/no es válida/)
  })

  it('interpreta errores reales de Google', () => {
    expect(interpretarError(403, JSON.stringify({ error: { status: 'PERMISSION_DENIED', message: 'Generative Language API has not been used' } })).tipo).toBe('permiso')
    expect(interpretarError(503, 'overloaded').tipo).toBe('ocupado')
  })

  it('extraerJson tolera texto alrededor', () => {
    expect(extraerJson('Aquí está: {"a":1} listo')).toEqual({ a: 1 })
    expect(extraerJson('sin json')).toBeNull()
  })
})
