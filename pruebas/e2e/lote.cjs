// «Varias placas» con placas reales: cada una pasa por el servidor de placas (SRI real) y Wikipedia en vivo y queda en
// el historial. Informe de campos completados (con su fuente) en salida/lote.md y los datos en salida/lote.json.
//   node pruebas/e2e/lote.cjs [--url https://zeuspyec.github.io/AutoPublicador/] [--placas "PBA1234 PCH7548"]
const path = require('path')
const { abrirApp, navegador, clic, guardar, SALIDA } = require('./comun.cjs')

const PLACAS_PRUEBA = 'PVS067 MCY0327 HAK0679 PUB0356 MBA2633 PCH7548 PJH665 YAA0208 PJM343 JQ094F TBX0160 PCQ5678 GSB1234 HBA1234 IA123B'
const i = process.argv.indexOf('--placas')
const PLACAS = i > 0 ? process.argv[i + 1] : PLACAS_PRUEBA
const CAMPOS = ['marca', 'modelo', 'version', 'anio', 'motor', 'transmision', 'combustible', 'carroceria', 'traccion', 'puertas', 'procedencia', 'matricula']

;(async () => {
  const app = await abrirApp()
  const { b, p, errores } = await navegador(app.url)
  try {
    await clic(p, 'header button, nav button', 'Historial')
    await p.waitForSelector('textarea[aria-label="Placas"]')
    await p.type('textarea[aria-label="Placas"]', PLACAS)
    const total = PLACAS.trim().split(/[\s,;.]+/).filter(Boolean).length
    await clic(p, 'button', 'Consultar y guardar')
    await p.waitForFunction((n) => document.querySelectorAll('.lote li').length >= n, { timeout: 600000, polling: 1000 }, total)
    const lote = await p.$$eval('.lote li', (l) => l.map((x) => x.innerText))
    const datos = await p.evaluate(() => ({ historial: JSON.parse(localStorage.getItem('ap.historial') || '[]'), placas: JSON.parse(localStorage.getItem('ap.placas') || '[]') }))
    await p.screenshot({ path: path.join(SALIDA, 'lote.png'), fullPage: true })

    const filas = [...datos.historial].reverse().map((h) => {
      const sri = datos.placas.find((x) => x.placa === h.placa)?.resultado
      const campos = CAMPOS.map((c) => `${c}: ${h.vehiculo[c] ? `${h.vehiculo[c]} (${h.origenes[c]})` : '—'}`).join(' · ')
      const info = (sri?.hallazgos ?? []).filter((x) => !x.campo).map((x) => `${x.etiqueta}: ${x.valor}`)
      return `## ${h.placa}\n\n${campos}\n\n- ${info.join('\n- ')}\n${(sri?.avisos ?? []).map((a) => `- ⚠️ ${a}`).join('\n')}\n\n**Título:** ${h.titulo}\n\n**Descripción:**\n\n${h.descripcion}\n`
    })
    guardar('lote.json', { url: app.url, lote, ...datos, errores })
    guardar('lote.md', `# Varias placas — ${new Date().toISOString()}\n\nURL: ${app.url}\n\n${filas.join('\n---\n\n')}`)
    console.log(lote.join('\n'))
    const fallos = lote.filter((x) => x.includes('❌'))
    console.log(`\n${lote.length - fallos.length}/${lote.length} placas guardadas · errores de la página: ${errores.length}`)
    console.log(`Informe: ${path.join(SALIDA, 'lote.md')}`)
    if (errores.length) process.exitCode = 1
  } finally {
    await b.close()
    app.cerrar()
  }
})().catch((e) => { console.error('FALLO', e.message); process.exit(1) })
