// Publicaciones a partir de una lista de placas: para cada placa se consulta el SRI (servidor de placas), se investiga
// el modelo en Wikipedia y se generan título y descripción con las mismas plantillas de la app. Mismo flujo que una
// consulta individual; nada se inventa: lo que no aparece en las fuentes queda vacío.
import { fusionar } from '../dominio/fusion'
import { descripciones, titulos } from '../dominio/plantillas'
import { VEHICULO_VACIO, type Ajustes, type Origenes, type Perfil, type Vehiculo } from '../dominio/tipos'
import type { PlacaConsultada, Publicacion } from './almacen'
import { investigarWikipedia, type Investigacion } from './investigador'
import { consultarSri, interpretarSri, normalizarPlaca, placaValida, resumenDePlaca, SERVIDOR_PLACAS } from './placa'

type Pedir = (url: string, init?: RequestInit) => Promise<Response>

export interface ResultadoLote {
  placa: string
  ok: boolean
  error?: string
  vehiculo?: Vehiculo
  origenes?: Origenes
  sri?: Investigacion
  wikipedia?: Investigacion | null
  publicacion?: Publicacion
  placaConsultada?: PlacaConsultada
}

/** «PVS067, MCY0327 HAK-0679\nPUB0356» → placas válidas normalizadas, sin repetir. */
export function placasDeTexto(texto: string): { validas: string[]; invalidas: string[] } {
  const tokens = texto.toUpperCase().split(/[\s,;.]+/).map(normalizarPlaca).filter(Boolean)
  const validas = [...new Set(tokens.filter(placaValida))]
  return { validas, invalidas: tokens.filter((t) => !placaValida(t)) }
}

export async function publicacionDePlaca(placa: string, perfil: Perfil, ajustes: Ajustes, pedir: Pedir = fetch): Promise<ResultadoLote> {
  try {
    const c = await consultarSri(placa, pedir, 15000, ajustes.servidorPlacas || SERVIDOR_PLACAS)
    const sri = interpretarSri(placa, c.base, c.rubros, c.pagos, c.registrada || placa,
      { componentes: c.componentes, detallesPago: c.detallesPago, resumenPagos: c.resumenPagos })
    let f = fusionar(VEHICULO_VACIO, {}, sri, 'sri')
    const wikipedia = f.vehiculo.modelo ? await investigarWikipedia(f.vehiculo, pedir).catch(() => null) : null
    if (wikipedia) f = fusionar(f.vehiculo, f.origenes, wikipedia, 'wikipedia')
    const ctx = { v: f.vehiculo, perfil, beneficios: ajustes.beneficios, ubicacion: ajustes.ubicacion }
    const fecha = new Date().toISOString()
    const publicacion: Publicacion = {
      id: crypto.randomUUID(), fecha, texto: `Placa ${placa}`, vehiculo: f.vehiculo, origenes: f.origenes,
      titulo: titulos(ctx)[0]?.texto ?? '', descripcion: descripciones(ctx)[0]?.texto ?? '', placa,
    }
    return { placa, ok: true, vehiculo: f.vehiculo, origenes: f.origenes, sri, wikipedia, publicacion,
      placaConsultada: { placa, fecha, resumen: resumenDePlaca(sri), resultado: sri } }
  } catch (e) {
    return { placa, ok: false, error: (e as Error).message }
  }
}

/** Procesa las placas de una en una (el SRI no recibe ráfagas) e informa el avance. */
export async function procesarLote(placas: string[], perfil: Perfil, ajustes: Ajustes, avance?: (hechos: number, r: ResultadoLote) => void, pedir: Pedir = fetch) {
  const resultados: ResultadoLote[] = []
  for (const p of placas) {
    const r = await publicacionDePlaca(p, perfil, ajustes, pedir)
    resultados.push(r)
    avance?.(resultados.length, r)
  }
  return resultados
}
