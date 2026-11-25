// Datos guardados en este navegador (localStorage): perfil del vendedor, ajustes, borrador e historial.
// No hay servidor: nada sale del teléfono o computador del vendedor (salvo las consultas de investigación).
import type { Investigacion } from './investigador'
import { hablaDePagos, BENEFICIOS_PREDETERMINADOS, UBICACION_PREDETERMINADA, type Ajustes, type Origenes, type Perfil, type Vehiculo } from '../dominio/tipos'

export interface Publicacion {
  id: string
  fecha: string
  texto: string
  vehiculo: Vehiculo
  origenes: Origenes
  titulo: string
  descripcion: string
  placa?: string // si se creó desde una placa (consulta individual o «Varias placas»)
}

/** Placa consultada en el SRI: se guarda para reutilizarla sin volver a consultar. */
export interface PlacaConsultada {
  placa: string
  fecha: string
  resumen: string // «Chevrolet Aveo Family 2015 · Plateado»
  resultado: Investigacion
  sinRespuesta?: string // motivo: el SRI no devolvió datos (placa mal digitada, inexistente o sin conexión)
}

const CLAVES = { perfil: 'ap.perfil', ajustes: 'ap.ajustes', historial: 'ap.historial', borrador: 'ap.borrador', placas: 'ap.placas' }

function leer<T>(clave: string): T | null {
  try { const s = localStorage.getItem(clave); return s ? (JSON.parse(s) as T) : null } catch { return null }
}
function escribir(clave: string, valor: unknown) {
  try { localStorage.setItem(clave, JSON.stringify(valor)) } catch { /* modo privado o sin espacio: se sigue sin guardar */ }
}

export const almacen = {
  perfil: () => leer<Perfil>(CLAVES.perfil),
  guardarPerfil: (p: Perfil) => escribir(CLAVES.perfil, p),

  ajustes: (): Ajustes => {
    const a = leer<Partial<Ajustes>>(CLAVES.ajustes) ?? {}
    return { beneficios: (a.beneficios ?? BENEFICIOS_PREDETERMINADOS).filter((b) => !hablaDePagos(b.texto)), claveGemini: a.claveGemini ?? '', ubicacion: a.ubicacion || UBICACION_PREDETERMINADA, servidorPlacas: a.servidorPlacas ?? '' }
  },
  guardarAjustes: (a: Ajustes) => escribir(CLAVES.ajustes, a),

  historial: () => leer<Publicacion[]>(CLAVES.historial) ?? [],
  guardarEnHistorial: (p: Publicacion) => {
    const h = almacen.historial().filter((x) => x.id !== p.id)
    escribir(CLAVES.historial, [p, ...h].slice(0, 200))
  },
  borrarDeHistorial: (id: string) => escribir(CLAVES.historial, almacen.historial().filter((x) => x.id !== id)),

  placas: () => leer<PlacaConsultada[]>(CLAVES.placas) ?? [],
  guardarPlaca: (p: PlacaConsultada) => escribir(CLAVES.placas, [p, ...almacen.placas().filter((x) => x.placa !== p.placa)].slice(0, 300)),
  /** Placa sin respuesta: se recuerda vacía, sin pisar nunca los datos que ya se hubieran obtenido. */
  guardarPlacaSinRespuesta: (placa: string, motivo: string) => {
    if (almacen.placas().some((x) => x.placa === placa && !x.sinRespuesta)) return
    almacen.guardarPlaca({ placa, fecha: new Date().toISOString(), resumen: '', sinRespuesta: motivo, resultado: { resumen: '', hallazgos: [], avisos: [], fuentes: [] } })
  },
  borrarPlaca: (placa: string) => escribir(CLAVES.placas, almacen.placas().filter((x) => x.placa !== placa)),

  borrador: () => leer<{ texto: string; vehiculo: Vehiculo; origenes: Origenes }>(CLAVES.borrador),
  guardarBorrador: (b: { texto: string; vehiculo: Vehiculo; origenes: Origenes }) => escribir(CLAVES.borrador, b),

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
