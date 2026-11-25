// Etiquetas del vehículo: única fuente de lo que cada casilla permite decir. Si una etiqueta se quita, ninguna plantilla
// (título, descripción ni respuesta) puede seguir mencionándola; si se marca, todas las descripciones la llevan.
import { hablaDePagos, type Beneficio, type Vehiculo } from './tipos'

type Casilla = 'negociable' | 'recibeCambio' | 'ceroMultas' | 'aTodaPrueba' | 'fullEquipo'

export interface EtiquetaFija {
  campo: Casilla
  nombre: string
  linea: string // texto que se agrega si la plantilla aún no la menciona
  menciona: RegExp // frases que la afirman
  sinMarcar?: { nombre: string; linea: string; menciona: RegExp } // lo que se dice cuando no está marcada
}

export const ETIQUETAS: EtiquetaFija[] = [
  { campo: 'negociable', nombre: 'Negociable', linea: '🤝 Precio negociable.', menciona: /negociable|conversable|escucho ofertas|rebaja|descuento/i,
    sinMarcar: { nombre: 'Precio fijo', linea: '🔒 Precio fijo.', menciona: /precio fijo/i } },
  { campo: 'recibeCambio', nombre: 'Recibe cambio', linea: '🔄 Recibimos tu auto o moto como parte de pago.', menciona: /parte de pago|vendo ?(?:\/\/|o) ?cambio|se cambia|recib\w* (?:tu|carro|auto|moto|veh[ií]culo)|cambio por|permuta/i },
  { campo: 'ceroMultas', nombre: 'Cero multas', linea: '✅ Cero multas.', menciona: /(?:cero|sin) multas/i },
  { campo: 'aTodaPrueba', nombre: 'A toda prueba', linea: '💯 A toda prueba.', menciona: /toda prueba/i },
  { campo: 'fullEquipo', nombre: 'Full equipo', linea: '⭐ Full equipo.', menciona: /full (?:equipo|extras)/i },
]

const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** ¿Esta frase (beneficio, nota o etiqueta propia) afirma algo que el vendedor NO marcó? */
export const contradice = (v: Vehiculo, frase: string) => ETIQUETAS.some((e) => v[e.campo]
  ? !!e.sinMarcar?.menciona.test(frase)
  : e.menciona.test(frase) && !(e.campo === 'negociable' && /no (?:es )?negociable/i.test(frase)))

/** Notas sin las frases que contradicen las etiquetas ni las que ofrecen financiamiento. */
export const notasCoherentes = (v: Vehiculo) => v.notas.split(/\s*[,;]\s*|\.\s+/)
  .filter((f) => f && !/financi|cr[eé]dito|cuotas/i.test(f) && !contradice(v, f)).join(', ')

export const beneficiosCoherentes = (v: Vehiculo, b: Beneficio[]) => b.filter((x) => x.activo && !hablaDePagos(x.texto) && !contradice(v, x.texto)).map((x) => x.texto)

/** Etiquetas propias activas (nunca se ofrecen formas de pago distintas a las del negocio). */
export const propias = (v: Vehiculo) => (v.etiquetas ?? []).filter((e) => !hablaDePagos(e) && !contradice(v, e))

/** Todas las etiquetas vigentes, con la línea que las expresa. */
export function vigentes(v: Vehiculo): { nombre: string; linea: string; menciona: RegExp }[] {
  const fijas = ETIQUETAS.flatMap((e) => (v[e.campo] ? [e] : e.sinMarcar ? [e.sinMarcar] : []))
  return fijas.map(({ nombre, linea, menciona }) => ({ nombre, linea, menciona }))
    .concat(propias(v).map((p) => ({ nombre: p, linea: `🏷️ ${p}.`, menciona: new RegExp(plano(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })))
}

/** Líneas de las etiquetas vigentes que el texto todavía no menciona. */
export const faltanEn = (v: Vehiculo, texto: string) => vigentes(v).filter((e) => !e.menciona.test(texto) && !e.menciona.test(plano(texto))).map((e) => e.linea)

/** Por qué no se puede crear una etiqueta propia ('' = se puede). */
export function motivoInvalida(texto: string, existentes: string[]): string {
  const t = texto.trim()
  if (!t) return 'Escribe la etiqueta.'
  if (hablaDePagos(t)) return 'Las formas de pago ya son fijas en las plantillas (contado, tarjeta, parte de pago; sin financiamiento).'
  if (ETIQUETAS.some((e) => [e.nombre, e.sinMarcar?.nombre ?? ''].some((n) => plano(n) === plano(t)) || e.menciona.test(t) || e.sinMarcar?.menciona.test(t))) return 'Esa etiqueta ya existe en las casillas.'
  if (existentes.some((x) => plano(x) === plano(t))) return 'Esa etiqueta ya existe.'
  return ''
}

/** Publicaciones y borradores anteriores a las etiquetas: lo no tocado a mano toma el valor habitual del negocio. */
export function migrar(p: Partial<Vehiculo> | undefined, vacio: Vehiculo, manual: (c: Casilla) => boolean): Vehiculo {
  const v = { ...vacio, ...p }
  if (p && !p.etiquetas) for (const c of ['negociable', 'recibeCambio'] as const) if (!manual(c)) v[c] = true
  return { ...v, etiquetas: p?.etiquetas ?? [] }
}
