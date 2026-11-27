// Utilidades de las pruebas de punta a punta REALES: Chrome (puppeteer-core) contra la app compilada, el servidor de
// placas publicado (SRI real) y Wikipedia en vivo. No se intercepta ni se simula nada.
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer-core')

const RAIZ = path.resolve(__dirname, '../..')
const SALIDA = path.join(__dirname, 'salida')
fs.mkdirSync(SALIDA, { recursive: true })

const CHROME = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((c) => c && fs.existsSync(c))

/** URL a probar: argumento --url, o la app compilada servida aquí mismo con «vite preview». */
async function abrirApp() {
  const i = process.argv.indexOf('--url')
  if (i > 0) return { url: process.argv[i + 1], cerrar: () => {} }
  const vite = spawn(process.execPath, [path.join(RAIZ, 'node_modules/vite/bin/vite.js'), 'preview', '--port', '4174', '--strictPort'], { cwd: RAIZ, stdio: 'ignore' })
  const url = 'http://localhost:4174/AutoPublicador/'
  for (let n = 0; n < 40; n++) {
    try { if ((await fetch(url)).ok) break } catch { /* aún arrancando */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  return { url, cerrar: () => vite.kill() }
}

async function navegador(url) {
  if (!CHROME) throw new Error('No se encontró Chrome: indica su ruta con la variable CHROME')
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
  const p = await b.newPage()
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const errores = []
  p.on('pageerror', (e) => errores.push(e.message))
  await p.goto(url, { waitUntil: 'networkidle0' })
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('ap.perfil', JSON.stringify({ nombre: 'Vendedor de Prueba', telefono: '0987654321', estiloTelefono: 'puntos', horario: '' })) })
  await p.reload({ waitUntil: 'networkidle0' })
  return { b, p, errores }
}

const clic = (p, selector, texto) => p.evaluate((s, t) => [...document.querySelectorAll(s)].find((x) => x.textContent.trim().startsWith(t)).click(), selector, texto)
const guardar = (nombre, datos) => fs.writeFileSync(path.join(SALIDA, nombre), typeof datos === 'string' ? datos : JSON.stringify(datos, null, 1))

/** Textos con contraste insuficiente (WCAG AA: 4.5 normal, 3 grande o negrita ≥ 18.66px). */
const medirContraste = () => {
  const rgba = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a } }
  const lum = ({ r, g, b }) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const mezclar = (arriba, abajo) => ({ r: arriba.r * arriba.a + abajo.r * (1 - arriba.a), g: arriba.g * arriba.a + abajo.g * (1 - arriba.a), b: arriba.b * arriba.a + abajo.b * (1 - arriba.a), a: 1 })
  const fondo = (el) => {
    const capas = []
    for (let x = el; x; x = x.parentElement) { const c = rgba(getComputedStyle(x).backgroundColor); if (c && c.a > 0) { capas.push(c); if (c.a >= 1) break } }
    let f = rgba(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }
    for (const c of capas.reverse()) f = mezclar(c, f)
    return f
  }
  const malos = []
  for (const el of document.querySelectorAll('body *')) {
    if (!['SCRIPT', 'STYLE'].includes(el.tagName) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && el.value) {
      const cs = getComputedStyle(el), r = el.getBoundingClientRect()
      if (!r.width || !r.height || cs.visibility === 'hidden' || el.closest('[disabled], .solo-lectores, option')) continue
      if (/^[\p{Extended_Pictographic}\s️‍]+$/u.test(el.textContent.trim())) continue // solo emojis
      const t = rgba(cs.color), f = fondo(el)
      const c = mezclar(t, f), L1 = lum(c), L2 = lum(f)
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
      const tam = parseFloat(cs.fontSize), grande = tam >= 24 || (tam >= 18.66 && +cs.fontWeight >= 700)
      if (ratio < (grande ? 3 : 4.5)) malos.push(`${ratio.toFixed(2)} «${(el.value || el.textContent).trim().slice(0, 40)}» <${el.tagName.toLowerCase()} class="${el.className}">`)
    }
  }
  return malos
}

module.exports = { abrirApp, navegador, clic, guardar, medirContraste, SALIDA }
