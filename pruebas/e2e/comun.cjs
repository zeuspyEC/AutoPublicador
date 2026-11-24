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

module.exports = { abrirApp, navegador, clic, guardar, SALIDA }
