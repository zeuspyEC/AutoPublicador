// Investigación de datos reales del vehículo. Cada hallazgo lleva su fuente; nada se agrega a la publicación
// sin que el vendedor lo acepte. Fuentes:
//  1) Wikipedia en español e inglés (gratis, sin clave): ficha técnica del modelo.
//  2) Google mediante Gemini con «búsqueda de Google» (opcional, con clave gratuita de Google AI Studio):
//     datos de la versión y el año exactos, con los enlaces que Google usó.
import type { Vehiculo } from '../dominio/tipos'
import { camposFicha, cilindradas, rangosAnios, traccionDe } from './wikitexto'

export interface Fuente { nombre: string; url: string }

export interface Hallazgo {
  campo: keyof Vehiculo | null // null = dato informativo (no es un campo del formulario)
  etiqueta: string
  valor: string
  opciones?: string[] // valores concretos que se pueden aplicar con un toque
  fuente: Fuente
}

export interface Investigacion {
  resumen: string
  hallazgos: Hallazgo[]
  avisos: string[]
  fuentes: Fuente[]
}

type Pedir = (url: string, init?: RequestInit) => Promise<Response>

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Wikipedia exige identificar la aplicación; desde el navegador se hace con «Api-User-Agent». */
const CABECERAS_WIKI = { 'Api-User-Agent': 'AutoPublicador/1.0 (https://github.com/zeuspyEC/AutoPublicador)' }

async function json(pedir: Pedir, url: string) {
  const r = await pedir(url, { headers: CABECERAS_WIKI })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

/** Busca el artículo del modelo y devuelve su título (solo si menciona el modelo) y el wikitexto de la cabecera. */
async function articulo(pedir: Pedir, idioma: 'es' | 'en', consulta: string, modelo: string) {
  const api = `https://${idioma}.wikipedia.org/w/api.php?format=json&origin=*`
  const s = await json(pedir, `${api}&action=query&list=search&srlimit=5&srsearch=${encodeURIComponent(consulta)}`)
  const titulos: string[] = (s?.query?.search ?? []).map((x: { title: string }) => x.title)
  const titulo = titulos.find((t) => sinTildes(t).includes(sinTildes(modelo)))
  if (!titulo) return null
  const r = await json(pedir, `${api}&action=query&prop=revisions&rvprop=content&rvslots=main&rvsection=0&redirects=1&titles=${encodeURIComponent(titulo)}`)
  const pagina = Object.values(r?.query?.pages ?? {})[0] as { title?: string; revisions?: { slots: { main: { '*': string } } }[] }
  const wikitexto = pagina?.revisions?.[0]?.slots?.main?.['*']
  if (!wikitexto) return null
  const tituloFinal = pagina.title ?? titulo
  return { titulo: tituloFinal, wikitexto, url: `https://${idioma}.wikipedia.org/wiki/${encodeURIComponent(tituloFinal.replace(/ /g, '_'))}` }
}

async function resumenWikipedia(pedir: Pedir, titulo: string): Promise<string> {
  try {
    const r = await json(pedir, `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titulo.replace(/ /g, '_'))}`)
    return (r?.extract as string) ?? ''
  } catch { return '' }
}

/** Datos del modelo en Wikipedia (español para textos, inglés para motores). */
export async function investigarWikipedia(v: Vehiculo, pedir: Pedir = fetch): Promise<Investigacion> {
  const res: Investigacion = { resumen: '', hallazgos: [], avisos: [], fuentes: [] }
  if (!v.modelo) { res.avisos.push('Falta el modelo para poder investigar.'); return res }
  const nombre = `${v.marca} ${v.modelo}`.trim()

  const [es, en] = await Promise.all([
    articulo(pedir, 'es', `${nombre} automóvil`, v.modelo).catch(() => null),
    articulo(pedir, 'en', `${nombre} car`, v.modelo).catch(() => null),
  ])

  if (es) {
    const fuente = { nombre: `Wikipedia: ${es.titulo}`, url: es.url }
    res.fuentes.push(fuente)
    const f = camposFicha(es.wikitexto, ['Ficha de automóvil', 'Ficha de vehículo', 'Infobox automobile'])
    const add = (campo: keyof Vehiculo | null, etiqueta: string, valor?: string, opciones?: string[]) => {
      if (valor) res.hallazgos.push({ campo, etiqueta, valor, opciones, fuente })
    }
    add(null, 'Fabricante', f['fabricante'])
    add(null, 'Período de producción', f['período'] ?? f['periodo'] ?? f['producción'])
    add(null, 'Tipo', f['tipo'])
    const carr = f['carrocería']
    add('carroceria', 'Carrocería', carr, carr ? carr.split(';').map((x) => x.trim()).filter(Boolean) : undefined)
    const conf = f['configuración']
    if (conf) add('traccion', 'Tracción', traccionDe(conf) || conf, traccionDe(conf) ? traccionDe(conf).split(' o ') : undefined)
    const trans = f['transmisión']
    add('transmision', 'Transmisión', trans, trans ? [...new Set([/manual/i.test(trans) && 'Manual', /autom/i.test(trans) && 'Automática'].filter(Boolean) as string[])] : undefined)
    const motor = f['motor'] ?? f['motores']
    add('motor', 'Motores', motor, motor ? cilindradas(motor) : undefined)
    add(null, 'Peso', f['peso'])
    add(null, 'Largo', f['largo'] ?? f['longitud'])
    res.resumen = await resumenWikipedia(pedir, es.titulo)
    if (!sinTildes(es.titulo).includes(sinTildes(v.marca || ''))) res.avisos.push(`En Wikipedia el modelo aparece como «${es.titulo}».`)

    const periodo = f['período'] ?? f['periodo'] ?? ''
    const rangos = rangosAnios(periodo)
    if (v.anio && rangos.length && !rangos.some(([a, b]) => +v.anio >= a && +v.anio <= b))
      res.avisos.push(`Revisa el año: ${v.anio} queda fuera del período de producción indicado (${periodo}).`)
  }

  if (en) {
    const fuente = { nombre: `Wikipedia (inglés): ${en.titulo}`, url: en.url }
    res.fuentes.push(fuente)
    const f = camposFicha(en.wikitexto, ['Infobox automobile', 'Infobox car'])
    const motores = cilindradas(f['engine'] ?? '')
    if (motores.length && !res.hallazgos.some((h) => h.campo === 'motor'))
      res.hallazgos.push({ campo: 'motor', etiqueta: 'Motores', valor: motores.map((m) => `${m} L`).join(', '), opciones: motores, fuente })
    if (/diesel/i.test(f['engine'] ?? ''))
      res.hallazgos.push({ campo: 'combustible', etiqueta: 'Combustible', valor: 'Versiones a gasolina y diésel', opciones: ['Gasolina', 'Diésel'], fuente })
    if (!res.hallazgos.some((h) => h.campo === 'traccion') && f['layout'] && traccionDe(f['layout']))
      res.hallazgos.push({ campo: 'traccion', etiqueta: 'Tracción', valor: traccionDe(f['layout']), opciones: traccionDe(f['layout']).split(' o '), fuente })
  }

  if (v.motor) {
    const motores = res.hallazgos.find((h) => h.campo === 'motor')?.opciones ?? []
    if (motores.length && !motores.includes(v.motor))
      res.avisos.push(`El motor ${v.motor} L no aparece entre los motores conocidos del modelo (${motores.join(', ')} L). Verifícalo.`)
  }
  if (!es && !en) res.avisos.push(`No se encontró «${nombre}» en Wikipedia. Revisa la marca y el modelo o usa la búsqueda en Google.`)
  return res
}

// ---------- Google (Gemini con búsqueda de Google) ----------

const MODELOS_GEMINI = ['gemini-2.5-flash', 'gemini-flash-latest']

function promptGoogle(v: Vehiculo): string {
  const datos = [v.marca, v.modelo, v.version, v.anio, v.motor && `${v.motor}L`, v.transmision].filter(Boolean).join(' ')
  return `Busca en Google la ficha técnica real del vehículo «${datos}» tal como se vendió en Ecuador (si no hay datos de Ecuador, usa Latinoamérica).
Responde SOLO con un objeto JSON, sin texto adicional, con estas claves (usa null si no lo encuentras en una fuente; no inventes):
{"motor":"cilindraje en litros, p. ej. 1.6","potencia":"p. ej. 110 HP","combustible":"Gasolina|Diésel|Híbrido|Eléctrico","transmision":"Manual|Automática","velocidades":"p. ej. 5","traccion":"Delantera|Trasera|4x4","carroceria":"p. ej. Hatchback","puertas":"número","pasajeros":"número","equipamiento":["equipamiento de serie de esa versión"],"datos_de_interes":["2 o 3 datos reales que ayuden a vender, p. ej. consumo, maletero, seguridad"]}`
}

/** Datos exactos de la versión y el año buscando en Google (requiere clave gratuita de Google AI Studio). */
export async function investigarGoogle(v: Vehiculo, clave: string, pedir: Pedir = fetch): Promise<Investigacion> {
  const res: Investigacion = { resumen: '', hallazgos: [], avisos: [], fuentes: [] }
  let ultimoError = ''
  for (const modelo of MODELOS_GEMINI) {
    const r = await pedir(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptGoogle(v) }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0 } }),
    })
    if (r.status === 404) { ultimoError = `modelo ${modelo} no disponible`; continue }
    if (!r.ok) {
      const cuerpo = await r.text().catch(() => '')
      throw new Error(r.status === 400 || r.status === 403 ? 'La clave de Google no es válida o no tiene permiso.' : `Google respondió ${r.status}. ${cuerpo.slice(0, 120)}`)
    }
    const data = await r.json()
    const cand = data?.candidates?.[0]
    const texto: string = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('')
    const fuentes: Fuente[] = (cand?.groundingMetadata?.groundingChunks ?? [])
      .map((g: { web?: { uri: string; title: string } }) => g.web).filter(Boolean)
      .map((w: { uri: string; title: string }) => ({ nombre: w.title, url: w.uri }))
    res.fuentes = fuentes
    const fuente: Fuente = fuentes[0] ?? { nombre: 'Búsqueda de Google', url: `https://www.google.com/search?q=${encodeURIComponent(`${v.marca} ${v.modelo} ${v.anio} ficha técnica`)}` }
    const datos = extraerJson(texto)
    if (!datos) { res.avisos.push('Google no devolvió datos en el formato esperado.'); return res }
    if (!fuentes.length) res.avisos.push('Google no indicó las páginas consultadas: verifica estos datos antes de usarlos.')
    const add = (campo: keyof Vehiculo | null, etiqueta: string, valor: unknown, opciones?: string[]) => {
      if (valor === null || valor === undefined || valor === '' || (Array.isArray(valor) && !valor.length)) return
      res.hallazgos.push({ campo, etiqueta, valor: Array.isArray(valor) ? valor.join(', ') : String(valor), opciones, fuente })
    }
    const m = typeof datos.motor === 'string' ? datos.motor.match(/\d[.,]\d/)?.[0]?.replace(',', '.') : undefined
    add('motor', 'Motor', datos.motor, m ? [m] : undefined)
    add(null, 'Potencia', datos.potencia)
    add('combustible', 'Combustible', datos.combustible, datos.combustible ? [datos.combustible] : undefined)
    add('transmision', 'Transmisión', datos.transmision && `${datos.transmision}${datos.velocidades ? ` de ${datos.velocidades} velocidades` : ''}`,
      datos.transmision ? [/autom/i.test(datos.transmision) ? 'Automática' : 'Manual'] : undefined)
    add('traccion', 'Tracción', datos.traccion, datos.traccion ? [datos.traccion] : undefined)
    add('carroceria', 'Carrocería', datos.carroceria, datos.carroceria ? [datos.carroceria] : undefined)
    add('puertas', 'Puertas', datos.puertas, datos.puertas ? [String(datos.puertas)] : undefined)
    add(null, 'Pasajeros', datos.pasajeros)
    add('equipamiento', 'Equipamiento de serie', datos.equipamiento, Array.isArray(datos.equipamiento) ? datos.equipamiento : undefined)
    add(null, 'Datos de interés', datos.datos_de_interes)
    return res
  }
  throw new Error(`No se pudo consultar Google (${ultimoError}).`)
}

/** Toma el primer objeto JSON del texto (Gemini a veces lo envuelve en ```json ... ```). */
export function extraerJson(texto: string): Record<string, any> | null {
  const i = texto.indexOf('{'), j = texto.lastIndexOf('}')
  if (i < 0 || j <= i) return null
  try { return JSON.parse(texto.slice(i, j + 1)) } catch { return null }
}
