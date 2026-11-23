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
  const [componentes, detalles] = await Promise.all([
    Promise.all(rubros.filter((r) => r.codigoRubro).slice(0, 8).map((r) =>
      opcional(`${SRI}/ConsultaComponente/obtenerListaComponentesPorCodigoConsultaRubro?codigoConsultaRubro=${r.codigoRubro}`, 12000)
        .then((c) => ({ codigoRubro: r.codigoRubro, componentes: c })))),
    Promise.all(recientes.filter((p) => p.codigoRecaudacion).slice(0, 3).map((p) =>
      opcional(`${SRI}/consultaPagos/obtenerDetallesPago?codigoRecaudacion=${p.codigoRecaudacion}`, 12000)
        .then((d) => ({ fechaDePago: p.fechaDePago, detalle: d })))),
  ])
  return {
    encontrada: true, registrada,
    base: sinDatosPersonales(base.datos), rubros: sinDatosPersonales(rubros),
    // Solo fecha, tipo y monto de cada pago, del más reciente al más antiguo
    pagos: recientes.map((p) => ({ fechaDePago: p.fechaDePago, tipoDeuda: p.tipoDeuda, monto: p.monto })).slice(0, 15),
    componentes: sinDatosPersonales(componentes), detallesPago: sinDatosPersonales(detalles),
    planExcepcional: sinDatosPersonales(plan),
  }
}

export async function manejar(request, pedir = fetch) {
  const url = new URL(request.url)
  const origen = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cabecerasCors(origen), 'Access-Control-Max-Age': '86400' } })
  if (request.method !== 'GET') return json({ error: 'Método no permitido' }, 405, origen)
  if (url.pathname === '/salud') return json({ ok: true, servicio: 'AutoPublicador · placas' }, 200, origen)

  const m = url.pathname.match(/^\/placa\/([A-Za-z0-9-]+)$/)
  if (!m) return json({ error: 'Ruta no encontrada. Usa /placa/ABC1234' }, 404, origen)
  const placa = m[1].toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!placaValida(placa)) return json({ error: 'Placa no válida' }, 400, origen)

  const cache = typeof caches !== 'undefined' ? caches.default : null
  const clave = new Request(`https://cache.autopublicador/v3/placa/${placa}`)
  if (cache) {
    const guardada = await cache.match(clave)
    if (guardada) return json(await guardada.json(), 200, origen, { 'X-Cache': 'HIT' })
  }
  let r
  try { r = await consultarPlaca(placa, pedir) } catch {
    return json({ error: 'El SRI no respondió. Intenta de nuevo en unos minutos.' }, 502, origen)
  }
  if (!r.encontrada) return json({ error: `El SRI no tiene registrada la placa ${placa}.` }, r.estado >= 500 ? 502 : 404, origen)
  const cuerpo = { placa, registrada: r.registrada, base: r.base, rubros: r.rubros, pagos: r.pagos, componentes: r.componentes, detallesPago: r.detallesPago, planExcepcional: r.planExcepcional, consultado: new Date().toISOString() }
  if (cache) await cache.put(clave, new Response(JSON.stringify(cuerpo), { headers: { 'Cache-Control': `max-age=${CACHE_SEGUNDOS}` } }))
  return json(cuerpo, 200, origen, { 'X-Cache': 'MISS' })
}

export default { fetch: (request) => manejar(request) }
