// Consulta de placas: convierte la respuesta del servidor (/consulta/PLACA: SRI + ATM Guayaquil) en un informe:
// verificación cruzada entre fuentes, valores pendientes, historial y texto listo para copiar.
// Solo datos del VEHÍCULO: el servidor ya quita cualquier dato del propietario.
import { ALIAS_MARCA } from '../dominio/catalogo'
import { interpretarSri, SRI_PAGINA, type BaseSri, type ComponentesSri, type DetallePagoSri, type PagoSri, type ResumenPagosSri, type RubroSri } from '../servicios/placa'
import type { LineaIacv } from '../dominio/impuestoAmbiental'
import type { Investigacion } from '../servicios/investigador'

export interface SriConsulta {
  encontrada: boolean
  error?: string
  registrada?: string
  base?: BaseSri & { numeroPlaca?: string; numeroCamvCpn?: string; fechaCompraRegistro?: string; mensajeMotivoAuto?: string }
  rubros?: RubroSri[]
  pagos?: PagoSri[]
  componentes?: ComponentesSri[]
  detallesPago?: DetallePagoSri[]
  planExcepcional?: Record<string, unknown>[]
  resumenPagos?: ResumenPagosSri
  impuestoAmbiental?: LineaIacv[]
}
export interface RevisionAtm { observacion: string; fecha: string; estado: string; revision: number | null }
export interface AtmConsulta { encontrada: boolean; error?: string; registrada?: string; marca?: string; modelo?: string; anio?: string; revisiones?: RevisionAtm[]; desde?: number; hasta?: number }
/** Medición de la revisión técnica de la AMT (defecto = no salió «OK»). */
export interface MedicionAmt { tipo: string; elemento: string; resultado: string; defecto: boolean; valor: string | null; nota: string | null }
export interface RevisionAmt { fecha: string | null; vence: string | null; estado: string; centro: string | null; intento: number | null; kilometraje: number | null; certificado: string | null; pruebas: number; defectos: MedicionAmt[]; mediciones?: MedicionAmt[] }
export interface AmtConsulta {
  encontrada: boolean
  error?: string
  registrada?: string
  vehiculo?: { marca: string | null; modelo: string | null; anio: string | null; tipo: string | null; subtipo: string | null; placaAnterior: string | null; chasis: string | null; motor: string | null }
  revisiones?: RevisionAmt[]
}
/** `amt` llega aparte (ruta /amt): undefined = no se pudo consultar. */
export interface RespuestaConsulta { placa: string; consultado: string; sri: SriConsulta; atm: AtmConsulta; amt?: AmtConsulta }

export type Fuente = 'sri' | 'atm' | 'amt'
export const NOMBRE_FUENTE: Record<Fuente, string> = { sri: 'SRI', atm: 'ATM', amt: 'AMT' }
export type EstadoDato = 'coincide' | 'difiere' | 'una-fuente'
export interface Comparacion { dato: string; valores: Partial<Record<Fuente, string>>; estado: EstadoDato }
export type Nivel = 'verificada' | 'revisar' | 'una-fuente' | 'no-encontrada'

const limpio = (s?: string | number | null) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
const marcaCanonica = (s?: string) => limpio(ALIAS_MARCA[String(s ?? '').trim().toLowerCase()] ?? s)

/**
 * ATM corta el modelo a unos 15 caracteres («GRAND VITARA 2.» frente a «GRAND VITARA 2.0L 5P STD TM 4X2» del SRI):
 * coinciden si uno empieza por el otro, palabra a palabra (la última palabra de ATM puede estar cortada).
 */
export function mismoModelo(sri?: string, atm?: string): boolean {
  const a = limpio(sri).split(' ').filter(Boolean)
  const b = limpio(atm).split(' ').filter(Boolean)
  if (!a.length || !b.length) return false
  const [corto, largo] = a.join(' ').length <= b.join(' ').length ? [a, b] : [b, a]
  return corto.every((w, i) => (i === corto.length - 1 ? (largo[i] ?? '').startsWith(w) : largo[i] === w))
}

/** Fuentes que respondieron con datos de la placa. */
export function fuentesConDatos(r: RespuestaConsulta): Fuente[] {
  return (['sri', 'atm', 'amt'] as Fuente[]).filter((f) => r[f]?.encontrada)
}

/** Compara marca, modelo y año entre el SRI, la ATM (Guayaquil) y la AMT (Quito). */
export function compararFuentes(r: RespuestaConsulta): Comparacion[] {
  const b = r.sri.encontrada ? r.sri.base ?? {} : {}
  const t = r.atm.encontrada ? r.atm : ({} as AtmConsulta)
  const q = r.amt?.encontrada ? r.amt.vehiculo ?? null : null
  const anio = (x: unknown) => String(x ?? '').match(/\d{4}/)?.[0] ?? ''
  const filas: [string, Partial<Record<Fuente, string>>, (x: string, y: string) => boolean][] = [
    ['Marca', { sri: String(b.descripcionMarca ?? ''), atm: t.marca ?? '', amt: q?.marca ?? '' }, (x, y) => marcaCanonica(x) === marcaCanonica(y)],
    ['Modelo', { sri: String(b.descripcionModelo ?? ''), atm: t.modelo ?? '', amt: q?.modelo ?? '' }, mismoModelo],
    ['Año', { sri: anio(b.anioAuto), atm: anio(t.anio), amt: anio(q?.anio) }, (x, y) => x === y],
  ]
  return filas.map(([dato, crudos, igual]) => {
    const valores = Object.fromEntries(Object.entries(crudos).filter(([, v]) => v)) as Partial<Record<Fuente, string>>
    const v = Object.values(valores) as string[]
    const estado: EstadoDato = v.length < 2 ? 'una-fuente' : v.every((x, i) => v.slice(i + 1).every((y) => igual(x, y))) ? 'coincide' : 'difiere'
    return { dato, valores, estado }
  }).filter((c) => Object.keys(c.valores).length)
}

export function nivelDeVerificacion(r: RespuestaConsulta, c = compararFuentes(r)): Nivel {
  const n = fuentesConDatos(r).length
  if (!n) return 'no-encontrada'
  if (n === 1) return 'una-fuente'
  return c.some((x) => x.estado === 'difiere') ? 'revisar' : 'verificada'
}

export function textoNivel(r: RespuestaConsulta, nivel = nivelDeVerificacion(r)): { titulo: string; texto: string } {
  const f = fuentesConDatos(r).map((x) => NOMBRE_FUENTE[x])
  const lista = f.length > 1 ? `${f.slice(0, -1).join(', ')} y ${f.at(-1)}` : f[0]
  return {
    verificada: { titulo: `Datos verificados en ${f.length} fuentes oficiales`, texto: `Marca, modelo y año coinciden entre ${lista}.` },
    revisar: { titulo: 'Las fuentes no coinciden', texto: `Hay datos distintos entre ${lista}: revisa la matrícula física antes de comprar o publicar.` },
    'una-fuente': { titulo: 'Datos de una sola fuente', texto: `Solo ${lista} respondió con datos de esta placa.` },
    'no-encontrada': { titulo: 'Placa no encontrada', texto: 'Ninguna fuente oficial tiene registrada esta placa.' },
  }[nivel]
}

/**
 * Historial del odómetro según las revisiones técnicas de la AMT (más antiguo primero). Un «retroceso» es una lectura
 * menor que la anterior: posible cambio de tablero o adulteración del kilometraje.
 */
export function kilometraje(amt?: AmtConsulta) {
  const lecturas = (amt?.revisiones ?? []).filter((r) => r.fecha && r.kilometraje).map((r) => ({ fecha: r.fecha as string, km: r.kilometraje as number }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  const retrocesos = lecturas.slice(1).flatMap((l, i) => (l.km < lecturas[i].km ? [{ antes: lecturas[i], despues: l }] : []))
  const primera = lecturas[0], ultima = lecturas.at(-1)
  const anios = primera && ultima ? (Date.parse(ultima.fecha) - Date.parse(primera.fecha)) / (365.25 * 864e5) : 0
  const porAnio = anios >= 1 && ultima && primera && ultima.km > primera.km ? Math.round((ultima.km - primera.km) / anios) : null
  return { lecturas, retrocesos, ultima, porAnio }
}

export const km = (n: number) => `${n.toLocaleString('es-EC')} km`

const valor = (n?: number) => +(n ?? 0) || 0
const esTraspaso = (x: RubroSri) => /TRANSF/i.test(`${x.codigoTipoDeuda ?? ''} ${x.descripcionRubro ?? ''}`)

/** Valores pendientes en el SRI: matrícula (sin el traspaso), transferencia de dominio y recargos incluidos. */
export function valoresPendientes(sri: SriConsulta) {
  const rubros = (sri.rubros ?? []).filter((x) => valor(x.valorRubro) > 0)
  const matricula = rubros.filter((x) => !esTraspaso(x)).reduce((s, x) => s + valor(x.valorRubro), 0)
  const traspaso = rubros.filter(esTraspaso).reduce((s, x) => s + valor(x.valorRubro), 0)
  const recargos = (sri.componentes ?? []).flatMap((c) => c.componentes ?? [])
    .filter((c) => /RECARGO|INTERES|MULTA/i.test(c.codigoComponente ?? '')).reduce((s, c) => s + valor(c.valorComponente), 0)
  return { rubros, matricula, traspaso, recargos, total: matricula + traspaso }
}

/** Hallazgos y avisos ya interpretados (cilindraje por impuesto ambiental, prohibición de enajenar, servicio…). */
export function interpretacion(r: RespuestaConsulta): Investigacion | null {
  const s = r.sri
  if (!s.encontrada || !s.base) return null
  return interpretarSri(r.placa, s.base, s.rubros ?? [], s.pagos ?? [], s.registrada ?? r.placa,
    { componentes: s.componentes, detallesPago: s.detallesPago, resumenPagos: s.resumenPagos, impuestoAmbiental: s.impuestoAmbiental })
}

export const dinero = (n: number) => `$${n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const fecha = (s?: string | null) => {
  const m = String(s ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s ?? '')
}

/**
 * Consultas oficiales que no se pueden leer automáticamente (captcha o servicio caído): se abren en su sitio con la
 * placa copiada. `amt` marca la que sobra cuando el servidor sí obtuvo el historial de la AMT.
 */
export const FUENTES_MANUALES = [
  { nombre: 'CTE · Citaciones', detalle: 'Infracciones de la Comisión de Tránsito del Ecuador. Pide un captcha.', url: 'https://servicios.axiscloud.ec/AutoServicio/inicio.jsp?ps_empresa=16&ps_accion=P55' },
  { nombre: 'ANT · Citaciones y puntos', detalle: 'Multas a nivel nacional. Su servicio estuvo caído (noviembre de 2026).', url: 'https://consultaweb.ant.gob.ec/PortalWEB/paginas/clientes/clp_criterio_consulta.jsp' },
  { nombre: 'AMT Quito · Valores a pagar', detalle: 'Infracciones de la Agencia Metropolitana de Tránsito.', url: 'https://www.amt.gob.ec/index.php/servicios/servicios-en-linea/' },
  { nombre: 'AMT Quito · Historial de revisión técnica', detalle: 'Fechas, resultados y kilometraje de la RTV en Quito.', url: 'https://web.amt.gob.ec/web/historialRtv/', amt: true },
  { nombre: 'SRI · Valores a pagar', detalle: 'La misma consulta del SRI, en su sitio oficial.', url: SRI_PAGINA },
]

/** Avisos del SRI más los de la revisión técnica (no se presentó a la última, defectos peligrosos o graves pendientes). */
export function avisosDe(r: RespuestaConsulta, inter = interpretacion(r)): string[] {
  const a = [...(inter?.avisos ?? [])]
  const revs = r.amt?.encontrada ? r.amt.revisiones ?? [] : []
  const ultima = revs[0]
  if (ultima && !ultima.fecha) a.push(`La AMT registra que el vehículo NO se presentó a la revisión técnica que vencía el ${fecha(ultima.vence)}.`)
  const ultimaHecha = revs.find((x) => x.fecha)
  const graves = (ultimaHecha?.defectos ?? []).filter((d) => /GRAVE|PELIGRO/i.test(d.resultado))
  if (ultimaHecha && graves.length && !/APROB/i.test(ultimaHecha.estado))
    a.push(`La última revisión técnica (${fecha(ultimaHecha.fecha)}) quedó «${ultimaHecha.estado}» con ${graves.length} defecto(s) grave(s): ${graves.map((d) => d.elemento.toLowerCase()).join(', ')}.`)
  return a
}

/** Informe en texto plano, para copiar o enviar por WhatsApp. */
export function informeTexto(r: RespuestaConsulta): string {
  const c = compararFuentes(r)
  const n = nivelDeVerificacion(r, c)
  const b = r.sri.base
  const l: string[] = [`INFORME DE PLACA ${r.placa}`, `Consultado: ${new Date(r.consultado).toLocaleString('es-EC')}`, `Verificación: ${textoNivel(r, n).titulo}`, '']
  for (const x of c) {
    const v = Object.entries(x.valores) as [Fuente, string][]
    l.push(`${x.dato}: ${v[0][1]}${x.estado === 'difiere' ? ` (${v.map(([f, y]) => `${NOMBRE_FUENTE[f]}: ${y}`).join(' · ')})` : ''}`)
  }
  const q = r.amt?.encontrada ? r.amt.vehiculo : null
  if (q?.tipo) l.push(`Tipo (AMT): ${[q.tipo, q.subtipo].filter(Boolean).join(' · ')}`)
  if (r.sri.encontrada && b) {
    const extra: [string, unknown][] = [['País de origen', b.descripcionPais], ['Clase', b.nombreClase], ['Servicio', b.descripcionServicio], ['Cantón', b.descripcionCanton], ['Último año pagado', b.ultimoAnioPagado]]
    for (const [k, v] of extra) if (v) l.push(`${k}: ${v}`)
  }
  const inter = interpretacion(r)
  const cc = inter?.hallazgos.find((h) => h.campo === 'motor')
  if (cc) l.push(`${cc.etiqueta}: ${cc.valor}`)
  if (r.sri.encontrada) {
    const v = valoresPendientes(r.sri)
    l.push('', v.total > 0 ? `Valores pendientes en el SRI: ${dinero(v.total)}` : 'Sin valores pendientes en el SRI')
    for (const x of v.rubros) l.push(`  · ${x.descripcionRubro} ${x.anioDesdePago && x.anioDesdePago !== x.anioHastaPago ? `${x.anioDesdePago}–` : ''}${x.anioHastaPago ?? ''}: ${dinero(valor(x.valorRubro))}`)
    const rp = r.sri.resumenPagos
    if (rp?.totalPagos) l.push(`Pagos registrados: ${rp.totalPagos} · Traspasos de dominio: ${rp.traspasos ?? 0}${rp.ultimoTraspaso ? ` (último ${fecha(rp.ultimoTraspaso)})` : ''}`)
  }
  const rev = r.atm.revisiones ?? []
  if (r.atm.encontrada) l.push(rev.length ? `Revisión técnica ATM: ${rev.length} registro(s), la última el ${fecha(rev[0].fecha)} (${rev[0].estado})` : 'Revisión técnica ATM: sin registros en Guayaquil')
  if (r.amt?.encontrada) {
    const revs = (r.amt.revisiones ?? []).filter((x) => x.fecha)
    const k = kilometraje(r.amt)
    l.push(revs.length ? `Revisión técnica AMT Quito: ${revs.length} presentada(s), la última el ${fecha(revs[0].fecha)} (${revs[0].estado})` : 'Revisión técnica AMT Quito: sin revisiones presentadas')
    if (k.ultima) l.push(`Kilometraje registrado: ${km(k.ultima.km)} (${fecha(k.ultima.fecha)})${k.porAnio ? ` · promedio ${km(k.porAnio)} por año` : ''}`)
    for (const x of k.retrocesos) l.push(`⚠ El kilometraje bajó de ${km(x.antes.km)} (${fecha(x.antes.fecha)}) a ${km(x.despues.km)} (${fecha(x.despues.fecha)})`)
  }
  for (const a of avisosDe(r, inter)) l.push(`⚠ ${a}`)
  l.push('', `Fuentes: ${['SRI (srienlinea.sri.gob.ec)', 'ATM Guayaquil (consultas.atm.gob.ec)', r.amt?.encontrada ? 'AMT Quito (web.amt.gob.ec)' : ''].filter(Boolean).join(', ')}.`)
  return l.join('\n')
}
