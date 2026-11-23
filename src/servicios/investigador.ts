// Investigación de datos reales del vehículo. Cada hallazgo lleva su fuente; nada se agrega a la publicación
// sin que el vendedor lo acepte. Fuentes:
//  1) Wikipedia en español e inglés (gratis, sin clave): ficha técnica del modelo.
//  2) Google mediante Gemini con «búsqueda de Google» (opcional, con clave gratuita de Google AI Studio):
//     datos de la versión y el año exactos, con los enlaces que Google usó.
import { ARTICULO_EQUIVALENTE } from '../dominio/catalogo'
import type { Vehiculo } from '../dominio/tipos'
import { analizar } from '../dominio/analizador'
import { camposFicha, cilindradas, rangosAnios, traccionDe } from './wikitexto'

const analizarTexto = (t: string) => analizar(t).vehiculo

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

const FICHA_VEHICULO = /\{\{\s*(Ficha de automóvil|Ficha de vehículo|Ficha de motocicleta|Infobox automobile|Infobox car|Infobox motorcycle)/i

/** Período de producción de la ficha del artículo (español o inglés). */
function periodoDe(wikitexto: string): string {
  const f = camposFicha(wikitexto, ['Ficha de automóvil', 'Ficha de vehículo', 'Infobox automobile', 'Infobox car'])
  return f['período'] ?? f['periodo'] ?? f['producción'] ?? f['production'] ?? ''
}

/**
 * Busca el artículo del modelo (solo títulos que mencionan el modelo). Prefiere el título exacto («Suzuki Cultus») y
 * descarta artículos cuyo período de producción no incluye el año del vehículo (un Forsa 1989 no es el «Cultus
 * Crescent» de 1995-2007), probando el siguiente candidato.
 */
async function articulo(pedir: Pedir, idioma: 'es' | 'en', consulta: string, modelo: string, exacto = '', anio = '') {
  const api = `https://${idioma}.wikipedia.org/w/api.php?format=json&origin=*`
  const buscar = async (q: string) => {
    const s = await json(pedir, `${api}&action=query&list=search&srlimit=5&srinfo=suggestion&srsearch=${encodeURIComponent(q)}`)
    const titulos: string[] = (s?.query?.search ?? []).map((x: { title: string }) => x.title)
    const candidatos = titulos.filter((t) => sinTildes(t).includes(sinTildes(modelo)))
      .sort((a, b) => Number(sinTildes(b) === sinTildes(exacto)) - Number(sinTildes(a) === sinTildes(exacto)))
    return { candidatos, sugerencia: s?.query?.searchinfo?.suggestion as string | undefined }
  }
  let { candidatos, sugerencia } = await buscar(consulta)
  // Si no hay resultado, se usa la corrección que propone Wikipedia («mazda alegro» → «mazda allegro»)
  if (!candidatos.length && sugerencia) candidatos = (await buscar(sugerencia)).candidatos
  let primero: { titulo: string; wikitexto: string; url: string; encaja: boolean; confirma: boolean } | null = null
  for (const titulo of candidatos.slice(0, 3)) {
    const r = await json(pedir, `${api}&action=query&prop=revisions&rvprop=content&rvslots=main&rvsection=0&redirects=1&titles=${encodeURIComponent(titulo)}`)
    const pagina = Object.values(r?.query?.pages ?? {})[0] as { title?: string; revisions?: { slots: { main: { '*': string } } }[] }
    const wikitexto = pagina?.revisions?.[0]?.slots?.main?.['*']
    if (!wikitexto) continue
    // Solo artículos de vehículos (con ficha de automóvil o de motocicleta): «Nissan Infinity» no es el artículo
    // matemático «Infinity»
    if (!FICHA_VEHICULO.test(wikitexto)) continue
    const rangos = rangosAnios(periodoDe(wikitexto))
    const encaja = !anio || !rangos.length || rangos.some(([a, b]) => +anio >= a && +anio <= b)
    const tituloFinal = pagina.title ?? titulo
    const art = { titulo: tituloFinal, wikitexto, url: `https://${idioma}.wikipedia.org/wiki/${encodeURIComponent(tituloFinal.replace(/ /g, '_'))}`, encaja, confirma: encaja && rangos.length > 0 }
    // Solo se adelanta un artículo que CONFIRMA el año con su período; si no, se prueba el siguiente
    if (art.confirma || !anio) return art
    primero ??= art
  }
  // Ninguno confirma el año: el mejor candidato (exacto o primero); si su período no incluye el año, se avisa «Revisa el año»
  return primero
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
  // Nombre comercial de Ecuador → nombre del artículo (Mazda Allegro → Mazda 323)
  const equivalente = ARTICULO_EQUIVALENTE[sinTildes(nombre)]
  const buscado = equivalente ?? nombre
  const modeloBuscado = equivalente ? equivalente.split(' ').slice(1).join(' ') : v.modelo
  if (equivalente) res.avisos.push(`El ${nombre} se conoce internacionalmente como ${equivalente}; se muestran los datos de ese modelo.`)

  let [es, en] = await Promise.all([
    articulo(pedir, 'es', `${buscado} automóvil`, modeloBuscado, buscado, v.anio).catch(() => null),
    articulo(pedir, 'en', `${buscado} car`, modeloBuscado, buscado, v.anio).catch(() => null),
  ])
  // Si un idioma confirma (con su período de producción) el artículo de la época correcta y el otro no encaja, se descarta el que no corresponde
  if (es && !es.encaja && en?.confirma) es = null
  if (en && !en.encaja && es?.confirma) en = null

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
    let opcionesCarr = carr ? carr.split(';').map((x) => x.trim()).filter(Boolean) : undefined
    // Con las puertas conocidas (p. ej., del SRI: «4P»), queda solo la carrocería que tiene esas puertas, si es una
    if (opcionesCarr && v.puertas) {
      const palabra = ({ 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco' } as Record<string, string>)[v.puertas] ?? v.puertas
      const conPuertas = opcionesCarr.filter((o) => new RegExp(`\\b(${v.puertas}|${palabra})\\b`, 'i').test(o))
      if (conPuertas.length === 1) opcionesCarr = conPuertas
    }
    add('carroceria', 'Carrocería', carr, opcionesCarr)
    const conf = f['configuración']
    if (conf) add('traccion', 'Tracción', traccionDe(conf) || conf, traccionDe(conf) ? traccionDe(conf).split(' o ') : undefined)
    const trans = f['transmisión']
    add('transmision', 'Transmisión', trans, trans ? [...new Set([/manual/i.test(trans) && 'Manual', /autom/i.test(trans) && 'Automática'].filter(Boolean) as string[])] : undefined)
    const motor = f['motor'] ?? f['motores']
    add('motor', 'Motores', motor, motor ? cilindradas(motor) : undefined)
    add(null, 'Peso', f['peso'])
    add(null, 'Largo', f['largo'] ?? f['longitud'])
    res.resumen = await resumenWikipedia(pedir, es.titulo)
    if (!equivalente && !sinTildes(es.titulo).includes(sinTildes(v.marca || ''))) res.avisos.push(`En Wikipedia el modelo aparece como «${es.titulo}».`)

    const periodo = f['período'] ?? f['periodo'] ?? ''
    const rangos = rangosAnios(periodo)
    if (v.anio && rangos.length && !rangos.some(([a, b]) => +v.anio >= a && +v.anio <= b))
      res.avisos.push(`Revisa el año: ${v.anio} queda fuera del período de producción indicado (${periodo}).`)
  }

  if (en) {
    const fuente = { nombre: `Wikipedia (inglés): ${en.titulo}`, url: en.url }
    res.fuentes.push(fuente)
    const f = camposFicha(en.wikitexto, ['Infobox automobile', 'Infobox car'])
    if (!es) {
      // Sin artículo en español de esa época: los datos generales salen de la ficha en inglés
      const info = (etiqueta: string, valor?: string) => { if (valor) res.hallazgos.push({ campo: null, etiqueta, valor, fuente }) }
      info('Fabricante', f['manufacturer'])
      info('Período de producción', f['production'])
      info('Segmento', f['class'])
      if (v.anio && rangosAnios(f['production'] ?? '').length && !rangosAnios(f['production'] ?? '').some(([a, b]) => +v.anio >= a && +v.anio <= b))
        res.avisos.push(`Revisa el año: ${v.anio} queda fuera del período de producción indicado (${f['production']}).`)
    }
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

/**
 * Datos extraídos de un texto que el vendedor copió de Google (ficha técnica, resumen, página del fabricante).
 * Sin API: la app abre la búsqueda, el vendedor copia lo que ve y aquí se reconocen los datos.
 */
export function investigarTextoPegado(texto: string, v: Vehiculo): Investigacion {
  const consulta = [v.marca, v.modelo, v.version, v.anio, 'ficha técnica'].filter(Boolean).join(' ')
  const fuente: Fuente = { nombre: 'Texto copiado de Google', url: `https://www.google.com/search?q=${encodeURIComponent(consulta)}` }
  const res: Investigacion = { resumen: '', hallazgos: [], avisos: [], fuentes: [fuente] }
  const a = analizarTexto(texto)
  const add = (campo: keyof Vehiculo | null, etiqueta: string, valor?: string, opciones?: string[]) => {
    if (valor) res.hallazgos.push({ campo, etiqueta, valor, opciones, fuente })
  }
  // Solo campos técnicos: marca, modelo, año y precio los decide el vendedor (el texto pegado puede hablar de otras versiones)
  if (a.motor) add('motor', 'Motor', `${a.motor} L`, [a.motor])
  if (a.transmision) add('transmision', 'Transmisión', a.transmision, [a.transmision])
  if (a.combustible) add('combustible', 'Combustible', a.combustible, [a.combustible])
  const traccion = a.traccion || traccionDe(texto) // «tracción delantera» además de 4x4/4x2
  if (traccion) add('traccion', 'Tracción', traccion, traccion.split(' o '))
  if (a.carroceria) add('carroceria', 'Carrocería', a.carroceria, [a.carroceria])
  if (a.puertas) add('puertas', 'Puertas', a.puertas, [a.puertas])
  for (const e of a.equipamiento) add('equipamiento', 'Equipamiento mencionado', e, [e])
  const plano = texto.toLowerCase()
  add(null, 'Potencia', plano.match(/(\d{2,3}(?:[.,]\d)?)\s*(?:hp|cv|caballos)/)?.[0])
  add(null, 'Torque', plano.match(/(\d{2,3})\s*(?:nm|n·m|newton)/)?.[0])
  add(null, 'Consumo', plano.match(/(\d{1,3}(?:[.,]\d)?)\s*(?:km\/gal[oó]n|km\/gal|km por gal[oó]n|km\/l|l\/100\s*km)/)?.[0])
  add(null, 'Velocidades', plano.match(/(\d)\s*(?:velocidades|marchas|cambios)/)?.[0])
  add(null, 'Pasajeros', plano.match(/(\d)\s*(?:pasajeros|plazas|asientos)/)?.[0])
  if (!res.hallazgos.length) res.avisos.push('No se reconocieron datos técnicos en el texto pegado. Copia la parte de la ficha técnica (motor, transmisión, potencia…).')
  return res
}
