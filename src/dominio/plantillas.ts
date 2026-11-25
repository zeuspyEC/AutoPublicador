// Plantillas de publicación para Facebook Marketplace, basadas en las publicaciones que mejor han funcionado
// (gancho en mayúsculas + datos clave + emojis en el título; detalles, beneficios y contacto en la descripción).
// Cada plantilla omite las líneas cuyos datos no se conocen: nada se inventa.
import { formatearTelefono } from './telefono'
import { hablaDePagos, UBICACION_PREDETERMINADA, type Beneficio, type Perfil, type Vehiculo } from './tipos'

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
/** «83.78» → «83,78»; «1707.17» → «1.707,17» (formato de Ecuador). */
const dinero = (d: string) => { const [e, c = '00'] = (+d).toFixed(2).split('.'); return `${e.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${c}` }
/** El vendedor eligió mencionar los valores pendientes del SRI. */
export const conDeuda = (v: Vehiculo) => !!v.mostrarDeuda && +(v.deuda || 0) > 0
/** Sufijo del precio: con la deuda visible, el precio es negociable por ella; si no, el «negociable» de siempre. */
export function sufijoPrecio(v: Vehiculo, normal: string): string {
  if (conDeuda(v)) return ` (negociable · valores pendientes de matrícula: $${dinero(v.deuda)})`
  return v.negociable ? normal : ''
}
const minusculaInicial = (s: string) => (/^[A-ZÁÉÍÓÚÑ]{2}/.test(s) ? s : s.charAt(0).toLocaleLowerCase('es') + s.slice(1))
const capitalizar = (s: string) => s.replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase('es'))

function nombreVehiculo(v: Vehiculo, conVersion = true): string {
  return limpiar([v.marca, v.modelo, conVersion ? v.version : ''].join(' '))
}
/** «1.6» → «1.6L»; en motos el cilindraje va en cc («150 cc») y se deja igual. */
function motorL(v: Vehiculo) { return v.motor ? (/cc$/i.test(v.motor) ? v.motor : `${v.motor}L`) : '' }
function anioCorto(v: Vehiculo) { return v.anio ? v.anio.slice(2) : '' }
function matriculaCorta(v: Vehiculo) { return v.matricula ? mayus(v.matricula) : '' }
function transmision(v: Vehiculo) { return v.transmision ? mayus(v.transmision) : '' }
function equipoTitulo(v: Vehiculo, n = 2) {
  return v.equipamiento.slice(0, n).map((e) => mayus(e.replace('Techo corredizo', 'Techo').replace('Pantalla Android', 'Pantalla')
    .replace('Cámara de retro', 'Cámara').replace('Aros deportivos', 'Aros').replace('Aire acondicionado', 'A/A'))).join(' + ')
}

function tel(c: Contexto) { return formatearTelefono(c.perfil.telefono, c.perfil.estiloTelefono) }
function ubic(c: Contexto) { return c.ubicacion || UBICACION_PREDETERMINADA }
/** Los beneficios sobre formas de pago no se repiten: el bloque fijo de pagos es la única fuente (y nunca se ofrece financiamiento). */
function activos(c: Contexto) { return c.beneficios.filter((b) => b.activo && !hablaDePagos(b.texto)).map((b) => b.texto) }

/** Formas de pago del negocio: van en todas las descripciones. Solo contado; no hay financiamiento. */
export const PAGOS = [
  '💵 VENTA SOLO DE CONTADO: efectivo o tarjeta.',
  '🔄 Recibimos tu auto o moto como parte de pago.',
  '🚫 NO DAMOS FINANCIAMIENTO.',
]
/** Notas del vendedor sin frases que ofrezcan financiamiento. */
const notasSinFinanciamiento = (s: string) => s.split(/\s*[,;]\s*|\.\s+/).filter((f) => f && !/financi|cr[eé]dito|cuotas/i.test(f)).join(', ')

/** Añade el teléfono al final del título y, si no cabe, quita los datos menos importantes (los últimos), nunca el teléfono. */
function conTelefono(partes: string[], telefono: string): string {
  const armar = (ps: string[]) => limpiar([limpiar(ps.filter(Boolean).join(' ')).replace(/(\s*[|—/]\s*)+$/, ''), telefono && `📲 ${telefono}`].filter(Boolean).join(' '))
  const ps = partes.filter(Boolean)
  while (ps.length > 2 && [...armar(ps)].length > LIMITE_TITULO) ps.pop()
  return armar(ps)
}

/** Frase de uso según la carrocería (para el párrafo inicial). */
function idealPara(v: Vehiculo): string {
  const c = v.carroceria.toLowerCase()
  if (/moto|cuadr|trici/.test(c)) return 'moverse ágil y económico por la ciudad'
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
  const prueba = v.aTodaPrueba ? 'A TODA PRUEBA' : ''
  // Cada título es una lista de partes en orden de importancia: si con el teléfono no cabe, se quitan desde el final
  const lista: [string, string[]][] = [
    ['gancho-cambio', ['VENDO//CAMBIO 🔥', N, A, M, mat, T, prueba, '💯']],
    ['full-equipo', ['🔥', NV, A, M, v.fullEquipo ? 'FULL EQUIPO' : '', eq ? '/ ' + eq : '', '🚗']],
    ['oportunidad', ['VENDO DE OPORTUNIDAD', nombreVehiculo(v), A ? `del año ${anioCorto(v)}` : '', v.matricula ? 'papeles al día' : '', v.aTodaPrueba ? 'a toda prueba' : '']],
    ['explosion', ['VENDO//CAMBIO 💥', NV, A, v.matricula ? matriculaCorta(v) : '', prueba, '💯✅']],
    ['directo', ['🚗', N, A, M, T, v.matricula ? '| MATRÍCULA AL DÍA' : '', v.negociable ? '| NEGOCIABLE ✅' : '']],
    ['recibo-auto', ['💥 RECIBO TU AUTO O MOTO 🔄', N, A, M]],
    ['contado', ['💵 DE CONTADO', NV, A, M, '| SIN FINANCIAMIENTO 🚫']],
    ['traspaso', ['✅', NV, A, v.matricula ? 'PAPELES AL DÍA 📄' : '', 'LISTO PARA TRASPASO']],
    ['equipado', ['⭐', N, A, eq || (v.fullEquipo ? 'FULL EQUIPO' : T), '| ENTREGA INMEDIATA 🔑']],
  ]
  // Títulos que solo aparecen cuando el dato que los sostiene existe (nada se inventa)
  if (v.kilometraje && +v.kilometraje < 150000) lista.push(['kilometraje', ['✅', N, A, `SOLO ${miles(v.kilometraje)} KM 🛣️`, mat]])
  if (/único dueño/i.test(v.notas)) lista.push(['unico-dueno', ['👤 ÚNICO DUEÑO', NV, A, M, mat, '💯']])
  if (v.recibeCambio) lista.push(['cambio-moto', ['CAMBIO POR MOTO O CARRO 🏍️🚗', N, A, mat]])
  if (/suv|jeep|camioneta|pickup/i.test(v.carroceria) || /4x4/i.test(v.traccion)) lista.push(['familia', ['🚙', N, A, v.traccion ? mayus(v.traccion) : '', 'IDEAL PARA LA FAMILIA Y EL CAMPO ✅', M, T]])
  if (v.negociable && v.precio) lista.push(['remate', ['🔥 REMATO', N, A, '¡NEGOCIABLE! 💥', M, T]])
  const telefono = tel(c)
  return lista
    .map(([id, partes]) => ({ id, nombre: `Título ${id}`, texto: conTelefono(partes, telefono) }))
    .filter((x, i, arr) => arr.findIndex((y) => y.texto === x.texto) === i)
}

// ---------- descripciones ----------
function detalles(v: Vehiculo, prefijo = '✅'): string[] {
  const notas = notasSinFinanciamiento(v.notas)
  return bloque(
    nombreVehiculo(v) && `${prefijo} Marca/Modelo: ${limpiar(`${nombreVehiculo(v)} ${motorL(v)}`)}`,
    v.anio && `${prefijo} Año: ${v.anio}${v.procedencia ? ` (Procedencia ${v.procedencia})` : ''}`,
    // El cilindraje ya va en «Marca/Modelo»: la línea de motor solo se agrega si aporta el combustible
    v.combustible && `${prefijo} Motor: ${limpiar(`${motorL(v)} ${v.combustible}`)}`,
    v.transmision && `${prefijo} Transmisión: ${v.transmision}`,
    v.traccion && `${prefijo} Tracción: ${v.traccion}`,
    v.kilometraje && `${prefijo} Kilometraje: ${miles(v.kilometraje)} km`,
    v.carroceria && `${prefijo} Tipo: ${v.carroceria}${v.puertas ? ` de ${v.puertas} puertas` : ''}`,
    !v.carroceria && v.puertas && `${prefijo} Puertas: ${v.puertas}`,
    v.color && `${prefijo} Color: ${v.color}`,
    v.matricula && `${prefijo} Matrícula: ${v.matricula}${v.ceroMultas ? ' (Cero multas)' : ''}`,
    v.equipamiento.length > 0 && `${prefijo} Equipamiento: ${v.equipamiento.join(', ')}.`,
    notas && `${prefijo} Estado: ${notas}.`,
    v.aTodaPrueba && `${prefijo} Mecánica: A toda prueba, puedes traer a tu mecánico de confianza.`,
  )
}

function precioLinea(v: Vehiculo): string | false {
  if (!v.precio) return false
  const antes = v.precioAnterior && +v.precioAnterior > +v.precio ? ` (antes $${miles(v.precioAnterior)})` : ''
  return `💲 Precio: $${miles(v.precio)}${antes}${sufijoPrecio(v, ' — negociable')}`
}

export function descripciones(c: Contexto): Variante[] {
  const v = c.v
  const nombre = c.perfil.nombre.trim()
  const NOMBRE = mayus(nombre)
  const telefono = tel(c)
  const horario = c.perfil.horario.trim()
  const ben = activos(c)
  const vehiculo = nombreVehiculo(v) || 'vehículo'
  const equipo = v.equipamiento.slice(0, 2).map(minusculaInicial) // «pantalla Android», no «pantalla android»

  const completa = lineas(
    `¡Se vende o se cambia! ${capitalizar(vehiculo)}${v.anio ? ` ${v.anio}` : ''} en excelente estado${equipo.length ? `, con ${equipo.join(' y ')}` : ''}. Ideal para ${idealPara(v)}${v.matricula ? ', con toda la documentación en regla' : ''}.`,
    '',
    '💎 DETALLES DEL VEHÍCULO:',
    ...detalles(v),
    '',
    ben.length > 0 && '🤝 BENEFICIOS EXCLUSIVOS:',
    ...ben.map((b) => `✅ ${b}`),
    ben.length > 0 && '',
    precioLinea(v),
    ...PAGOS,
    '',
    `📍 UBICACIÓN: ${ubic(c)}`,
    horario && `⏰ HORARIO: ${horario}`,
    `👨‍💼 ASESOR: ${NOMBRE}`,
    `📲 ${telefono}`,
  )

  const contactoPrimero = lineas(
    `📍 NORTE DE QUITO | ${NOMBRE} 👨‍💼`,
    '',
    '¡EL MEJOR PRECIO LO CONSIGUES AQUÍ! ‼️✅',
    ...ben.map((b) => `✅ ${mayus(b)}`),
    '',
    `🚗 ${mayus(limpiar(`${vehiculo} ${motorL(v)} ${v.anio}`))}`,
    ...detalles(v, '▪️').slice(1),
    '',
    ...PAGOS.map(mayus),
    '',
    `👨‍💼 ${nombre}: Vendedor Autorizado 💯`,
    horario && `⏰ Horario de atención: ${horario}.`,
    `📍 Ubicación: ${ubic(c)}.`,
    `¡No olvides pedir tu cita a nombre de ${NOMBRE} al llegar!`,
    `📲 ${telefono}`,
  )

  const descuento = lineas(
    `📍 ${ubic(c)}`,
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
    ...PAGOS,
    '',
    `👨‍💼 ${nombre} — Vendedor Autorizado 💯✅`,
    `📲 ${telefono}`,
  )

  const corta = lineas(
    `UBICACIÓN: ${mayus(ubic(c))} 📌`,
    '',
    horario && `ATENDEMOS ${mayus(horario)} 🕣`,
    horario && '',
    `${mayus(limpiar(`${vehiculo} ${v.anio}`))}${v.matricula ? ' PAPELES AL DÍA' : ''} 💯✅`,
    '',
    ...PAGOS.map(mayus),
    '',
    `SOY ${NOMBRE}. 📲 ${telefono}`,
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
    ...PAGOS,
    '',
    `📍 ${ubic(c)}`,
    `📲 ${nombre}: ${telefono}`,
  )

  const conversacional = lineas(
    `Hola 👋 Te presento este ${capitalizar(vehiculo)}${v.anio ? ` ${v.anio}` : ''}${v.color ? ` color ${v.color.toLowerCase()}` : ''}.`,
    `${v.aTodaPrueba ? 'Está a toda prueba y ' : ''}${v.matricula ? v.aTodaPrueba ? 'tiene los papeles al día' : 'Tiene los papeles al día' : v.aTodaPrueba ? 'está listo para usar' : 'Está listo para usar'}${equipo.length ? `; además viene con ${equipo.join(' y ')}` : ''}.`,
    v.negociable && 'El precio es conversable en el patio 🤝.',
    '',
    ...PAGOS,
    '',
    `📍 Estamos en ${ubic(c)}.`,
    `${nombre} — Vendedor Autorizado 💯`,
    `Escríbeme o llámame al 📲 ${telefono} y agenda tu cita.`,
  )

  const resumenCorto = detalles(v, '✔️').slice(1, 6)

  const oportunidad = lineas(
    '🔥 ¡OPORTUNIDAD ÚNICA! 🔥',
    `${mayus(limpiar(`${vehiculo} ${motorL(v)} ${v.anio}`))}${v.matricula ? ' — PAPELES AL DÍA' : ''}`,
    v.precio && `💲 SOLO $${miles(v.precio)}${sufijoPrecio(v, ' (negociable)')}`,
    '',
    ...resumenCorto,
    '',
    ...ben.slice(0, 3).map((b) => `✅ ${b}`),
    '',
    ...PAGOS,
    '',
    `📍 ${ubic(c)}`,
    `👉 Escríbeme antes de que se vaya. ${nombre}, Vendedor Autorizado 💯 📲 ${telefono}`,
  )

  const fichaEmoji = lineas(
    `🚗 ${mayus(vehiculo)}`,
    '',
    ...bloque(
    v.anio && `📅 Año: ${v.anio}`,
    v.motor && `⚙️ Motor: ${limpiar(`${motorL(v)} ${v.combustible}`)}`,
    v.transmision && `🕹️ Transmisión: ${v.transmision}`,
    !v.motor && v.combustible && `⛽ Combustible: ${v.combustible}`,
    v.traccion && `🧭 Tracción: ${v.traccion}`,
    v.kilometraje && `🛣️ Kilometraje: ${miles(v.kilometraje)} km`,
    v.carroceria && `🚙 Tipo: ${v.carroceria}`,
    v.puertas && `🚪 Puertas: ${v.puertas}`,
    v.color && `🎨 Color: ${v.color}`,
    v.procedencia && `🌎 Procedencia: ${v.procedencia}`,
    v.matricula && `📄 Matrícula: ${v.matricula}${v.ceroMultas ? ' · cero multas' : ''}`,
    v.equipamiento.length > 0 && `⭐ Equipamiento: ${v.equipamiento.join(', ')}`,
    notasSinFinanciamiento(v.notas) && `📝 Estado: ${notasSinFinanciamiento(v.notas)}`,
    ),
    '',
    v.precio && `💰 Precio: $${miles(v.precio)}${sufijoPrecio(v, ' · negociable')}`,
    ...PAGOS,
    '',
    `📍 ${ubic(c)}`,
    `📲 ${nombre}: ${telefono}`,
  )

  const pregunta = lineas(
    `¿Buscas ${v.carroceria ? `un ${v.carroceria.toLowerCase()}` : 'un carro'} confiable${v.matricula ? ' y con papeles al día' : ''}? 👀`,
    `Te presento el ${capitalizar(vehiculo)}${v.anio ? ` ${v.anio}` : ''} ✅`,
    '',
    ...detalles(v, '👉').slice(1, 7),
    '',
    ...ben.slice(0, 3).map((b) => `🤝 ${b}`),
    '',
    ...PAGOS,
    '',
    `📍 ${ubic(c)} · ${nombre}, Vendedor Autorizado 💯`,
    `📲 Escríbeme al ${telefono} y agenda tu cita.`,
  )

  const cambio = lineas(
    '🔄 VENDO O CAMBIO 🔄',
    `${mayus(limpiar(`${vehiculo} ${v.anio}`))}`,
    '',
    '¿Tienes un auto o moto? ¡Tráelo! 🚗🏍️',
    '',
    ...resumenCorto,
    '',
    '✅ Trae a tu mecánico de confianza',
    v.negociable && '✅ Precio conversable en el patio',
    '',
    ...PAGOS,
    '',
    `📍 ${ubic(c)}`,
    `📲 ${telefono} — ${nombre}`,
  )

  const minima = lineas(
    limpiar([capitalizar(vehiculo), v.anio, motorL(v), v.transmision, v.matricula].filter(Boolean).join(' · ')),
    v.precio && `💲 $${miles(v.precio)}${sufijoPrecio(v, ' negociable')}`,
    ...PAGOS,
    `📍 ${ubic(c)}`,
    `📲 ${telefono} · ${nombre}`,
  )

  const confianza = lineas(
    `✅ ${mayus(limpiar(`${vehiculo} ${v.anio}`))} — COMPRA CON TRANQUILIDAD`,
    '',
    '🔍 Puedes traer a tu mecánico de confianza y revisarlo sin compromiso.',
    v.matricula && `📑 ${v.matricula}${v.ceroMultas ? ', cero multas' : ''}: listo para traspaso.`,
    ben.some((b) => /notar/i.test(b)) && '🖋️ Escritura directa en notaría.',
    ben.some((b) => /garant/i.test(b)) && '🛡️ Garantía incluida.',
    '',
    ...detalles(v, '▫️').slice(1, 8),
    '',
    ...PAGOS,
    '',
    `📍 ${ubic(c)}`,
    horario && `⏰ ${horario}`,
    `📲 ${telefono} · ${nombre}, Vendedor Autorizado 💯`,
  )

  return [
    { id: 'completa', nombre: 'Completa: detalles + beneficios', texto: completa },
    { id: 'contacto-primero', nombre: 'Contacto primero (mayúsculas)', texto: contactoPrimero },
    { id: 'descuento', nombre: 'Precios con descuento', texto: descuento },
    { id: 'corta', nombre: 'Corta y directa', texto: corta },
    { id: 'ficha', nombre: 'Ficha técnica', texto: ficha },
    { id: 'conversacional', nombre: 'Conversacional', texto: conversacional },
    { id: 'oportunidad', nombre: 'Oportunidad única', texto: oportunidad },
    { id: 'ficha-emoji', nombre: 'Ficha con emojis', texto: fichaEmoji },
    { id: 'pregunta', nombre: '¿Buscas…? (pregunta)', texto: pregunta },
    { id: 'cambio', nombre: 'Vendo o cambio', texto: cambio },
    { id: 'confianza', nombre: 'Compra con confianza', texto: confianza },
    { id: 'minima', nombre: 'Mínima (para repostear)', texto: minima },
  ].map((d) => ({ ...d, texto: `${telefono ? `📲 ${nombre}: ${telefono}\n\n` : ''}${d.texto}`.replace(/\n{3,}/g, '\n\n').trim() }))
}

/** Comentarios y respuestas rápidas para la publicación («¿Sigue disponible?», precio, cambio, cita…). */
export function comentarios(c: Contexto): Variante[] {
  const v = c.v
  const nombre = c.perfil.nombre.trim()
  const telefono = tel(c)
  const vehiculo = capitalizar(nombreVehiculo(v)) || 'vehículo'
  const horario = c.perfil.horario.trim()
  const lista: (Variante | false)[] = [
    { id: 'disponible', nombre: 'Sigue disponible', texto: `✅ ¡Sigue disponible! Escríbeme al 📲 ${telefono} y te envío más fotos y detalles del ${vehiculo}.` },
    { id: 'cita', nombre: 'Agendar cita', texto: `Hola 👋 Sí, el ${vehiculo} está disponible. ¿Te gustaría agendar una cita para verlo? Estamos en ${ubic(c)} 📍. Pide la cita a nombre de ${nombre}.` },
    { id: 'precio', nombre: 'Sobre el precio', texto: `💬 El precio${v.precio ? ` de $${miles(v.precio)}` : ''} es conversable en el patio 🤝${conDeuda(v) ? `, considerando los $${dinero(v.deuda)} pendientes de matrícula` : ''}. Escríbeme al 📲 ${telefono} y lo vemos.` },
    { id: 'cambio', nombre: 'Recibo cambio', texto: `🔄 Sí recibimos tu auto o moto como parte de pago (la diferencia es de contado: efectivo o tarjeta). Mándame fotos y el año de tu vehículo al 📲 ${telefono}.` },
    { id: 'pagos', nombre: '¿Dan financiamiento?', texto: `🚫 No damos financiamiento. 💵 La venta es solo de contado: efectivo o tarjeta, y 🔄 recibimos tu auto o moto como parte de pago. Escríbeme al 📲 ${telefono}.` },
    { id: 'papeles', nombre: 'Papeles y mecánico', texto: `📄 ${v.matricula ? `Tiene la matrícula ${v.matricula.toLowerCase()}${v.ceroMultas ? ' y cero multas' : ''}. ` : ''}Puedes traer a tu mecánico de confianza 🔧.` },
    { id: 'horario', nombre: 'Horario y ubicación', texto: horario ? `⏰ Atendemos ${horario.charAt(0).toLowerCase() + horario.slice(1)}. Te espero en ${ubic(c)} 📍 — ${nombre}` : `📍 Te espero en ${ubic(c)}. Escríbeme para coordinar la visita 📲 ${telefono} — ${nombre}` },
    { id: 'subir', nombre: 'Para subir la publicación', texto: `⬆️ ¡Disponible! ${limpiar(`${vehiculo} ${v.anio}`)} 💯 Escríbeme 📲 ${telefono}` },
  ]
  return lista.filter(Boolean) as Variante[]
}
