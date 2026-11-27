// Página «Consulta de placas» de punta a punta, con consultas REALES al servidor publicado (SRI + ATM Guayaquil):
// verificación cruzada, ficha, valores, revisiones, enlaces oficiales, informe, recientes, tema claro/oscuro con
// contraste medido, sin desbordamiento en celular e impresión.   node pruebas/e2e/placas.cjs [--url ...]
const path = require('path')
const { abrirApp, navegador, medirContraste, SALIDA } = require('./comun.cjs')

;(async () => {
  const app = await abrirApp()
  const pagina = app.url.replace(/\/?$/, '/') + 'placas/'
  const { b, p, errores } = await navegador(pagina)
  const espera = (ms) => new Promise((r) => setTimeout(r, ms)), fallos = []
  const exigir = (c, m) => { console.log(c ? 'ok   ' : 'FALLA', m); if (!c) fallos.push(m) }
  const sinDesborde = () => p.evaluate(() => Math.max(document.documentElement.scrollWidth, innerWidth) <= 391)
  const texto = (s) => p.$eval(s, (e) => e.textContent).catch(() => '')
  const foto = (n) => p.screenshot({ path: path.join(SALIDA, `placas-${n}.png`), fullPage: true })
  const contraste = async (donde) => {
    const malos = await p.evaluate(medirContraste)
    exigir(!malos.length, `contraste suficiente en ${donde}${malos.length ? ':\n      ' + malos.slice(0, 8).join('\n      ') : ''}`)
  }
  const tema = async (t) => {
    await p.evaluate((t) => localStorage.setItem('ap.placas.tema', JSON.stringify(t)), t)
    await p.reload({ waitUntil: 'networkidle0' })
  }
  const consultar = async (placa) => {
    await p.$eval('#placa', (e) => { e.value = '' })
    await p.type('#placa', placa)
    await p.click('form button[type=submit]')
    await p.waitForSelector('.resultado-placa, .error-consulta', { timeout: 90000 })
  }
  await p.evaluateOnNewDocument(() => { window.__copiado = ''; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__copiado = t } } }) })

  try {
    // 1) Página vacía
    await p.reload({ waitUntil: 'networkidle0' })
    exigir((await p.title()) === 'Consulta de placas', 'título de la página')
    exigir((await texto('.presentacion')).includes('Verificación cruzada'), 'explica qué se obtiene')
    exigir(await sinDesborde(), 'inicio sin desbordamiento a 390 px')
    await contraste('inicio (claro)')

    // 2) Placa inválida
    await consultar('AB12')
    exigir((await texto('.error-consulta')).includes('placa válida'), 'avisa que la placa no es válida')

    // 3) Placa real con datos en SRI y ATM (con guion y minúsculas: se normaliza)
    await consultar('gsd-5678')
    exigir((await p.$eval('#placa', (e) => e.value)) === 'GSD5678', 'normaliza «gsd-5678» → GSD5678')
    exigir((await texto('.sello')).includes('verificados en 2 fuentes'), 'GSD5678: verificada en 2 fuentes')
    const estados = await p.$$eval('#t-verif ~ .tabla-scroll .etiqueta-estado', (x) => x.map((e) => e.textContent))
    exigir(estados.length === 3 && estados.every((e) => e.includes('Coincide')), `marca, modelo y año coinciden (${estados.join(', ')})`)
    exigir((await texto('.ficha')).includes('Chevrolet'), 'ficha del SRI con la marca')
    exigir((await p.$$('#t-rtv ~ .tabla-scroll tbody tr')).length > 0, 'tabla de revisiones técnicas de ATM con filas')
    exigir((await texto('#t-pagos ~ .cifras')).includes('Pagos registrados'), 'resumen del historial de pagos')
    exigir((await p.$$('.otras-fuentes li')).length === 5, '5 consultas oficiales con enlace (ANT, AMT ×2, CTE, SRI)')
    exigir(new URL(p.url()).search === '?placa=GSD5678', 'la dirección queda con ?placa= para compartir')
    exigir(await sinDesborde(), 'resultado sin desbordamiento a 390 px')
    const tablasAnchas = await p.$$eval('.tabla-scroll', (x) => x.filter((e) => e.scrollWidth > e.clientWidth + 1).length)
    exigir(tablasAnchas === 0, `todas las tablas caben sin desplazarse de lado (${tablasAnchas} no caben)`)
    await contraste('resultado (claro)')
    await foto('resultado-claro')

    // 4) Copiar informe
    await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Copiar informe')).click())
    await espera(300)
    const informe = await p.evaluate(() => window.__copiado)
    exigir(informe.startsWith('INFORME DE PLACA GSD5678') && informe.includes('Fuentes: SRI'), 'copia el informe completo')
    exigir((await p.$eval('a[href^="https://wa.me/"]', (a) => a.href)).includes('INFORME%20DE%20PLACA'), 'enlace de WhatsApp con el informe')

    // 5) Tema oscuro: misma página abierta por enlace directo (se consulta sola; ahora desde la caché)
    await tema('oscuro')
    await p.waitForSelector('.resultado-placa', { timeout: 90000 })
    exigir(await p.evaluate(() => document.documentElement.dataset.tema === 'oscuro'), 'tema oscuro aplicado y recordado')
    exigir((await p.$eval('meta[name="theme-color"]', (m) => m.content)) === '#0b1020', 'barra del navegador oscura')
    await contraste('resultado (oscuro)')
    await foto('resultado-oscuro')
    await p.click('.boton.tema')
    exigir(await p.evaluate(() => !document.documentElement.dataset.tema), 'el botón de tema pasa a Automático')

    // 6) Moto con valores pendientes
    await tema('claro')
    await p.waitForSelector('.resultado-placa', { timeout: 90000 })
    await consultar('JQ094F')
    exigir((await texto('#t-valores ~ .cifras, #t-valores ~ .estado-ok')).length > 0, 'JQ094F: sección de valores pendientes')
    exigir(await sinDesborde(), 'moto sin desbordamiento')
    await contraste('moto (claro)')
    await foto('moto-claro')

    // 7) Recientes después de recargar
    await p.goto(pagina, { waitUntil: 'networkidle0' })
    const recientes = await p.$$eval('.recientes .chip', (x) => x.map((e) => e.textContent))
    exigir(recientes[0] === 'JQ094F' && recientes.includes('GSD5678'), `recientes guardados (${recientes.join(', ')})`)
    await p.evaluate(() => document.querySelector('.recientes .chip').click())
    await p.waitForSelector('.resultado-placa', { timeout: 90000 })
    exigir((await texto('.titulo-placa .chapa')) === 'JQ094F', 'tocar un reciente lo vuelve a consultar')

    // 8) Impresión: sin buscador ni botones
    await p.emulateMediaType('print')
    const ocultos = await p.evaluate(() => ['.buscador-placa', '.acciones', '.otras-fuentes'].every((s) => { const e = document.querySelector(s); return !e || getComputedStyle(e.closest('.no-imprimir') ?? e).display === 'none' }))
    exigir(ocultos, 'al imprimir se ocultan buscador, botones y enlaces')
    await p.emulateMediaType('screen')

    exigir(!errores.length, `sin errores de JavaScript${errores.length ? ': ' + errores.join(' | ') : ''}`)
  } catch (e) {
    fallos.push(e.message)
    console.log('FALLA', e.message)
    await foto('error').catch(() => {})
  } finally {
    await b.close()
    app.cerrar()
  }
  console.log(fallos.length ? `\n${fallos.length} FALLA(S)` : '\nCORRECTO')
  process.exit(fallos.length ? 1 : 0)
})()
