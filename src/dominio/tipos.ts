// Tipos del dominio: el vendedor (perfil), el vehículo y de dónde salió cada dato.

/** Forma de escribir el teléfono para que Facebook no lo oculte (nunca se publica «limpio»). */
export type EstiloTelefono = 'guiones' | 'puntos' | 'diagonales' | 'mixto' | 'emoji'

export interface Perfil {
  nombre: string
  telefono: string // tal como lo escribió el vendedor; se normaliza al formatear
  estiloTelefono: EstiloTelefono
  horario: string // opcional, p. ej. «Todos los días de 08:30 a 17:30»
}

export interface Vehiculo {
  marca: string
  modelo: string
  version: string
  anio: string
  motor: string // cilindraje en litros: «1.6»
  transmision: '' | 'Manual' | 'Automática'
  combustible: string
  kilometraje: string // solo dígitos: «120000»
  color: string
  carroceria: string
  traccion: string
  puertas: string
  precio: string // solo dígitos
  precioAnterior: string
  deuda: string // valores pendientes de matrícula en el SRI (USD): «83.78»
  mostrarDeuda: boolean // el vendedor decide si se menciona; va junto al precio como motivo de «negociable»
  matricula: string // «Al día 2025», «Al día»
  ceroMultas: boolean
  procedencia: string // «Argentina»
  equipamiento: string[]
  notas: string // estado, mecánica, detalles libres
  negociable: boolean
  recibeCambio: boolean
  fullEquipo: boolean
  aTodaPrueba: boolean
}

/** De dónde salió cada dato: así se sabe qué se escribió, qué se investigó y qué se corrigió a mano. */
export type Origen = 'texto' | 'sri' | 'wikipedia' | 'google' | 'manual'
export type Origenes = Partial<Record<keyof Vehiculo, Origen>>

export interface Beneficio {
  id: string
  texto: string
  activo: boolean
}

export interface Ajustes {
  beneficios: Beneficio[]
  claveGemini: string // opcional: investigación en Google con Gemini (se guarda solo en este navegador)
  servidorPlacas: string // opcional: URL del servidor de placas propio (carpeta /servidor); vacío = el predeterminado
  ubicacion: string
}

export const VEHICULO_VACIO: Vehiculo = {
  marca: '', modelo: '', version: '', anio: '', motor: '', transmision: '', combustible: '', kilometraje: '',
  color: '', carroceria: '', traccion: '', puertas: '', precio: '', precioAnterior: '', deuda: '', mostrarDeuda: false, matricula: '',
  ceroMultas: false, procedencia: '', equipamiento: [], notas: '', negociable: false, recibeCambio: false,
  fullEquipo: false, aTodaPrueba: false,
}

export const UBICACION_PREDETERMINADA = 'Sector El Inca (Norte de Quito)'

/** Formas de pago: son fijas en las plantillas (contado, tarjeta, auto o moto como parte de pago; sin financiamiento). */
export const hablaDePagos = (s: string) => /financi|cr[eé]dito|cuotas|tarjeta|contado|parte de pago/i.test(s)

export const BENEFICIOS_PREDETERMINADOS: Beneficio[] = [
  { id: 'negociable', texto: 'Precio negociable en el patio (trato directo)', activo: true },
  { id: 'mecanico', texto: 'Trae a tu mecánico de confianza sin compromiso', activo: true },
  { id: 'garantia', texto: 'Garantía incluida', activo: true },
  { id: 'entrega', texto: 'Entrega inmediata', activo: true },
  { id: 'notaria', texto: 'Escritura directa en notaría', activo: true },
]
