// Servidor de placas de AutoPublicador (Cloudflare Worker; también funciona en Deno Deploy).
// El navegador no puede leer el servicio del SRI desde otra página (CORS). Este servidor lo consulta y entrega
// SOLO datos del vehículo a la app, con permiso únicamente para los orígenes autorizados.
//
//   GET /placa/PBA1234  →  { placa, base: {...}, rubros: [...] }
//   GET /salud          →  { ok: true }

const SRI = 'https://srienlinea.sri.gob.ec/sri-matriculacion-vehicular-recaudacion-servicio-internet/rest'
const ORIGENES = [/^https:\/\/zeuspyec\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/]
const CACHE_SEGUNDOS = 6 * 60 * 60
/** Campos con datos personales que nunca se devuelven, vengan donde vengan en la respuesta del SRI. */
const PERSONALES = /propietari|nombre(?!clase)|cedula|c[eé]dula|identificaci|ruc|direcci|telefon|correo|email|razonsocial|contribuyente/i

export function placaValida(p) {
  return /^[A-Z]{3}\d{3,4}$/.test(p) || /^[A-Z]{2}\d{3}[A-Z]$/.test(p)
}

/** Quita recursivamente cualquier campo con datos personales. */
export function sinDatosPersonales(valor) {
  if (Array.isArray(valor)) return valor.map(sinDatosPersonales)
  if (valor && typeof valor === 'object') {
    const limpio = {}
    for (const [k, v] of Object.entries(valor)) if (!PERSONALES.test(k)) limpio[k] = sinDatosPersonales(v)
    return limpio
  }
  return valor
}

function cabecerasCors(origen) {
  const permitido = origen && ORIGENES.some((re) => re.test(origen))
  return permitido ? { 'Access-Control-Allow-Origin': origen, 'Access-Control-Allow-Methods': 'GET, OPTIONS', Vary: 'Origin' } : { Vary: 'Origin' }
}

function json(cuerpo, estado, origen, extra = {}) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cabecerasCors(origen), ...extra } })
}

async function pedirSri(url, ms, pedir) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    const r = await pedir(url, { signal: c.signal, headers: { Accept: 'application/json', 'User-Agent': 'AutoPublicador/1.0 (consulta de placa)' } })
    if (!r.ok) return { estado: r.status, datos: null }
    return { estado: r.status, datos: await r.json().catch(() => null) }
  } finally { clearTimeout(t) }
}

/** Placas antiguas de 3 números se registran con un 0: «PJM343» → «PJM0343» (igual que PLACAS_EC). */
export function variantesPlaca(placa) {
  const m = placa.match(/^([A-Z]{3})(\d{3})$/)
  return m ? [`${m[1]}0${m[2]}`, placa] : [placa]
}

const lista = (d) => (Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [])

/** Consulta base + rubros (valores pendientes) + historial de pagos + plan excepcional. `pedir` se inyecta en las pruebas. */
export async function consultarPlaca(placa, pedir = fetch) {
  let base = { estado: 404, datos: null }
  let registrada = placa
  for (const v of variantesPlaca(placa)) {
    base = await pedirSri(`${SRI}/BaseVehiculo/obtenerPorNumeroPlacaOPorNumeroCampvOPorNumeroCpn?numeroPlacaCampvCpn=${v}`, 20000, pedir)
    if (base.datos && base.datos.codigoVehiculo) { registrada = v; break }
  }
  if (!base.datos || !base.datos.codigoVehiculo) return { encontrada: false, estado: base.estado }
  const codigo = base.datos.codigoVehiculo
  const opcional = (url, ms) => pedirSri(url, ms, pedir).then((r) => lista(r.datos)).catch(() => [])
  const [rubros, pagos, plan] = await Promise.all([
    opcional(`${SRI}/ConsultaRubros/obtenerPorCodigoVehiculo?codigoVehiculo=${codigo}`, 15000),
    opcional(`${SRI}/consultaPagos/obtenerPorPlacaCampvCpn?placaCampvCpn=${registrada}`, 15000),
    opcional(`${SRI}/CuotasImpAmbiental/obtenerDetallePlanExcepcionalPagosPorCodigoVehiculo?codigo=${codigo}`, 15000),
  ])
  const recientes = [...pagos].sort((x, y) => String(y.fechaDePago ?? '').localeCompare(String(x.fechaDePago ?? '')))
  // Desglose de cada valor pendiente (ConsultaComponente) y detalle de los 3 pagos más recientes (obtenerDetallesPago)
  // Pagos de matrícula de 2012 a 2020: su detalle trae el Impuesto Ambiental a la Contaminación Vehicular, que el SRI
  // calculaba con el cilindraje (de ahí se obtiene el cilindraje registrado)
  const deEpocaAmbiental = recientes.filter((p) => p.codigoRecaudacion && /^20(1[2-9]|20)/.test(String(p.fechaDePago ?? ''))
    && /MATR/i.test(p.tipoDeuda ?? '')).slice(0, 8)
  const detalle = (p) => opcional(`${SRI}/consultaPagos/obtenerDetallesPago?codigoRecaudacion=${p.codigoRecaudacion}`, 12000)
    .then((d) => ({ fechaDePago: p.fechaDePago, detalle: d }))
  const [componentes, detalles, ambientales] = await Promise.all([
    Promise.all(rubros.filter((r) => r.codigoRubro).slice(0, 8).map((r) =>
      opcional(`${SRI}/ConsultaComponente/obtenerListaComponentesPorCodigoConsultaRubro?codigoConsultaRubro=${r.codigoRubro}`, 12000)
        .then((c) => ({ codigoRubro: r.codigoRubro, componentes: c })))),
    Promise.all(recientes.filter((p) => p.codigoRecaudacion).slice(0, 3).map(detalle)),
    Promise.all(deEpocaAmbiental.map(detalle)),
  ])
  // Solo las líneas del impuesto ambiental (año fiscal, componente y valor)
  const impuestoAmbiental = ambientales.flatMap((d) => d.detalle)
    .filter((x) => /AMBIENTAL|CONTAMINACI/i.test(x.descripcionRubro ?? ''))
    .map((x) => ({ anio: x.anio, componente: x.descripcionComponente, valor: x.valor }))
  return {
    encontrada: true, registrada,
    base: sinDatosPersonales(base.datos), rubros: sinDatosPersonales(rubros),
    // Solo fecha, tipo y monto de cada pago, del más reciente al más antiguo
    pagos: recientes.map((p) => ({ fechaDePago: p.fechaDePago, tipoDeuda: p.tipoDeuda, monto: p.monto })).slice(0, 15),
    componentes: sinDatosPersonales(componentes), detallesPago: sinDatosPersonales(detalles),
    planExcepcional: sinDatosPersonales(plan), impuestoAmbiental,
    // Resumen de TODO el historial (no solo los 15 recientes): cuántos traspasos de dominio se pagaron y desde cuándo
    resumenPagos: resumirPagos(pagos),
  }
}

/** Cuenta los traspasos (pagos de transferencia de dominio, uno por fecha) y el primer y último pago registrados. */
export function resumirPagos(pagos) {
  const fechas = pagos.map((p) => String(p.fechaDePago ?? '')).filter(Boolean).sort()
  const traspasos = [...new Set(pagos.filter((p) => /TRANSFER/i.test(p.tipoDeuda ?? '')).map((p) => String(p.fechaDePago ?? '').slice(0, 10)).filter(Boolean))].sort()
  return { totalPagos: pagos.length, traspasos: traspasos.length, ultimoTraspaso: traspasos[traspasos.length - 1] ?? null,
    primerPago: fechas[0]?.slice(0, 10) ?? null, ultimoPago: fechas[fechas.length - 1]?.slice(0, 10) ?? null }
}

// ── ATM Guayaquil: consulta pública de revisiones técnicas (sin captcha). Devuelve marca, modelo y año del registro
// nacional de cualquier placa, y las revisiones hechas en Guayaquil por año. No se abren los reportes (traen datos
// del propietario).
const ATM = 'https://consultas.atm.gob.ec/SVT/paginas/consultaCertificado.jsp'
const ATM_DESDE = 2016

const sinEtiquetas = (s) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&iacute;/g, 'í').replace(/&Ntilde;/g, 'Ñ').replace(/\s+/g, ' ').trim()

/** Lee la página de ATM: datos del vehículo y filas de la tabla de revisiones. */
export function leerAtm(html) {
  const texto = sinEtiquetas(html)
  const dato = (re) => (texto.match(re)?.[1] ?? '').trim()
  const marca = dato(/MARCA\s*:\s*(.+?)\s+MODELO\s*:/)
  if (!marca) return null
  const revisiones = []
  const cuerpo = html.split(/<tbody[^>]*>/i)[1]?.split(/<\/tbody>/i)[0] ?? ''
  for (const fila of cuerpo.split(/<tr[^>]*>/i).slice(1)) {
    const celdas = [...fila.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => sinEtiquetas(m[1]))
    if (celdas.length >= 4 && /\d{2}-\d{2}-\d{4}/.test(celdas[1])) {
      const [d, m, a] = celdas[1].split('-')
      revisiones.push({ observacion: celdas[0], fecha: `${a}-${m}-${d}`, estado: celdas[2], revision: +celdas[3] || null })
    }
  }
  return { marca, modelo: dato(/MODELO\s*:\s*(.+?)\s+AÑO\s*:/), anio: dato(/AÑO\s*:\s*(\d{4})/), revisiones }
}

async function pedirAtm(placa, anio, pedir) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), 20000)
  try {
    const r = await pedir(ATM, { method: 'POST', signal: c.signal, body: `ps_placa=${placa}&ps_anio=${anio}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'AutoPublicador/1.0 (consulta de placa)' } })
    return r.ok ? leerAtm(await r.text()) : null
  } finally { clearTimeout(t) }
}

/** Datos del vehículo y revisiones técnicas de todos los años disponibles (más reciente primero). */
export async function consultarAtm(placa, pedir = fetch, hoy = new Date()) {
  const actual = hoy.getUTCFullYear()
  for (const v of variantesPlaca(placa)) {
    const primero = await pedirAtm(v, actual, pedir)
    if (!primero) continue
    const anios = []
    for (let a = actual - 1; a >= ATM_DESDE; a--) anios.push(a)
    const resto = await Promise.all(anios.map((a) => pedirAtm(v, a, pedir).catch(() => null)))
    const vistas = new Set()
    const revisiones = [primero, ...resto].flatMap((x) => x?.revisiones ?? [])
      .filter((r) => { const k = `${r.fecha}|${r.revision}|${r.estado}`; return vistas.has(k) ? false : vistas.add(k) })
      .sort((x, y) => y.fecha.localeCompare(x.fecha))
    return { encontrada: true, registrada: v, marca: primero.marca, modelo: primero.modelo, anio: primero.anio, revisiones, desde: ATM_DESDE, hasta: actual }
  }
  return { encontrada: false }
}

/** Todas las fuentes automáticas a la vez; cada una informa su propio error sin detener a las demás. */
export async function consultarTodo(placa, pedir = fetch) {
  const [sri, atm] = await Promise.all([
    consultarPlaca(placa, pedir).catch(() => ({ encontrada: false, error: 'El SRI no respondió. Intenta de nuevo en unos minutos.' })),
    consultarAtm(placa, pedir).catch(() => ({ encontrada: false, error: 'ATM Guayaquil no respondió.' })),
  ])
  return { sri, atm }
}

export async function manejar(request, pedir = fetch) {
  const url = new URL(request.url)
  const origen = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cabecerasCors(origen), 'Access-Control-Max-Age': '86400' } })
  if (request.method !== 'GET') return json({ error: 'Método no permitido' }, 405, origen)
  if (url.pathname === '/salud') return json({ ok: true, servicio: 'AutoPublicador · placas' }, 200, origen)

  const m = url.pathname.match(/^\/(placa|consulta)\/([A-Za-z0-9-]+)$/)
  if (!m) return json({ error: 'Ruta no encontrada. Usa /placa/ABC1234 o /consulta/ABC1234' }, 404, origen)
  const placa = m[2].toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!placaValida(placa)) return json({ error: 'Placa no válida' }, 400, origen)

  const cache = typeof caches !== 'undefined' ? caches.default : null
  if (m[1] === 'consulta') {
    const claveC = new Request(`https://cache.autopublicador/v1/consulta/${placa}`)
    if (cache && url.searchParams.get('nuevo') !== '1') {
      const guardada = await cache.match(claveC)
      if (guardada) return json(await guardada.json(), 200, origen, { 'X-Cache': 'HIT' })
    }
    const { sri, atm } = await consultarTodo(placa, pedir)
    const cuerpoSri = sri.encontrada
      ? { encontrada: true, registrada: sri.registrada, base: sri.base, rubros: sri.rubros, pagos: sri.pagos, componentes: sri.componentes, detallesPago: sri.detallesPago, planExcepcional: sri.planExcepcional, resumenPagos: sri.resumenPagos, impuestoAmbiental: sri.impuestoAmbiental }
      : { encontrada: false, error: sri.error ?? (sri.estado >= 500 ? 'El SRI no respondió. Intenta de nuevo en unos minutos.' : `El SRI no tiene registrada la placa ${placa}.`) }
    const cuerpo = { placa, consultado: new Date().toISOString(), sri: cuerpoSri, atm }
    // Solo se guarda si al menos una fuente respondió con datos (un fallo de red no queda en caché)
    if (cache && (sri.encontrada || atm.encontrada)) await cache.put(claveC, new Response(JSON.stringify(cuerpo), { headers: { 'Cache-Control': `max-age=${CACHE_SEGUNDOS}` } }))
    return json(cuerpo, 200, origen, { 'X-Cache': 'MISS' })
  }
  const clave = new Request(`https://cache.autopublicador/v5/placa/${placa}`)
  if (cache) {
    const guardada = await cache.match(clave)
    if (guardada) return json(await guardada.json(), 200, origen, { 'X-Cache': 'HIT' })
  }
  let r
  try { r = await consultarPlaca(placa, pedir) } catch {
    return json({ error: 'El SRI no respondió. Intenta de nuevo en unos minutos.' }, 502, origen)
  }
  if (!r.encontrada) return json({ error: `El SRI no tiene registrada la placa ${placa}.` }, r.estado >= 500 ? 502 : 404, origen)
  const cuerpo = { placa, registrada: r.registrada, base: r.base, rubros: r.rubros, pagos: r.pagos, componentes: r.componentes, detallesPago: r.detallesPago, planExcepcional: r.planExcepcional, resumenPagos: r.resumenPagos, impuestoAmbiental: r.impuestoAmbiental, consultado: new Date().toISOString() }
  if (cache) await cache.put(clave, new Response(JSON.stringify(cuerpo), { headers: { 'Cache-Control': `max-age=${CACHE_SEGUNDOS}` } }))
  return json(cuerpo, 200, origen, { 'X-Cache': 'MISS' })
}

export default { fetch: (request) => manejar(request) }
