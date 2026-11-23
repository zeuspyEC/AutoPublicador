// Consulta a Google mediante la API de Gemini (clave gratuita de Google AI Studio).
// 1) Descubre qué modelos permite la clave (no se fija un modelo que mañana puede desaparecer).
// 2) Intenta con «búsqueda de Google» (datos de la web con las páginas consultadas).
// 3) Si el plan no permite la búsqueda (cuota 0 en proyectos gratuitos), usa un modelo sin búsqueda y lo marca
//    para verificar. 4) Los errores de Google se explican en español con el motivo real.
import type { Vehiculo } from '../dominio/tipos'
import type { Fuente, Investigacion } from './investigador'

type Pedir = (url: string, init?: RequestInit) => Promise<Response>
const API = 'https://generativelanguage.googleapis.com/v1beta'
const RESPALDO = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.0-flash']

export type TipoErrorGoogle = 'clave' | 'permiso' | 'cuota' | 'modelo' | 'busqueda' | 'ocupado' | 'red' | 'otro'

export class ErrorGoogle extends Error {
  codigo: number
  tipo: TipoErrorGoogle
  detalle: string
  constructor(codigo: number, tipo: TipoErrorGoogle, mensaje: string, detalle = '') {
    super(mensaje)
    this.codigo = codigo
    this.tipo = tipo
    this.detalle = detalle
  }
}

/** Convierte la respuesta de error de Google en un motivo claro (y si conviene probar otro modelo). */
export function interpretarError(estado: number, cuerpo: string): ErrorGoogle {
  let e: { message?: string; status?: string; details?: { reason?: string; retryDelay?: string; violations?: { quotaId?: string; quotaMetric?: string }[] }[] } = {}
  try { e = JSON.parse(cuerpo)?.error ?? {} } catch { /* cuerpo no JSON */ }
  const mensaje = e.message ?? cuerpo.slice(0, 200)
  const razon = e.details?.find((d) => d.reason)?.reason ?? ''
  const espera = e.details?.find((d) => d.retryDelay)?.retryDelay
  const cuota = e.details?.flatMap((d) => d.violations ?? []).map((v) => v.quotaId ?? v.quotaMetric).filter(Boolean)[0]
  if (razon === 'API_KEY_INVALID' || /api key not valid/i.test(mensaje))
    return new ErrorGoogle(estado, 'clave', 'La clave no es válida. Cópiala de nuevo desde aistudio.google.com/api-keys y pégala en Ajustes.', mensaje)
  if (estado === 429 || e.status === 'RESOURCE_EXHAUSTED')
    return new ErrorGoogle(estado, 'cuota', `Tu proyecto de Google no tiene cuota disponible para este uso${espera ? ` (se libera en ${espera})` : ''}.`, `${mensaje}${cuota ? ` [${cuota}]` : ''}`)
  if (estado === 404 || /not found|is not supported for generateContent/i.test(mensaje))
    return new ErrorGoogle(estado, 'modelo', 'Ese modelo no está disponible para tu clave.', mensaje)
  if (/search|grounding|tool/i.test(mensaje) && estado === 400)
    return new ErrorGoogle(estado, 'busqueda', 'Tu plan no permite la búsqueda de Google con este modelo.', mensaje)
  if (estado === 403 || e.status === 'PERMISSION_DENIED')
    return new ErrorGoogle(estado, 'permiso', 'La clave no tiene permiso para usar Gemini (API desactivada o clave restringida).', mensaje)
  if (estado >= 500) return new ErrorGoogle(estado, 'ocupado', 'Google está ocupado en este momento. Intenta de nuevo en un minuto.', mensaje)
  return new ErrorGoogle(estado, 'otro', `Google respondió ${estado}.`, mensaje)
}

/** Ordena los modelos de texto: flash recientes primero, luego flash-lite, alias «latest» y al final pro. */
export function ordenarModelos(nombres: string[]): string[] {
  const version = (n: string) => +(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0)
  const grupo = (n: string) => (/flash-lite/.test(n) ? 1 : /flash/.test(n) ? 0 : /pro/.test(n) ? 3 : 4) + (/latest/.test(n) ? 0.5 : 0)
  return [...new Set(nombres)]
    .filter((n) => /^gemini-/.test(n) && !/(embedding|image|tts|audio|live|vision|aqa|thinking|computer|robotics|learnlm|native|exp)/.test(n))
    .sort((a, b) => grupo(a) - grupo(b) || version(b) - version(a) || (/preview/.test(a) ? 1 : 0) - (/preview/.test(b) ? 1 : 0))
}

const cacheModelos = new Map<string, string[]>()
/** Olvida los modelos guardados (al cambiar la clave o en pruebas). */
export function olvidarModelos() { cacheModelos.clear() }

/** Modelos de texto que acepta la clave (lista real de Google; si no se puede leer, una lista de respaldo). */
export async function modelosDisponibles(clave: string, pedir: Pedir = fetch): Promise<string[]> {
  const guardados = cacheModelos.get(clave)
  if (guardados) return guardados
  const r = await pedir(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': clave } }).catch(() => null)
  if (!r) throw new ErrorGoogle(0, 'red', 'No hay conexión con Google. Revisa tu internet.')
  if (!r.ok) {
    const e = interpretarError(r.status, await r.text().catch(() => ''))
    if (e.tipo === 'clave' || e.tipo === 'permiso') throw e
    return RESPALDO
  }
  const data = await r.json()
  const nombres = (data?.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m: { name: string }) => m.name.replace(/^models\//, ''))
  const orden = ordenarModelos(nombres)
  const lista = orden.length ? orden : RESPALDO
  cacheModelos.set(clave, lista)
  return lista
}

async function generar(pedir: Pedir, clave: string, modelo: string, texto: string, conBusqueda: boolean) {
  const r = await pedir(`${API}/models/${modelo}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
    body: JSON.stringify({
      contents: [{ parts: [{ text: texto }] }],
      ...(conBusqueda ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: { temperature: 0 },
    }),
  }).catch(() => null)
  if (!r) throw new ErrorGoogle(0, 'red', 'No hay conexión con Google. Revisa tu internet.')
  if (!r.ok) throw interpretarError(r.status, await r.text().catch(() => ''))
  return r.json()
}

function promptFicha(v: Vehiculo, conBusqueda: boolean): string {
  const datos = [v.marca, v.modelo, v.version, v.anio, v.motor && `${v.motor}L`, v.transmision].filter(Boolean).join(' ')
  return `${conBusqueda ? 'Busca en Google' : 'Con lo que sepas con certeza, indica'} la ficha técnica real del vehículo «${datos}» tal como se vendió en Ecuador (si no hay datos de Ecuador, usa Latinoamérica).
Responde SOLO con un objeto JSON, sin texto adicional, con estas claves (usa null si no lo ${conBusqueda ? 'encuentras en una fuente' : 'sabes con certeza'}; no inventes):
{"motor":"cilindraje en litros, p. ej. 1.6","potencia":"p. ej. 110 HP","torque":"p. ej. 150 Nm","combustible":"Gasolina|Diésel|Híbrido|Eléctrico","transmision":"Manual|Automática","velocidades":"p. ej. 5","traccion":"Delantera|Trasera|4x4","carroceria":"p. ej. Hatchback","puertas":"número","pasajeros":"número","consumo":"p. ej. 45 km/galón","equipamiento":["equipamiento de serie de esa versión"],"datos_de_interes":["2 o 3 datos reales que ayuden a vender, p. ej. consumo, maletero, seguridad, repuestos"]}`
}

/** Toma el primer objeto JSON del texto (Gemini a veces lo envuelve en ```json ... ```). */
export function extraerJson(texto: string): Record<string, any> | null {
  const i = texto.indexOf('{'), j = texto.lastIndexOf('}')
  if (i < 0 || j <= i) return null
  try { return JSON.parse(texto.slice(i, j + 1)) } catch { return null }
}

/** Datos exactos de la versión y el año. Prueba modelos con búsqueda; si el plan no lo permite, sin búsqueda (marcado). */
export async function investigarGoogle(v: Vehiculo, clave: string, pedir: Pedir = fetch): Promise<Investigacion> {
  const modelos = (await modelosDisponibles(clave, pedir)).slice(0, 4)
  const errores: ErrorGoogle[] = []
  for (const conBusqueda of [true, false]) {
    for (const modelo of conBusqueda ? modelos : modelos.slice(0, 3)) {
      try {
        const data = await generar(pedir, clave, modelo, promptFicha(v, conBusqueda), conBusqueda)
        return convertir(v, data, conBusqueda, modelo)
      } catch (e) {
        const err = e instanceof ErrorGoogle ? e : new ErrorGoogle(0, 'otro', (e as Error).message)
        if (err.tipo === 'clave' || err.tipo === 'permiso' || err.tipo === 'red') throw err
        errores.push(err)
      }
    }
  }
  const principal = errores.find((e) => e.tipo === 'cuota') ?? errores[0]
  throw principal ?? new ErrorGoogle(0, 'otro', 'No se pudo consultar Google.')
}

function convertir(v: Vehiculo, data: any, conBusqueda: boolean, modelo: string): Investigacion {
  const res: Investigacion = { resumen: '', hallazgos: [], avisos: [], fuentes: [] }
  const cand = data?.candidates?.[0]
  const texto: string = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('')
  const busqueda = `https://www.google.com/search?q=${encodeURIComponent(`${v.marca} ${v.modelo} ${v.version} ${v.anio} ficha técnica`.replace(/\s+/g, ' ').trim())}`
  const fuentes: Fuente[] = (cand?.groundingMetadata?.groundingChunks ?? [])
    .map((g: { web?: { uri: string; title: string } }) => g.web).filter(Boolean)
    .map((w: { uri: string; title: string }) => ({ nombre: w.title, url: w.uri }))
  res.fuentes = fuentes
  const fuente: Fuente = fuentes[0] ?? { nombre: conBusqueda ? 'Búsqueda de Google' : `Gemini sin búsqueda (${modelo}): verificar`, url: busqueda }
  if (!conBusqueda) res.avisos.push('Tu plan de Google no permitió buscar en la web: estos datos vienen del conocimiento del modelo. Verifícalos con «Abrir en Google» antes de usarlos.')
  else if (!fuentes.length) res.avisos.push('Google no indicó las páginas consultadas: verifica estos datos antes de usarlos.')
  const datos = extraerJson(texto)
  if (!datos) { res.avisos.push('Google no devolvió datos en el formato esperado.'); return res }
  const add = (campo: Investigacion['hallazgos'][number]['campo'], etiqueta: string, valor: unknown, opciones?: string[]) => {
    if (valor === null || valor === undefined || valor === '' || (Array.isArray(valor) && !valor.length)) return
    res.hallazgos.push({ campo, etiqueta, valor: Array.isArray(valor) ? valor.join(', ') : String(valor), opciones, fuente })
  }
  const m = typeof datos.motor === 'string' ? datos.motor.match(/\d[.,]\d/)?.[0]?.replace(',', '.') : undefined
  add('motor', 'Motor', datos.motor, m ? [m] : undefined)
  add(null, 'Potencia', datos.potencia)
  add(null, 'Torque', datos.torque)
  add('combustible', 'Combustible', datos.combustible, datos.combustible ? [datos.combustible] : undefined)
  add('transmision', 'Transmisión', datos.transmision && `${datos.transmision}${datos.velocidades ? ` de ${datos.velocidades} velocidades` : ''}`,
    datos.transmision ? [/autom/i.test(datos.transmision) ? 'Automática' : 'Manual'] : undefined)
  add('traccion', 'Tracción', datos.traccion, datos.traccion ? [datos.traccion] : undefined)
  add('carroceria', 'Carrocería', datos.carroceria, datos.carroceria ? [datos.carroceria] : undefined)
  add('puertas', 'Puertas', datos.puertas, datos.puertas ? [String(datos.puertas)] : undefined)
  add(null, 'Pasajeros', datos.pasajeros)
  add(null, 'Consumo', datos.consumo)
  add('equipamiento', 'Equipamiento de serie', datos.equipamiento, Array.isArray(datos.equipamiento) ? datos.equipamiento : undefined)
  add(null, 'Datos de interés', datos.datos_de_interes)
  return res
}

export interface Diagnostico {
  ok: boolean
  modelos: string[]
  pruebas: { modelo: string; busqueda: boolean; ok: boolean; motivo: string }[]
  conclusion: string
}

/** Prueba la clave en vivo: lista de modelos y una llamada mínima con y sin búsqueda. */
export async function diagnosticar(clave: string, pedir: Pedir = fetch): Promise<Diagnostico> {
  const d: Diagnostico = { ok: false, modelos: [], pruebas: [], conclusion: '' }
  try { d.modelos = await modelosDisponibles(clave, pedir) } catch (e) {
    d.conclusion = (e as Error).message
    return d
  }
  for (const busqueda of [true, false]) {
    for (const modelo of d.modelos.slice(0, 3)) {
      try {
        await generar(pedir, clave, modelo, 'Responde solo: OK', busqueda)
        d.pruebas.push({ modelo, busqueda, ok: true, motivo: 'Funciona' })
        break
      } catch (e) {
        const err = e as ErrorGoogle
        d.pruebas.push({ modelo, busqueda, ok: false, motivo: err.message })
        if (err.tipo === 'clave' || err.tipo === 'permiso' || err.tipo === 'red') { d.conclusion = err.message; return d }
      }
    }
  }
  const conBusqueda = d.pruebas.some((p) => p.busqueda && p.ok)
  const sinBusqueda = d.pruebas.some((p) => !p.busqueda && p.ok)
  d.ok = conBusqueda || sinBusqueda
  d.conclusion = conBusqueda ? '✅ La clave funciona con búsqueda de Google: datos con las páginas consultadas.'
    : sinBusqueda ? '⚠️ La clave funciona, pero tu plan no permite la búsqueda de Google. Se usarán datos del modelo marcados para verificar. Para habilitar la búsqueda, activa la facturación del proyecto en Google AI Studio.'
      : '❌ La clave no pudo generar respuestas: ' + (d.pruebas.find((p) => !p.ok)?.motivo ?? 'motivo desconocido')
  return d
}
