// Sugerencias de placa: se consultan placas reales (y una inexistente) y luego se digita carácter a carácter.
//   node pruebas/e2e/sugerencias.cjs [--url ...]
const path = require('path')
const { abrirApp, navegador, clic, SALIDA } = require('./comun.cjs')
;(async () => {
  const app = await abrirApp()
  const { b, p, errores } = await navegador(app.url)
  const espera = (ms) => new Promise((r) => setTimeout(r, ms))
  const op = () => p.evaluate(() => [...document.querySelectorAll('.sugerencias li[role=option]')].map((l) => l.querySelector('.chapa').textContent + ' → ' + l.querySelector('.vehiculo').textContent))
  const fallos = []
  const exigir = (c, m) => { console.log(c ? 'ok   ' : 'FALLA', m); if (!c) fallos.push(m) }
  try {
    await clic(p, 'nav button', 'Historial')
    await p.type('textarea[aria-label=Placas]', 'PCH7548 PVS067 PCH0001')
    await clic(p, 'button', 'Consultar y guardar')
    await p.waitForFunction(() => document.querySelectorAll('.lote li').length === 3, { timeout: 240000 })
    console.log(await p.evaluate(() => document.querySelector('.lote').innerText))
    await clic(p, 'nav button', 'Crear')
    const campo = '.campo.placa input'
    let previo = 99
    for (const ch of 'PCH75') {
      await p.type(campo, ch); await espera(150)
      const o = await op(); console.log(await p.$eval(campo, (x) => x.value), o)
      exigir(o.length > 0 && o.length <= previo, 'se delimita'); previo = o.length
      if (ch === 'H') await p.screenshot({ path: path.join(SALIDA, 'sugerencias.png') })
    }
    exigir(previo === 1, 'queda una sola')
    const pedidos = []
    p.on('request', (r) => { if (/workers\.dev|sri\.gob/.test(r.url())) pedidos.push(r.url()) })
    await p.tap('.sugerencias li[role=option]'); await espera(1500)
    const modelo = await p.evaluate(() => [...document.querySelectorAll('.form-vehiculo label.campo')].find((l) => l.textContent.startsWith('Modelo'))?.querySelector('input').value)
    exigir(!!modelo, 'al elegir carga el vehículo: ' + modelo)
    exigir(!pedidos.length, 'sin volver a consultar el SRI')
    console.log('a la derecha:', await p.$eval('.placa-conocida', (x) => x.innerText))
    await p.screenshot({ path: path.join(SALIDA, 'sugerencia-elegida.png') })
    await clic(p, 'button', 'Nuevo vehículo'); await espera(400)
    await p.type(campo, 'PCH000'); await espera(150)
    const vacia = await op(); exigir(/PCH0001 → Sin datos/.test(vacia[0] || ''), 'la inexistente sale vacía: ' + vacia)
    await p.keyboard.press('Enter'); await espera(200)
    exigir((await p.$eval(campo, (x) => x.value)) === 'PCH0001', 'Enter completa la única')
    await clic(p, 'nav button', 'Historial'); await espera(200)
    exigir(await p.evaluate(() => document.body.innerText.includes('Sin respuesta:')), 'queda en el historial como sin respuesta')
    exigir(!errores.length, 'sin errores de página ' + errores)
    console.log(fallos.length ? '\nFALLA' : '\nCORRECTO'); if (fallos.length) process.exitCode = 1
  } finally { await b.close(); app.cerrar() }
})().catch((e) => { console.error('FALLO', e.message); process.exit(1) })
