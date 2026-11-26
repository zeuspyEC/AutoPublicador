// Etiquetas de búsqueda del campo «Etiquetas» de Marketplace: palabras que la gente escribe al buscar.
// Salen solo de los datos del vehículo y de las casillas marcadas (nada se inventa) y se ordenan por importancia:
// primero lo que más se busca (marca, modelo, año), luego el tipo de vehículo y la ciudad, y al final los atributos.
import { propias } from './etiquetas'
import { UBICACION_PREDETERMINADA, type Vehiculo } from './tipos'

/** Facebook permite hasta 20 etiquetas; las primeras se recomiendan como las más útiles. */
export const LIMITE_ETIQUETAS_FB = 20
export const RECOMENDADAS = 7

const MARCAS_MOTO = /^(yamaha|bajaj|kawasaki|tvs|shineray|ktm|suzuki moto|honda moto|daytona|ranger|igm|motor uno|lifan|keeway|benelli|ducati|harley)/i
const CIUDADES = ['Quito', 'Guayaquil', 'Cuenca', 'Ambato', 'Riobamba', 'Ibarra', 'Loja', 'Machala', 'Manta', 'Portoviejo', 'Santo Domingo', 'Latacunga', 'Esmeraldas', 'Tulcán', 'Otavalo', 'Sangolquí', 'Quevedo', 'Babahoyo', 'Milagro', 'Durán']
// Cuando la carrocería no se conoce, el modelo dice si es camioneta o SUV
const CAMIONETAS = /^(hilux|d-?max|luv|ranger|l200|bt-?50|navara|frontier|amarok|wingle|strada|saveiro|oroch|t6|t8|colorado|f-?150|ram|poer|b2200|b2600|d21|courier|glory 500|c31|c35)\b/i
const SUVS = /^(sportage|tucson|grand vitara|vitara|rav ?4|cr-?v|hr-?v|tiggo|x-?trail|kicks|qashqai|captiva|tracker|trailblazer|duster|ecosport|jimny|fortuner|montero|pajero|land cruiser|4runner|santa fe|creta|sorento|seltos|stonic|sonet|soul|haval|forester|xv|outlander|asx|explorer|escape|edge|bronco|tiguan|t-?cross|pilot|wr-?v|cx-?\d+|equinox|blazer|wrangler|grand cherokee|cherokee|compass|renegade|liberty|koleos|captur|journey|durango|trooper|s2|s3|s4|js2|js4|glory|rush|kodiaq|kamiq|samurai|song|tang|yuan|venue|patrol|pathfinder|rodeo|amigo|ertiga|s-?presso)\b/i
const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const min = (s: string) => s.toLocaleLowerCase('es').replace(/\s+/g, ' ').trim()

type Tipo = 'moto' | 'camioneta' | 'suv' | 'carro'
function tipoDe(v: Vehiculo): Tipo {
  const c = plano(v.carroceria)
  if (/moto|cuadr|trici/.test(c) || MARCAS_MOTO.test(v.marca) || /cc$/i.test(v.motor)) return 'moto'
  if (/camioneta|pickup|pick-up|doble cabina|cabina/.test(c)) return 'camioneta'
  if (/suv|jeep|todoterreno/.test(c)) return 'suv'
  if (c) return 'carro'
  return CAMIONETAS.test(v.modelo) ? 'camioneta' : SUVS.test(v.modelo) ? 'suv' : 'carro'
}

/** Ciudad para las búsquedas locales («carros usados quito»); sin ubicación se usa la predeterminada (Quito). */
function ciudad(ubicacion?: string): string {
  const u = plano(ubicacion || UBICACION_PREDETERMINADA)
  return CIUDADES.find((c) => u.includes(plano(c))) ?? ''
}

export function etiquetasMarketplace(v: Vehiculo, ubicacion?: string): string[] {
  const marca = min(v.marca), modelo = min(v.modelo), version = min(v.version)
  const tipo = tipoDe(v), plural = tipo === 'suv' ? 'suv' : `${tipo}s`
  const precio = +v.precio || 0
  const cc = +(v.motor.replace(/[^\d.]/g, '') || 0) // litros en autos, cc en motos
  const economico = tipo === 'moto' ? cc > 0 && cc <= 200 : tipo === 'carro' && ((cc > 0 && cc <= 1.6) || (precio > 0 && precio <= 8000))
  const barato = precio > 0 && precio <= (tipo === 'moto' ? 1500 : 6000)
  const city = min(ciudad(ubicacion))
  const equipo = v.equipamiento.map(plano)
  const lista = [
    `${marca} ${modelo}`,
    modelo && v.anio && `${modelo} ${v.anio}`,
    version && modelo && `${modelo} ${version}`,
    marca,
    modelo,
    economico && (tipo === 'moto' ? 'moto económica' : 'carro económico'),
    tipo === 'camioneta' && (/4x4/i.test(v.traccion) ? 'camioneta 4x4' : 'camioneta de trabajo'),
    tipo === 'suv' && 'suv familiar',
    city && `${plural} ${tipo === 'moto' || tipo === 'camioneta' ? 'usadas' : 'usados'} ${city}`,
    `${tipo} en venta`,
    barato && (tipo === 'moto' ? 'moto barata' : `${tipo} barato`),
    barato && tipo === 'carro' && 'primer carro',
    v.transmision && tipo !== 'moto' && `${tipo} ${v.transmision === 'Manual' ? 'manual' : tipo === 'camioneta' ? 'automática' : 'automático'}`,
    /4x4/i.test(v.traccion) && tipo !== 'camioneta' && '4x4',
    /di[eé]sel/i.test(v.combustible) && `${tipo} diésel`,
    v.aTodaPrueba && 'a toda prueba',
    /al d[ií]a/i.test(v.matricula) && 'matrícula al día',
    v.ceroMultas && 'cero multas',
    v.fullEquipo && 'full equipo',
    v.negociable && 'precio negociable',
    v.recibeCambio && 'recibo vehículo como parte de pago',
    equipo.some((e) => /aire acondicionado/.test(e)) && 'con aire acondicionado',
    ...propias(v).map(min),
    marca && v.anio && `${marca} ${v.anio}`,
    city && `vendo ${tipo} ${city}`,
  ]
  const vistos = new Set<string>()
  return lista
    .filter((x): x is string => typeof x === 'string' && !!x.trim())
    .map(min)
    .filter((x) => { const k = plano(x); if (vistos.has(k)) return false; vistos.add(k); return true })
    .slice(0, LIMITE_ETIQUETAS_FB)
}
