// Plantillas de publicación para Facebook Marketplace, basadas en las publicaciones que mejor han funcionado
// (gancho en mayúsculas + datos clave + emojis en el título; detalles, beneficios y contacto en la descripción).
// Cada plantilla omite las líneas cuyos datos no se conocen: nada se inventa.
import { formatearTelefono } from './telefono'
import { UBICACION_PREDETERMINADA, type Beneficio, type Perfil, type Vehiculo } from './tipos'

export interface Variante {
  id: string
  nombre: string
  texto: string
}

export interface Contexto {
  v: Vehiculo
  perfil: Perfil
  beneficios: Beneficio[]
  ubicacion?: string
}

/** Límite práctico del título en Marketplace: lo que pasa de aquí se corta en la vista previa. */
export const LIMITE_TITULO = 100

// ---------- utilidades de redacción ----------
const limpiar = (s: string) => s.replace(/[ \t]+/g, ' ').replace(/ ([,.;:])/g, '$1').replace(/\s*\/\s*$/, '').trim()
const lineas = (...ls: (string | false | undefined | null)[]) => ls.filter((l) => typeof l === 'string').join('\n')
const bloque = (...ls: (string | false | undefined | null)[]) => ls.filter(Boolean) as string[]
const mayus = (s: string) => s.toLocaleUpperCase('es')
const miles = (d: string) => (d ? (+d).toLocaleString('es-EC').replace(/,/g, '.') : '')
const capitalizar = (s: string) => s.replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase('es'))

function nombreVehiculo(v: Vehiculo, conVersion = true): string {
  return limpiar([v.marca, v.modelo, conVersion ? v.version : ''].join(' '))
}
function motorL(v: Vehiculo) { return v.motor ? `${v.motor}L` : '' }
function anioCorto(v: Vehiculo) { return v.anio ? v.anio.slice(2) : '' }
function matriculaCorta(v: Vehiculo) { return v.matricula ? mayus(v.matricula) : '' }
function transmision(v: Vehiculo) { return v.transmision ? mayus(v.transmision) : '' }
function equipoTitulo(v: Vehiculo, n = 2) {
  return v.equipamiento.slice(0, n).map((e) => mayus(e.replace('Techo corredizo', 'Techo').replace('Pantalla Android', 'Pantalla')
    .replace('Cámara de retro', 'Cámara').replace('Aros deportivos', 'Aros').replace('Aire acondicionado', 'A/A'))).join(' + ')
}

function tel(c: Contexto) { return formatearTelefono(c.perfil.telefono, c.perfil.estiloTelefono) }
function ubic(c: Contexto) { return c.ubicacion || UBICACION_PREDETERMINADA }
function activos(c: Contexto) { return c.beneficios.filter((b) => b.activo).map((b) => b.texto) }

/** Frase de uso según la carrocería (para el párrafo inicial). */
function idealPara(v: Vehiculo): string {
  const c = v.carroceria.toLowerCase()
  if (/camioneta|pickup|4x4/.test(c) || /4X4/.test(v.traccion)) return 'trabajo, ciudad y campo'
  if (/suv|jeep/.test(c)) return 'la familia, la ciudad y las salidas de fin de semana'
  if (/hatchback/.test(c)) return 'moverse en la ciudad de forma económica'
  return 'quien busca un carro cómodo, económico y confiable'
}

// ---------- títulos ----------
export function titulos(c: Contexto): Variante[] {
  const v = c.v
  const N = mayus(nombreVehiculo(v, false)), NV = mayus(nombreVehiculo(v))
  const M = motorL(v), A = v.anio, T = transmision(v)
  const mat = v.matricula ? `${matriculaCorta(v)} ✅` : ''
  const eq = equipoTitulo(v)
  const lista: [string, string][] = [
    ['gancho-cambio', `VENDO//CAMBIO 🔥 ${N} ${M} ${A} ${mat} ${T} ${v.aTodaPrueba ? 'A TODA PRUEBA' : ''} 💯`],
    ['full-equipo', `🔥 ${NV} ${M} ${v.fullEquipo ? 'FULL EQUIPO' : ''} ${eq ? '/ ' + eq : ''} 🚗`],
    ['oportunidad', `VENDO DE OPORTUNIDAD ${capitalizar(nombreVehiculo(v).toLowerCase())} ${A ? `del año ${anioCorto(v)}` : ''} ${v.matricula ? 'papeles al día' : ''} ${v.aTodaPrueba ? 'a toda prueba' : ''}`],
    ['explosion', `VENDO//CAMBIO 💥 ${NV} ${A} ${v.matricula ? mayus(v.matricula) : ''} ${v.aTodaPrueba ? 'TODA PRUEBA' : ''} 💯✅`],
    ['directo', `🚗 ${N} ${A} ${M} ${T} | ${v.matricula ? 'MATRÍCULA AL DÍA' : ''} ${v.negociable ? '| NEGOCIABLE ✅' : ''}`],
    ['recibo-auto', `💥 OPORTUNIDAD ${N} ${A} ${M} — RECIBO TU AUTO O MOTO 🔄`],
    ['traspaso', `✅ ${NV} ${A} ${v.matricula ? 'PAPELES AL DÍA 📄' : ''} LISTO PARA TRASPASO`],
    ['equipado', `⭐ ${N} ${A} ${eq || (v.fullEquipo ? 'FULL EQUIPO' : T)} | ENTREGA INMEDIATA 🔑`],
  ]
  return lista
    .map(([id, t]) => ({ id, nombre: `Título ${id}`, texto: limpiar(t.replace(/\|\s*\|/g, '|').replace(/\|\s*$/, '')) }))
    .filter((x, i, arr) => arr.findIndex((y) => y.texto === x.texto) === i)
}

// ---------- descripciones ----------
function detalles(v: Vehiculo, prefijo = '✅'): string[] {
  return bloque(
    nombreVehiculo(v) && `${prefijo} Marca/Modelo: ${limpiar(`${nombreVehiculo(v)} ${motorL(v)}`)}`,
    v.anio && `${prefijo} Año: ${v.anio}${v.procedencia ? ` (Procedencia ${v.procedencia})` : ''}`,
    (v.motor || v.combustible) && `${prefijo} Motor: ${limpiar(`${motorL(v)} ${v.combustible}`)}`,
    v.transmision && `${prefijo} Transmisión: ${v.transmision}`,
    v.traccion && `${prefijo} Tracción: ${v.traccion}`,
    v.kilometraje && `${prefijo} Kilometraje: ${miles(v.kilometraje)} km`,
    v.carroceria && `${prefijo} Tipo: ${v.carroceria}${v.puertas ? ` de ${v.puertas} puertas` : ''}`,
    !v.carroceria && v.puertas && `${prefijo} Puertas: ${v.puertas}`,
    v.color && `${prefijo} Color: ${v.color}`,
    v.matricula && `${prefijo} Matrícula: ${v.matricula}${v.ceroMultas ? ' (Cero multas)' : ''}`,
    v.equipamiento.length > 0 && `${prefijo} Equipamiento: ${v.equipamiento.join(', ')}.`,
    v.notas && `${prefijo} Estado: ${v.notas}.`,
    v.aTodaPrueba && `${prefijo} Mecánica: A toda prueba, puedes traer a tu mecánico de confianza.`,
  )
}

function precioLinea(v: Vehiculo): string | false {
  if (!v.precio) return false
  const antes = v.precioAnterior && +v.precioAnterior > +v.precio ? ` (antes $${miles(v.precioAnterior)})` : ''
  return `💲 Precio: $${miles(v.precio)}${antes}${v.negociable ? ' — negociable' : ''}`
}

export function descripciones(c: Contexto): Variante[] {
  const v = c.v
  const nombre = c.perfil.nombre.trim()
  const NOMBRE = mayus(nombre)
  const telefono = tel(c)
  const horario = c.perfil.horario.trim()
  const ben = activos(c)
  const vehiculo = nombreVehiculo(v) || 'vehículo'
  const equipo = v.equipamiento.slice(0, 2).map((e) => e.toLowerCase())

  const completa = lineas(
    `¡Se vende o se cambia! ${capitalizar(vehiculo)}${v.anio ? ` ${v.anio}` : ''} en excelente estado${equipo.length ? `, con ${equipo.join(' y ')}` : ''}. Ideal para ${idealPara(v)}, con toda la documentación en regla.`,
    '',
    '💎 DETALLES DEL VEHÍCULO:',
    ...detalles(v),
    '',
    ben.length > 0 && '🤝 BENEFICIOS EXCLUSIVOS:',
    ...ben.map((b) => `✅ ${b}`),
    ben.length > 0 && '',
    precioLinea(v),
    `📍 UBICACIÓN: ${ubic(c)}`,
    horario && `⏰ HORARIO: ${horario}`,
    `👨‍💼 ASESOR: ${NOMBRE}`,
    `📲 ${telefono}`,
  )

  const contactoPrimero = lineas(
    `📍 NORTE DE QUITO | ${NOMBRE} 👨‍💼`,
    `📲 ${telefono}`,
    '',
    '¡EL MEJOR PRECIO LO CONSIGUES AQUÍ! ‼️✅',
    ...ben.map((b) => `✅ ${mayus(b)}`),
    '',
    `🚗 ${mayus(limpiar(`${vehiculo} ${motorL(v)} ${v.anio}`))}`,
    ...detalles(v, '▪️').slice(1),
    '',
    `👨‍💼 ${nombre}: Vendedor Autorizado 💯`,
    horario && `⏰ Atiendo ${horario.toLowerCase().startsWith('de') ? '' : 'de '}${horario}.`,
    `📍 Ubicación: ${ubic(c)}.`,
    `¡No olvides pedir tu cita a nombre de ${NOMBRE} al llegar!`,
  )

  const descuento = lineas(
    `📍 ${ubic(c)}`,
    `👨‍💼 ${nombre}: ${telefono}`,
    '',
    'TODOS LOS PRECIOS CON DESCUENTO ‼️✅',
    '',
    `✅ ${limpiar(`${capitalizar(vehiculo)} ${v.transmision === 'Manual' ? 'T/M' : v.transmision === 'Automática' ? 'A/T' : ''} ${v.equipamiento.includes('Aire acondicionado') ? 'A/A' : ''} ${v.anio}`)}${v.procedencia ? ` — ${v.procedencia}` : ''}`,
    v.matricula && `✅ Matrícula ${mayus(v.matricula)}${v.ceroMultas ? ' | Cero multas ✅' : ''}`,
    v.equipamiento.length > 0 && `✅ ${v.equipamiento.slice(0, 4).join(' | ')}`,
    (v.motor || v.kilometraje) && `✅ ${limpiar([v.motor && `Motor ${motorL(v)}`, v.kilometraje && `${miles(v.kilometraje)} km`].filter(Boolean).join(' | '))}`,
    '',
    ...ben.map((b) => `✅ ${b}`),
    '',
    `👨‍💼 ${nombre} — Vendedor Autorizado 💯✅`,
  )

  const corta = lineas(
    `UBICACIÓN: ${mayus(ubic(c))} 📌`,
    '',
    horario && `ATENDEMOS ${mayus(horario)} 🕣`,
    horario && '',
    `${mayus(limpiar(`${vehiculo} ${v.anio}`))}${v.matricula ? ' PAPELES AL DÍA' : ''} 💯✅`,
    '',
    v.recibeCambio || ben.some((b) => /parte de pago/i.test(b)) ? 'SÍ REALIZAMOS CAMBIOS / PARTE DE PAGO ‼️' : 'PRECIO CONVERSABLE EN EL PATIO ‼️',
    `${telefono} 📱`,
    '',
    `SOY ${NOMBRE}.`,
  )

  const ficha = lineas(
    `🚘 FICHA DEL VEHÍCULO — ${mayus(limpiar(`${vehiculo} ${v.anio}`))}`,
    '',
    ...detalles(v, '🔹'),
    '',
    precioLinea(v),
    ben.length > 0 && '',
    ben.length > 0 && '📌 CONDICIONES:',
    ...ben.slice(0, 5).map((b) => `• ${b}`),
    '',
    `📍 ${ubic(c)}`,
    `📲 ${nombre}: ${telefono}`,
  )

  const conversacional = lineas(
    `Hola 👋 Te presento este ${capitalizar(vehiculo)}${v.anio ? ` ${v.anio}` : ''}${v.color ? ` color ${v.color.toLowerCase()}` : ''}.`,
    `${v.aTodaPrueba ? 'Está a toda prueba y ' : ''}${v.matricula ? 'tiene los papeles al día' : 'está listo para usar'}${equipo.length ? `; además viene con ${equipo.join(' y ')}` : ''}.`,
    v.recibeCambio && 'Si tienes un auto o moto, lo recibimos como parte de pago 🔄.',
    v.negociable && 'El precio es conversable en el patio 🤝.',
    '',
    `Escríbeme o llámame al 📲 ${telefono} y agenda tu cita.`,
    `📍 Estamos en ${ubic(c)}.`,
    `${nombre} — Vendedor Autorizado 💯`,
  )

  return [
    { id: 'completa', nombre: 'Completa: detalles + beneficios', texto: completa },
    { id: 'contacto-primero', nombre: 'Contacto primero (mayúsculas)', texto: contactoPrimero },
    { id: 'descuento', nombre: 'Precios con descuento', texto: descuento },
    { id: 'corta', nombre: 'Corta y directa', texto: corta },
    { id: 'ficha', nombre: 'Ficha técnica', texto: ficha },
    { id: 'conversacional', nombre: 'Conversacional', texto: conversacional },
  ].map((d) => ({ ...d, texto: d.texto.replace(/\n{3,}/g, '\n\n').trim() }))
}
