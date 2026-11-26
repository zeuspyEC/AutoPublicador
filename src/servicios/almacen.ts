// Datos guardados en este navegador (localStorage): perfil del vendedor, ajustes, borrador e historial.
// No hay servidor: nada sale del teléfono o computador del vendedor (salvo las consultas de investigación).
import type { Investigacion } from './investigador'
import type { Seleccion } from '../dominio/retoques'
import { unirRespaldo, type Respaldo } from '../dominio/respaldo'
import { hablaDePagos, BENEFICIOS_PREDETERMINADOS, UBICACION_PREDETERMINADA, type Ajustes, type Origenes, type Perfil, type Vehiculo } from '../dominio/tipos'

export interface Publicacion {
  id: string
  fecha: string
  texto: string
  vehiculo: Vehiculo
  origenes: Origenes
  titulo: string
  descripcion: string
  seleccion?: Seleccion // plantillas elegidas y retoques: con esto el texto se mantiene al día
  placa?: string // si se creó desde una placa (consulta individual o «Varias placas»)
  estado?: EstadoVenta // sin estado = disponible
}

export type EstadoVenta = 'disponible' | 'reservado' | 'vendido'

/** Placa consultada en el SRI: se guarda para reutilizarla sin volver a consultar. */
export interface PlacaConsultada {
  placa: string
  fecha: string
  resumen: string // «Chevrolet Aveo Family 2015 · Plateado»
  resultado: Investigacion
  sinRespuesta?: string // motivo: el SRI no devolvió datos (placa mal digitada, inexistente o sin conexión)
}

export interface Borrador { texto: string; vehiculo: Vehiculo; origenes: Origenes; id?: string; placa?: string; seleccion?: Seleccion }

const CLAVES = { perfil: 'ap.perfil', ajustes: 'ap.ajustes', historial: 'ap.historial', borrador: 'ap.borrador', placas: 'ap.placas' }

function leer<T>(clave: string): T | null {
  try { const s = localStorage.getItem(clave); return s ? (JSON.parse(s) as T) : null } catch { return null }
}
function escribir(clave: string, valor: unknown) {
  try { localStorage.setItem(clave, JSON.stringify(valor)) } catch { /* modo privado o sin espacio: se sigue sin guardar */ }
}

/** La clave de Google no viaja en los respaldos (se pegan en chats o se guardan en archivos). */
const sinClave = (a: Ajustes | null) => (a ? { ...a, claveGemini: '' } : null)

export const almacen = {
  perfil: () => leer<Perfil>(CLAVES.perfil),
  guardarPerfil: (p: Perfil) => escribir(CLAVES.perfil, p),

  ajustes: (): Ajustes => {
    const a = leer<Partial<Ajustes>>(CLAVES.ajustes) ?? {}
    return { beneficios: (a.beneficios ?? BENEFICIOS_PREDETERMINADOS).filter((b) => !hablaDePagos(b.texto)), claveGemini: a.claveGemini ?? '', ubicacion: a.ubicacion || UBICACION_PREDETERMINADA, servidorPlacas: a.servidorPlacas ?? '', etiquetas: a.etiquetas ?? [], tema: a.tema ?? 'sistema', letra: a.letra ?? 'normal', respuestas: a.respuestas ?? [] }
  },
  guardarAjustes: (a: Ajustes) => escribir(CLAVES.ajustes, a),

  historial: () => leer<Publicacion[]>(CLAVES.historial) ?? [],
  guardarEnHistorial: (p: Publicacion) => {
    const h = almacen.historial().filter((x) => x.id !== p.id)
    escribir(CLAVES.historial, [p, ...h].slice(0, 200))
  },
  /** Actualiza una publicación ya guardada sin cambiar su lugar en la lista. */
  actualizarEnHistorial: (p: Publicacion) => escribir(CLAVES.historial, almacen.historial().map((x) => (x.id === p.id ? { ...p, fecha: x.fecha, estado: x.estado } : x))),
  /** Vuelve a dejar el historial tal como estaba (para «Deshacer»). */
  reponerHistorial: (lista: Publicacion[]) => escribir(CLAVES.historial, lista),
  reponerPlacas: (lista: PlacaConsultada[]) => escribir(CLAVES.placas, lista),
  cambiarEstado: (id: string, estado: EstadoVenta) => escribir(CLAVES.historial, almacen.historial().map((x) => (x.id === id ? { ...x, estado } : x))),
  borrarDeHistorial: (id: string) => escribir(CLAVES.historial, almacen.historial().filter((x) => x.id !== id)),

  placas: () => leer<PlacaConsultada[]>(CLAVES.placas) ?? [],
  guardarPlaca: (p: PlacaConsultada) => escribir(CLAVES.placas, [p, ...almacen.placas().filter((x) => x.placa !== p.placa)].slice(0, 300)),
  /** Placa sin respuesta: se recuerda vacía, sin pisar nunca los datos que ya se hubieran obtenido. */
  guardarPlacaSinRespuesta: (placa: string, motivo: string) => {
    if (almacen.placas().some((x) => x.placa === placa && !x.sinRespuesta)) return
    almacen.guardarPlaca({ placa, fecha: new Date().toISOString(), resumen: '', sinRespuesta: motivo, resultado: { resumen: '', hallazgos: [], avisos: [], fuentes: [] } })
  },
  borrarPlaca: (placa: string) => escribir(CLAVES.placas, almacen.placas().filter((x) => x.placa !== placa)),

  borrador: () => leer<Borrador>(CLAVES.borrador),
  guardarBorrador: (b: Borrador) => escribir(CLAVES.borrador, b),

  /** Copia de seguridad de todo lo guardado (para pasar los datos a otro teléfono, navegador o a la app instalada). */
  respaldo: (): Respaldo => ({ app: 'AutoPublicador', version: 1, fecha: new Date().toISOString(), perfil: almacen.perfil(), ajustes: sinClave(leer<Ajustes>(CLAVES.ajustes)), historial: almacen.historial(), placas: almacen.placas() }),
  /** Restaura un respaldo sin perder lo que ya hay: se suman las publicaciones y placas que falten. */
  restaurar: (r: Respaldo) => {
    const u = unirRespaldo(r, { perfil: almacen.perfil(), ajustes: leer<Ajustes>(CLAVES.ajustes), historial: almacen.historial(), placas: almacen.placas() })
    if (u.perfil) escribir(CLAVES.perfil, u.perfil)
    if (u.ajustes) escribir(CLAVES.ajustes, u.ajustes)
    escribir(CLAVES.historial, u.historial)
    escribir(CLAVES.placas, u.placas)
    return u
  },

  borrarTodo: () => Object.values(CLAVES).forEach((c) => { try { localStorage.removeItem(c) } catch { /* nada */ } }),
}

/** Copia al portapapeles (con alternativa para navegadores que no permiten la API moderna). */
export async function copiar(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true } catch {
    const t = document.createElement('textarea')
    t.value = texto; t.style.position = 'fixed'; t.style.opacity = '0'
    document.body.appendChild(t); t.select()
    const ok = document.execCommand('copy')
    t.remove()
    return ok
  }
}
