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

// La consulta a Google (Gemini) vive en google.ts
export { investigarGoogle, extraerJson } from './google'
