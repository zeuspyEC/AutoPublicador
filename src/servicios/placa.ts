// Consulta por placa en el servicio público del SRI (el mismo que usa ECPlacas: BaseVehiculo + ConsultaRubros).
// Solo se usan datos del VEHÍCULO (marca, modelo, año, cilindraje, color, clase, matrícula, valores pendientes);
// nunca datos del propietario. Si el navegador no puede consultar el SRI directamente (CORS o servicio caído),
// el vendedor abre la consulta en el SRI y pega el resultado: se interpreta igual (JSON o texto).
import { analizar } from '../dominio/analizador'
import { ALIAS_MARCA } from '../dominio/catalogo'
import { cilindrajeDesdeIacv, litros, type LineaIacv } from '../dominio/impuestoAmbiental'
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
  estadoExoneracion?: string
  aplicaCuota?: boolean | string
  verMensajeElectricos?: boolean | string
}
export interface RubroSri { codigoRubro?: number; descripcionRubro?: string; valorRubro?: number; anioDesdePago?: number; anioHastaPago?: number; codigoTipoDeuda?: string; descripcionTipoDeuda?: string }
/** Pago registrado en el SRI (consultaPagos): fecha, tipo y monto. */
export interface PagoSri { fechaDePago?: string; tipoDeuda?: string; monto?: number }
/** Desglose de un valor pendiente (ConsultaComponente): impuesto, tasa, recargo, interés… por año fiscal. */
export interface ComponentesSri { codigoRubro?: number; componentes: { codigoComponente?: string; anioFiscal?: number; valorComponente?: number }[] }
/** Detalle de un pago (obtenerDetallesPago): qué rubro y de qué año se pagó. */
export interface DetallePagoSri { fechaDePago?: string; detalle: { descripcionRubro?: string; descripcionComponente?: string; anio?: number; valor?: number }[] }
/** Resumen de TODO el historial de pagos que calcula el servidor. */
export interface ResumenPagosSri { totalPagos?: number; traspasos?: number; ultimoTraspaso?: string | null; primerPago?: string | null; ultimoPago?: string | null }
export interface ExtraSri { componentes?: ComponentesSri[]; detallesPago?: DetallePagoSri[]; resumenPagos?: ResumenPagosSri; impuestoAmbiental?: LineaIacv[] }
export interface ConsultaSri extends ExtraSri { base: BaseSri; rubros: RubroSri[]; pagos: PagoSri[]; registrada?: string }

/** El 1 % de transferencia de dominio es el costo del traspaso, no una deuda de matrícula. */
const esTraspaso = (r: RubroSri) => /TRANSF/i.test(`${r.codigoTipoDeuda ?? ''} ${r.descripcionRubro ?? ''}`)
/** Moto por su placa (AB123C) aunque el SRI no informe la clase. */
const placaDeMoto = (p: string) => /^[A-Z]{2}\d{3}[A-Z]$/.test(p)

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
/** Servidor de placas publicado (Cloudflare Worker de la carpeta /servidor). Vacío = aún no desplegado. */
export const SERVIDOR_PLACAS = 'https://autopublicador-placas.erick-costa.workers.dev'

/**
 * Consulta por placa: 1) servidor propio (si está configurado) → 2) SRI directo desde el navegador → 3) error
 * «sin-acceso» para que la interfaz ofrezca la consulta manual. Nunca se queda sin camino.
 */
export async function consultarSri(placa: string, pedir: Pedir = fetch, ms = 15000, servidor = SERVIDOR_PLACAS): Promise<ConsultaSri> {
  // Dos intentos con el servidor (la primera consulta de una placa reúne varios servicios del SRI y puede tardar)
  for (let intento = 0; servidor && intento < 2; intento++) {
    try {
      const s = await conTiempo(pedir, `${servidor.replace(/\/+$/, '')}/placa/${placa}`, Math.max(ms, 45000))
      if (s.status === 404) throw new ErrorPlaca('no-existe', `El SRI no tiene registrada la placa ${placa}.`)
      if (s.ok) {
        const j = (await s.json()) as Partial<ConsultaSri>
        if (j.base) return { base: j.base, rubros: j.rubros ?? [], pagos: j.pagos ?? [], registrada: j.registrada, componentes: j.componentes ?? [], detallesPago: j.detallesPago ?? [], resumenPagos: j.resumenPagos, impuestoAmbiental: j.impuestoAmbiental ?? [] }
      }
    } catch (e) {
      if (e instanceof ErrorPlaca) throw e
      // servidor sin respuesta: se reintenta una vez y luego se intenta directo
    }
  }
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
  return { base, rubros, pagos: [] }
}

const titulo = (s?: string) => (s ?? '').toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).trim()
    .replace(/(?<=\s)(De|Del|La|Las|Los|Y|E)(?=\s)/g, (m) => m.toLowerCase())
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
    observacion: buscar(/^observacion$/),
    estadoExoneracion: buscar(/^estadoexoneracion$/),
    aplicaCuota: buscar(/^aplicacuota$/) as unknown as boolean,
    verMensajeElectricos: buscar(/^vermensajeelectricos$/) as unknown as boolean,
  } as BaseSri
}

/** Datos técnicos que en la descripción del SRI siguen al nombre del modelo («1.6», «5P», «A/C», «TM», «4X2»…). */
const TECNICO = /^(\d[.,]\d+L?|\d+P|A\/?C|TM|TA|T\/M|T\/A|M\/T|A\/T|4X[24]|CVT|STD|DLX|GL|GLS)$/i
/** Modelo no catalogado: la descripción del SRI hasta el primer dato técnico, respetando códigos («TK 150-7», «F-370»). */
export function modeloDeDescripcion(d: string): string {
  const palabras: string[] = []
  for (const w of d.trim().split(/\s+/).filter(Boolean)) { if (TECNICO.test(w)) break; palabras.push(w) }
  return palabras.slice(0, 3).map((w) => (/\d/.test(w) || w.length <= 3 ? w.toUpperCase() : titulo(w))).join(' ')
}

/** Convierte la respuesta del SRI en hallazgos aplicables (fuente: SRI) y avisos para el vendedor. */
export function interpretarSri(placa: string, crudo: BaseSri, rubros: RubroSri[], pagos: PagoSri[] = [], registrada = placa, extra: ExtraSri = {}): Investigacion {
  const base = normalizarBase(crudo as Record<string, unknown>)
  const fuente = { nombre: `SRI · placa ${registrada}`, url: urlBaseSri(registrada) }
  const h: Hallazgo[] = []
  const avisos: string[] = []
  const add = (campo: Hallazgo['campo'], etiqueta: string, valor: string | undefined, opcion?: string) => {
    if (valor) h.push({ campo, etiqueta, valor, opciones: opcion ? [opcion] : undefined, fuente })
  }
  const marcaSri = (base.descripcionMarca ?? '').trim()
  const marca = ALIAS_MARCA[marcaSri.toLowerCase()] ?? titulo(marcaSri)
  // El modelo del SRI suele traer versión y datos: «AVEO FAMILY AC 1.5 4P 4X2 TM» → se analiza igual que un texto libre
  const a = analizar(`${marca} ${base.descripcionModelo ?? ''}`).vehiculo
  const modelo = a.modelo || modeloDeDescripcion(base.descripcionModelo ?? '')
  add('marca', 'Marca', marca, marca)
  add('modelo', 'Modelo (SRI)', titulo(base.descripcionModelo), modelo)
  if (a.version) add('version', 'Versión', a.version, a.version)
  const anio = String(base.anioAuto ?? '').match(/\d{4}/)?.[0]
  add('anio', 'Año', anio, anio)
  const cc = +String(base.cilindraje ?? '').replace(/\D/g, '')
  const esMoto = /MOTO|CUADR|TRICI/i.test(base.nombreClase ?? '') || placaDeMoto(registrada)
  // Autos: litros («1498 cc» → 1.5); motos: cilindraje en cc («150 cc»)
  if (cc > 0) add('motor', 'Cilindraje', `${cc} cc`, esMoto || cc < 600 ? `${cc} cc` : (Math.round(cc / 100) / 10).toFixed(1))
  else {
    // Cilindraje despejado del impuesto ambiental que el SRI cobró con ese cilindraje (2012-2019)
    const iacv = cilindrajeDesdeIacv(extra.impuestoAmbiental ?? [], +(anio ?? 0))
    const etiqueta = iacv && `Cilindraje: ${iacv.cc} cc (calculado del impuesto ambiental pagado al SRI, ${iacv.anios} ${iacv.anios === 1 ? 'año' : 'años'})`
    // El modelo registrado también puede traerlo («CORSA 5P A/C 1.4L»): si ambos coinciden, mejor
    if (a.motor) {
      add('motor', 'Motor (según el modelo registrado)', a.motor, a.motor)
      if (iacv && litros(iacv.cc) !== a.motor) avisos.push(`El modelo registrado dice motor ${a.motor} pero el impuesto ambiental pagado corresponde a ${iacv.cc} cc (${litros(iacv.cc)}). Verifícalo.`)
      else if (iacv) add(null, 'Confirmado por el impuesto ambiental', `${iacv.cc} cc`)
    } else if (iacv) add('motor', etiqueta as string, `${iacv.cc} cc`, esMoto ? `${iacv.cc} cc` : litros(iacv.cc))
  }
  if (a.transmision) add('transmision', 'Transmisión', a.transmision, a.transmision)
  if (a.puertas) add('puertas', 'Puertas', a.puertas, a.puertas)
  if (a.traccion) add('traccion', 'Tracción', a.traccion, a.traccion)
  // Carrocería escrita en el modelo registrado («ALLEGRO SEDAN 1.6», «N200 VAN PASAJEROS»)
  // (la marca JEEP no es la carrocería «Jeep»)
  if (a.carroceria && !base.nombreClase && a.carroceria.toLowerCase() !== marca.toLowerCase()) add('carroceria', 'Carrocería (según el modelo registrado)', a.carroceria, a.carroceria)
  for (const e of a.equipamiento) add('equipamiento', 'Equipamiento (según el modelo registrado)', e, e)
  const color = titulo(base.colorVehiculo1)
  if (color) add('color', 'Color', color + (base.colorVehiculo2 && base.colorVehiculo2 !== base.colorVehiculo1 ? ` / ${titulo(base.colorVehiculo2)}` : ''), color)
  add('procedencia', 'País de origen', titulo(base.descripcionPais), titulo(base.descripcionPais))
  const clase = (base.nombreClase ?? '').toUpperCase().trim()
  if (clase) add('carroceria', 'Clase', titulo(clase), CLASES[clase] || undefined)
  else if (esMoto) add('carroceria', 'Tipo (por el formato de placa de moto)', 'Moto', 'Moto')
  add(null, 'Servicio', titulo(base.descripcionServicio))
  add(null, 'Matriculado en', titulo(base.descripcionCanton))
  if (base.fechaRevision) add(null, 'Última revisión vehicular', String(base.fechaRevision).slice(0, 10))

  const servicio = (base.descripcionServicio ?? '').toUpperCase()
  if (servicio && !/PARTICULAR/.test(servicio))
    avisos.push(`El SRI registra el servicio «${titulo(servicio)}» (no particular): menciónalo con claridad o revisa el cambio de servicio antes de publicar.`)
  const valor = (r: RubroSri) => +(r.valorRubro ?? 0) || 0
  const pendientes = rubros.filter((r) => valor(r) > 0 && !esTraspaso(r))
  const traspaso = rubros.filter((r) => valor(r) > 0 && esTraspaso(r)).reduce((s, r) => s + valor(r), 0)
  const deuda = pendientes.reduce((s, r) => s + valor(r), 0)
  const pagado = String(base.ultimoAnioPagado ?? '').match(/\d{4}/)?.[0]
  if (pagado) add(null, 'Último año de matrícula pagado', pagado)
  // Desglose (ConsultaComponente): recargos e intereses por atraso dentro de lo pendiente
  const comps = (extra.componentes ?? []).flatMap((c) => c.componentes ?? [])
  const recargos = comps.filter((c) => /RECARGO|INTERES|MULTA/i.test(c.codigoComponente ?? '') && !/TRANSF/i.test(c.codigoComponente ?? ''))
    .reduce((s2, c) => s2 + (+(c.valorComponente ?? 0) || 0), 0)
  if (traspaso > 0) {
    const aT = [...new Set(comps.filter((c) => /TRANSF/i.test(c.codigoComponente ?? '')).map((c) => +(c.anioFiscal ?? 0)).filter(Boolean))].sort()
    const aniosT = aT.length > 1 ? `años ${aT[0]}–${aT[aT.length - 1]}` : aT.length ? `año ${aT[0]}` : ''
    avisos.push(`Transferencia de dominio por pagar en el SRI: $${traspaso.toFixed(2)}${aniosT ? ` (${aniosT})` : ''}. Es el 1 % del traspaso de propiedad, aparte de la matrícula.`)
  }
  // Detalle de pagos (obtenerDetallesPago): años de matrícula cubiertos por los pagos más recientes
  const aniosPagados = [...new Set((extra.detallesPago ?? []).flatMap((d) => d.detalle ?? [])
    .filter((x) => !/TRANSF/i.test(x.descripcionRubro ?? '')).map((x) => x.anio).filter(Boolean))].sort()
  if (aniosPagados.length) add(null, 'Años de matrícula pagados (pagos recientes)', aniosPagados.join(', '))
  const ultimo = [...pagos].filter((p) => /MATR/i.test(p.tipoDeuda ?? '') && p.fechaDePago)
    .sort((x, y) => String(y.fechaDePago).localeCompare(String(x.fechaDePago)))[0]
  if (ultimo) add(null, 'Último pago de matrícula', `${String(ultimo.fechaDePago).slice(0, 10)}${ultimo.monto ? ` · $${(+ultimo.monto).toFixed(2)}` : ''}`)
  if (deuda > 0) {
    add('deuda', 'Valores pendientes de matrícula', `$${deuda.toFixed(2)}`, deuda.toFixed(2))
    // Rango completo de años adeudados («2017–2026»), no solo el último
    const desde = Math.min(...pendientes.map((r) => +(r.anioDesdePago ?? r.anioHastaPago ?? 0) || Infinity))
    const hasta = Math.max(...pendientes.map((r) => +(r.anioHastaPago ?? 0) || 0))
    const anios = hasta ? (Number.isFinite(desde) && desde < hasta ? `${desde}–${hasta}` : String(hasta)) : ''
    avisos.push(`Matrícula${anios ? ` ${anios}` : ''} pendiente en el SRI: $${deuda.toFixed(2)} (${[...new Set(pendientes.map((r) => titulo(r.descripcionRubro)))].join(', ')})${recargos > 0 ? `, incluye $${recargos.toFixed(2)} de recargos e intereses por atraso` : ''}. No se publicará «matrícula al día».`)
  } else if (pagado) {
    add('matricula', 'Matrícula', `Último año pagado: ${pagado}, sin valores pendientes en el SRI`, `Al día ${pagado}`)
  }
  if (base.fechaCaducidadMatricula) add(null, 'Matrícula vigente hasta', base.fechaCaducidadMatricula.slice(0, 10))
  if (base.observacion) add(null, 'Observación del SRI', String(base.observacion).trim())
  const si = (x: unknown) => x === true || /^(s|si|sí|true)$/i.test(String(x ?? '').trim())
  if (si(base.estadoExoneracion))
    avisos.push('El SRI registra el vehículo como EXONERADO (p. ej., por discapacidad): el traspaso puede tener condiciones o impuestos pendientes. Verifícalo en el SRI antes de publicar.')
  if (si(base.verMensajeElectricos)) add(null, 'Tipo de vehículo según el SRI', 'Eléctrico')
  if (si(base.aplicaCuota)) add(null, 'Impuesto ambiental', 'Aplica pago en cuotas (según el SRI)')
  // Resumen de todo el historial de pagos: cuántas veces se pagó un traspaso de dominio y desde cuándo hay pagos
  const rp = extra.resumenPagos
  if (rp?.totalPagos) add(null, 'Pagos registrados en el SRI', `${rp.totalPagos}${rp.primerPago ? ` (desde ${rp.primerPago.slice(0, 4)})` : ''}`)
  if (rp && rp.totalPagos) add(null, 'Traspasos de dominio pagados (historial del SRI)', rp.traspasos ? `${rp.traspasos}${rp.ultimoTraspaso ? `, el último el ${rp.ultimoTraspaso}` : ''}` : 'Ninguno registrado')
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
