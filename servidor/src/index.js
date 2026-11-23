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

/** Consulta base + rubros (valores pendientes). `pedir` se inyecta en las pruebas. */
export async function consultarPlaca(placa, pedir = fetch) {
  const base = await pedirSri(`${SRI}/BaseVehiculo/obtenerPorNumeroPlacaOPorNumeroCampvOPorNumeroCpn?numeroPlacaCampvCpn=${placa}`, 20000, pedir)
  if (!base.datos || !base.datos.codigoVehiculo) return { encontrada: false, estado: base.estado }
  let rubros = []
  try {
    const r = await pedirSri(`${SRI}/ConsultaRubros/obtenerPorCodigoVehiculo?codigoVehiculo=${base.datos.codigoVehiculo}`, 15000, pedir)
    if (Array.isArray(r.datos)) rubros = r.datos
  } catch { /* sin rubros: se devuelve solo la base */ }
  return { encontrada: true, base: sinDatosPersonales(base.datos), rubros: sinDatosPersonales(rubros) }
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
  const clave = new Request(`https://cache.autopublicador/placa/${placa}`)
  if (cache) {
    const guardada = await cache.match(clave)
    if (guardada) return json(await guardada.json(), 200, origen, { 'X-Cache': 'HIT' })
  }
  let r
  try { r = await consultarPlaca(placa, pedir) } catch {
    return json({ error: 'El SRI no respondió. Intenta de nuevo en unos minutos.' }, 502, origen)
  }
  if (!r.encontrada) return json({ error: `El SRI no tiene registrada la placa ${placa}.` }, r.estado >= 500 ? 502 : 404, origen)
  const cuerpo = { placa, base: r.base, rubros: r.rubros, consultado: new Date().toISOString() }
  if (cache) await cache.put(clave, new Response(JSON.stringify(cuerpo), { headers: { 'Cache-Control': `max-age=${CACHE_SEGUNDOS}` } }))
  return json(cuerpo, 200, origen, { 'X-Cache': 'MISS' })
}

export default { fetch: (request) => manejar(request) }
