// Deuda del SRI: con una placa real con valores pendientes, el campo se llena solo y el vendedor decide (casilla)
// si se menciona; marcada, aparece en la línea del precio como motivo de «negociable».
//   node pruebas/e2e/deuda.cjs [--url ...] [--placa MBA2633]
const path = require('path')
const { abrirApp, navegador, clic, guardar, SALIDA } = require('./comun.cjs')
const i = process.argv.indexOf('--placa')
const PLACA = i > 0 ? process.argv[i + 1] : 'MBA2633'

;(async () => {
  const app = await abrirApp()
  const { b, p, errores } = await navegador(app.url)
  try {
    await p.type('textarea.entrada', 'jeep patriot 9500')
    await p.type('.campo.placa input', PLACA)
    await clic(p, 'button', 'Generar publicación')
    await p.waitForFunction(() => document.body.innerText.includes('SRI ·'), { timeout: 90000 })
    await new Promise((r) => setTimeout(r, 4000))
    const campo = (etq) => p.evaluate((etq) => [...document.querySelectorAll('.form-vehiculo label.campo')].find((l) => l.querySelector('span')?.textContent.startsWith(etq))?.querySelector('input')?.value, etq)
    const descripcion = () => p.evaluate(() => [...document.querySelectorAll('textarea')].map((t) => t.value).find((t) => t.includes('Precio')) || '')
    const lineaPrecio = (d) => d.split('\n').find((l) => /Precio[^\n]*\$\d/.test(l)) || '(sin línea de precio)'
    const r = { placa: PLACA, deuda: await campo('Valores pendientes SRI'), precio: await campo('Precio ($)') }
    r.antes = lineaPrecio(await descripcion())
    r.casilla = await p.evaluate(() => [...document.querySelectorAll('label.casilla')].map((l) => l.innerText).find((t) => t.includes('deuda')) || '(no aparece)')
    await p.evaluate(() => [...document.querySelectorAll('label.casilla')].find((l) => l.innerText.includes('deuda')).querySelector('input').click())
    await new Promise((r) => setTimeout(r, 600))
    r.despues = lineaPrecio(await descripcion())
    r.ayuda = await p.evaluate(() => [...document.querySelectorAll('p.ayuda')].map((x) => x.innerText).find((t) => t.includes('deuda')) || '')
    r.errores = errores
    await p.screenshot({ path: path.join(SALIDA, 'deuda.png'), fullPage: true })
    guardar('deuda.json', r)
    console.log(JSON.stringify(r, null, 1))
    const ok = r.deuda && !/pendientes/.test(r.antes) && /negociable · valores pendientes de matrícula/.test(r.despues) && !errores.length
    console.log(ok ? '\nCORRECTO' : '\nFALLA')
    if (!ok) process.exitCode = 1
  } finally {
    await b.close()
    app.cerrar()
  }
})().catch((e) => { console.error('FALLO', e.message); process.exit(1) })
