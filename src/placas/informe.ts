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
export interface RespuestaConsulta { placa: string; consultado: string; sri: SriConsulta; atm: AtmConsulta }

export type EstadoDato = 'coincide' | 'difiere' | 'solo-sri' | 'solo-atm'
export interface Comparacion { dato: string; sri: string; atm: string; estado: EstadoDato }
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

/** Compara marca, modelo y año entre el SRI y ATM. */
export function compararFuentes(r: RespuestaConsulta): Comparacion[] {
  const b = r.sri.encontrada ? r.sri.base ?? {} : {}
  const t = r.atm.encontrada ? r.atm : ({} as AtmConsulta)
  const filas: [string, string, string, (x: string, y: string) => boolean][] = [
    ['Marca', String(b.descripcionMarca ?? ''), t.marca ?? '', (x, y) => marcaCanonica(x) === marcaCanonica(y)],
    ['Modelo', String(b.descripcionModelo ?? ''), t.modelo ?? '', mismoModelo],
    ['Año', String(b.anioAuto ?? '').match(/\d{4}/)?.[0] ?? '', t.anio ?? '', (x, y) => x === y],
  ]
  return filas.filter(([, x, y]) => x || y).map(([dato, x, y, igual]) => ({
    dato, sri: x, atm: y,
    estado: x && y ? (igual(x, y) ? 'coincide' : 'difiere') : x ? 'solo-sri' : 'solo-atm',
  }))
}

export function nivelDeVerificacion(r: RespuestaConsulta, c = compararFuentes(r)): Nivel {
  if (!r.sri.encontrada && !r.atm.encontrada) return 'no-encontrada'
  if (r.sri.encontrada && r.atm.encontrada) return c.some((x) => x.estado === 'difiere') ? 'revisar' : 'verificada'
  return 'una-fuente'
}

export const NIVELES: Record<Nivel, { titulo: string; texto: string }> = {
  verificada: { titulo: 'Datos verificados en 2 fuentes oficiales', texto: 'Marca, modelo y año coinciden entre el SRI y la ATM.' },
  revisar: { titulo: 'Las fuentes no coinciden', texto: 'Hay datos distintos entre el SRI y la ATM: revisa la matrícula física antes de comprar o publicar.' },
  'una-fuente': { titulo: 'Datos de una sola fuente', texto: 'Solo una fuente oficial respondió con datos de esta placa.' },
  'no-encontrada': { titulo: 'Placa no encontrada', texto: 'Ni el SRI ni la ATM tienen registrada esta placa.' },
}

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

/** Consultas oficiales que no permiten leerse desde otra página: se abren en su sitio con la placa copiada. */
export const FUENTES_MANUALES = [
  { nombre: 'ANT · Citaciones y puntos', detalle: 'Multas de tránsito a nivel nacional (ANT y CTE).', url: 'https://consultaweb.ant.gob.ec/PortalWEB/paginas/clientes/clp_criterio_consulta.jsp' },
  { nombre: 'AMT Quito · Historial de revisión técnica', detalle: 'Fechas y resultados de la RTV en Quito.', url: 'https://web.amt.gob.ec/web/historialRtv/' },
  { nombre: 'AMT Quito · Valores a pagar', detalle: 'Infracciones de la Agencia Metropolitana de Tránsito.', url: 'https://www.amt.gob.ec/index.php/servicios/servicios-en-linea/' },
  { nombre: 'CTE · Infracciones', detalle: 'Comisión de Tránsito del Ecuador (vías estatales).', url: 'https://servicios.axiscloud.ec/AutoServicio/inicio.jsp?ps_empresa=16&ps_accion=P55' },
  { nombre: 'SRI · Valores a pagar', detalle: 'La misma consulta del SRI, en su sitio oficial.', url: SRI_PAGINA },
]

/** Informe en texto plano, para copiar o enviar por WhatsApp. */
export function informeTexto(r: RespuestaConsulta): string {
  const c = compararFuentes(r)
  const n = nivelDeVerificacion(r, c)
  const b = r.sri.base
  const l: string[] = [`INFORME DE PLACA ${r.placa}`, `Consultado: ${new Date(r.consultado).toLocaleString('es-EC')}`, `Verificación: ${NIVELES[n].titulo}`, '']
  for (const x of c) l.push(`${x.dato}: ${x.sri || x.atm}${x.estado === 'difiere' ? ` (SRI: ${x.sri} · ATM: ${x.atm})` : ''}`)
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
  for (const a of inter?.avisos ?? []) l.push(`⚠ ${a}`)
  l.push('', 'Fuentes: SRI (srienlinea.sri.gob.ec) y ATM Guayaquil (consultas.atm.gob.ec).')
  return l.join('\n')
}
