// Consulta por placa en el servicio público del SRI (el mismo que usa ECPlacas: BaseVehiculo + ConsultaRubros).
// Solo se usan datos del VEHÍCULO (marca, modelo, año, cilindraje, color, clase, matrícula, valores pendientes);
// nunca datos del propietario. Si el navegador no puede consultar el SRI directamente (CORS o servicio caído),
// el vendedor abre la consulta en el SRI y pega el resultado: se interpreta igual (JSON o texto).
import { analizar } from '../dominio/analizador'
import { ALIAS_MARCA } from '../dominio/catalogo'
import type { Hallazgo, Investigacion } from './investigador'

type Pedir = (url: string, init?: RequestInit) => Promise<Response>

export const SRI_REST = 'https://srienlinea.sri.gob.ec/sri-matriculacion-vehicular-recaudacion-servicio-internet/rest'
export const SRI_PAGINA = 'https://srienlinea.sri.gob.ec/sri-en-linea/SriVehiculosWeb/ConsultaValoresPagarVehiculo/Consultas/consultaRubros'

/** Datos base del vehículo tal como los devuelve el SRI (nombres de campo reales del servicio). */
export interface BaseSri {
  codigoVehiculo?: number
  descripcionMarca?: string
  descripcionModelo?: string
  anioAuto?: number | string
  descripcionPais?: string
  colorVehiculo1?: string
  colorVehiculo2?: string
  cilindraje?: number | string
  nombreClase?: string
  descripcionServicio?: string
  ultimoAnioPagado?: number | string
  fechaUltimaMatricula?: string
  fechaCaducidadMatricula?: string
  prohibidoEnajenar?: string
  descripcionCanton?: string
  fechaRevision?: string
  observacion?: string
}
export interface RubroSri { descripcionRubro?: string; valorRubro?: number; anioDesdePago?: number; anioHastaPago?: number; nombreCortoBeneficiario?: string }

/** «pba-1234», «PBA 1234» → «PBA1234». */
export function normalizarPlaca(p: string): string {
  return (p || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}
/** Autos: 3 letras + 3 o 4 números; motos: 2 letras + 3 números + 1 letra. */
export function placaValida(p: string): boolean {
  return /^[A-Z]{3}\d{3,4}$/.test(p) || /^[A-Z]{2}\d{3}[A-Z]$/.test(p)
}

export const urlBaseSri = (placa: string) => `${SRI_REST}/BaseVehiculo/obtenerPorNumeroPlacaOPorNumeroCampvOPorNumeroCpn?numeroPlacaCampvCpn=${placa}`
const urlRubrosSri = (codigo: number) => `${SRI_REST}/ConsultaRubros/obtenerPorCodigoVehiculo?codigoVehiculo=${codigo}`

async function conTiempo(pedir: Pedir, url: string, ms: number, mode: RequestMode = 'cors') {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    return await pedir(url, mode === 'cors' ? { signal: c.signal, headers: { Accept: 'application/json' } } : { signal: c.signal, mode })
  } finally { clearTimeout(t) }
}

export class ErrorPlaca extends Error {
  tipo: 'sin-acceso' | 'no-existe' | 'otro'
  constructor(tipo: 'sin-acceso' | 'no-existe' | 'otro', mensaje: string) {
    super(mensaje)
    this.tipo = tipo
  }
}

/** Consulta directa al SRI desde el navegador. Lanza ErrorPlaca('sin-acceso') si el navegador no puede llegar. */
export async function consultarSri(placa: string, pedir: Pedir = fetch, ms = 15000): Promise<{ base: BaseSri; rubros: RubroSri[] }> {
  let r: Response
  try { r = await conTiempo(pedir, urlBaseSri(placa), ms) } catch {
    // Diagnóstico: con «no-cors» el navegador sí deja hacer la petición (sin leerla). Si así responde, el SRI está
    // disponible y lo que bloquea es la política del navegador (CORS); si tampoco responde, es la red o el SRI.
    const responde = await conTiempo(pedir, urlBaseSri(placa), Math.min(ms, 10000), 'no-cors').then(() => true, () => false)
    throw new ErrorPlaca('sin-acceso', responde
      ? 'El SRI respondió, pero no permite que otras páginas lean sus datos directamente (política del navegador). Usa la consulta manual de abajo: son dos toques.'
      : 'El SRI no respondió desde tu conexión (filtra algunas redes). Prueba con datos móviles o usa la consulta manual de abajo.')
  }
  if (!r.ok) throw new ErrorPlaca(r.status === 404 ? 'no-existe' : 'otro', r.status === 404 ? `El SRI no tiene registrada la placa ${placa}.` : `El SRI respondió ${r.status}.`)
  const base = (await r.json().catch(() => null)) as BaseSri | null
  if (!base || !base.codigoVehiculo) throw new ErrorPlaca('no-existe', `El SRI no tiene registrada la placa ${placa}.`)
  let rubros: RubroSri[] = []
  try {
    const rr = await conTiempo(pedir, urlRubrosSri(base.codigoVehiculo), ms)
    if (rr.ok) rubros = ((await rr.json()) as RubroSri[]) ?? []
  } catch { /* sin rubros: se informa solo lo base */ }
  return { base, rubros }
}

const titulo = (s?: string) => (s ?? '').toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).trim()
const CLASES: Record<string, string> = { JEEP: 'SUV', CAMIONETA: 'Camioneta', 'VEHICULO UTILITARIO': 'SUV', FURGONETA: 'Furgoneta', AUTOMOVIL: '', AUTOMÓVIL: '',
  MOTOCICLETA: 'Moto', MOTO: 'Moto', CUADRON: 'Cuadrón', 'CUADRÓN': 'Cuadrón', TRICIMOTO: 'Tricimoto' }

/**
 * Lectura tolerante de la respuesta: el SRI no siempre usa los mismos nombres de campo (y algunos vienen anidados),
 * así que cada dato se busca por su significado («color…», «cilindr…», «clase…») además del nombre conocido.
 */
export function normalizarBase(crudo: Record<string, unknown>): BaseSri {
  const planos: [string, unknown][] = []
  const recorrer = (o: Record<string, unknown>, nivel: number) => {
    for (const [k, v] of Object.entries(o ?? {})) {
      if (v && typeof v === 'object' && !Array.isArray(v) && nivel < 2) recorrer(v as Record<string, unknown>, nivel + 1)
      else planos.push([k.toLowerCase(), v])
    }
  }
  recorrer(crudo, 0)
  const buscar = (...patrones: RegExp[]) => {
    for (const re of patrones) {
      const e = planos.find(([k, v]) => re.test(k) && v !== null && v !== undefined && String(v).trim() !== '' && String(v) !== '0')
      if (e) return e[1] as string
    }
    return undefined
  }
  return {
    codigoVehiculo: buscar(/^codigovehiculo$/) as unknown as number,
    descripcionMarca: buscar(/^descripcionmarca$/, /marca/),
    descripcionModelo: buscar(/^descripcionmodelo$/, /^modelo$/, /modelo(?!.*codigo)/),
    anioAuto: buscar(/^anioauto$/, /^aniomodelo$/, /^anio(fabricacion)?$/, /^a[ñn]o/),
    descripcionPais: buscar(/^descripcionpais$/, /pais/),
    colorVehiculo1: buscar(/^colorvehiculo1$/, /^color1?$/, /color(?!.*2)/),
    colorVehiculo2: buscar(/^colorvehiculo2$/, /color.*2/),
    cilindraje: buscar(/^cilindraje$/, /cilindr/),
    nombreClase: buscar(/^nombreclase$/, /clase/),
    descripcionServicio: buscar(/^descripcionservicio$/, /servicio/),
    ultimoAnioPagado: buscar(/^ultimoaniopagado$/, /ultimo.*anio|anio.*pag/),
    fechaCaducidadMatricula: buscar(/^fechacaducidadmatricula$/, /caducidad/),
    fechaUltimaMatricula: buscar(/^fechaultimamatricula$/),
    prohibidoEnajenar: buscar(/^prohibidoenajenar$/, /enajenar/),
    descripcionCanton: buscar(/^descripcioncanton$/, /canton/),
    fechaRevision: buscar(/^fecharevision$/, /revision/),
  } as BaseSri
}

/** Convierte la respuesta del SRI en hallazgos aplicables (fuente: SRI) y avisos para el vendedor. */
export function interpretarSri(placa: string, crudo: BaseSri, rubros: RubroSri[]): Investigacion {
  const base = normalizarBase(crudo as Record<string, unknown>)
  const fuente = { nombre: `SRI · placa ${placa}`, url: urlBaseSri(placa) }
  const h: Hallazgo[] = []
  const add = (campo: Hallazgo['campo'], etiqueta: string, valor: string | undefined, opcion?: string) => {
    if (valor) h.push({ campo, etiqueta, valor, opciones: opcion ? [opcion] : undefined, fuente })
  }
  const marcaSri = (base.descripcionMarca ?? '').trim()
  const marca = ALIAS_MARCA[marcaSri.toLowerCase()] ?? titulo(marcaSri)
  // El modelo del SRI suele traer versión y datos: «AVEO FAMILY AC 1.5 4P 4X2 TM» → se analiza igual que un texto libre
  const a = analizar(`${marca} ${base.descripcionModelo ?? ''}`).vehiculo
  const modelo = a.modelo || titulo((base.descripcionModelo ?? '').split(/\s+/)[0])
  add('marca', 'Marca', marca, marca)
  add('modelo', 'Modelo (SRI)', titulo(base.descripcionModelo), modelo)
  if (a.version) add('version', 'Versión', a.version, a.version)
  const anio = String(base.anioAuto ?? '').match(/\d{4}/)?.[0]
  add('anio', 'Año', anio, anio)
  const cc = +String(base.cilindraje ?? '').replace(/\D/g, '')
  const esMoto = /MOTO|CUADR|TRICI/i.test(base.nombreClase ?? '')
  // Autos: litros («1498 cc» → 1.5); motos: cilindraje en cc («150 cc»)
  if (cc > 0) add('motor', 'Cilindraje', `${cc} cc`, esMoto || cc < 600 ? `${cc} cc` : (Math.round(cc / 100) / 10).toFixed(1))
  if (a.transmision) add('transmision', 'Transmisión', a.transmision, a.transmision)
  if (a.puertas) add('puertas', 'Puertas', a.puertas, a.puertas)
  if (a.traccion) add('traccion', 'Tracción', a.traccion, a.traccion)
  for (const e of a.equipamiento) add('equipamiento', 'Equipamiento (según el modelo registrado)', e, e)
  const color = titulo(base.colorVehiculo1)
  if (color) add('color', 'Color', color + (base.colorVehiculo2 && base.colorVehiculo2 !== base.colorVehiculo1 ? ` / ${titulo(base.colorVehiculo2)}` : ''), color)
  add('procedencia', 'País de origen', titulo(base.descripcionPais), titulo(base.descripcionPais))
  const clase = (base.nombreClase ?? '').toUpperCase().trim()
  add('carroceria', 'Clase', titulo(clase), CLASES[clase] || undefined)
  add(null, 'Servicio', titulo(base.descripcionServicio))
  add(null, 'Matriculado en', titulo(base.descripcionCanton))
  if (base.fechaRevision) add(null, 'Última revisión vehicular', String(base.fechaRevision).slice(0, 10))

  const avisos: string[] = []
  const servicio = (base.descripcionServicio ?? '').toUpperCase()
  if (servicio && !/PARTICULAR/.test(servicio))
    avisos.push(`El SRI registra el servicio «${titulo(servicio)}» (no particular): menciónalo con claridad o revisa el cambio de servicio antes de publicar.`)
  const deuda = rubros.reduce((s, r) => s + (+(r.valorRubro ?? 0) || 0), 0)
  const pagado = String(base.ultimoAnioPagado ?? '').match(/\d{4}/)?.[0]
  if (deuda > 0) {
    avisos.push(`El vehículo tiene valores pendientes en el SRI por $${deuda.toFixed(2)} (${rubros.filter((r) => r.valorRubro).map((r) => titulo(r.descripcionRubro)).join(', ')}). No se publicará «matrícula al día».`)
  } else if (pagado) {
    add('matricula', 'Matrícula', `Último año pagado: ${pagado}, sin valores pendientes en el SRI`, `Al día ${pagado}`)
  }
  if (base.fechaCaducidadMatricula) add(null, 'Matrícula vigente hasta', base.fechaCaducidadMatricula.slice(0, 10))
  if (/^(s|si|sí)$/i.test((base.prohibidoEnajenar ?? '').trim()))
    avisos.push('⚠️ El SRI registra prohibición de enajenar: revisa la situación legal antes de publicar.')
  return { resumen: '', hallazgos: h, avisos, fuentes: [fuente] }
}

/**
 * Interpreta lo que el vendedor pega desde el SRI: el JSON del servicio (al abrir el enlace de datos) o el texto de la
 * página de consulta («Marca: CHEVROLET», «Modelo: …», «Año: 2015», «Cilindraje: 1498»…).
 */
export function interpretarPegado(placa: string, texto: string): Investigacion | null {
  const t = (texto || '').trim()
  if (!t) return null
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const j = JSON.parse(t)
      const base = Array.isArray(j) ? j[0] : j
      if (base && (base.descripcionMarca || base.descripcionModelo)) return interpretarSri(placa, base, [])
    } catch { /* no era JSON válido: se intenta como texto */ }
  }
  const campo = (...nombres: string[]) => {
    for (const n of nombres) {
      const m = t.match(new RegExp(`${n}\\s*[:\\n\\t]\\s*([^\\n\\t]+)`, 'i'))
      if (m && m[1].trim()) return m[1].trim()
    }
    return undefined
  }
  const base: BaseSri = {
    descripcionMarca: campo('marca'),
    descripcionModelo: campo('modelo'),
    anioAuto: campo('año de fabricaci[oó]n', 'año modelo', 'a[ñn]o'),
    cilindraje: campo('cilindraje'),
    colorVehiculo1: campo('color 1', 'color'),
    descripcionPais: campo('pa[ií]s(?: de origen)?'),
    nombreClase: campo('clase'),
    descripcionServicio: campo('servicio'),
    ultimoAnioPagado: campo('[úu]ltimo a[ñn]o pagado'),
  }
  if (!base.descripcionMarca && !base.descripcionModelo) return null
  return interpretarSri(placa, base, [])
}

/** Resumen legible de una consulta para el historial de placas: «Chevrolet Aveo Family 2015 · Plateado». */
export function resumenDePlaca(r: Investigacion): string {
  const op = (c: string) => r.hallazgos.find((h) => h.campo === c)?.opciones?.[0] ?? ''
  return [[op('marca'), op('modelo'), op('anio')].filter(Boolean).join(' '), op('color')].filter(Boolean).join(' · ')
}
