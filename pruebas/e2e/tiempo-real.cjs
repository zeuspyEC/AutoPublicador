// Todo cambio (texto, campos, perfil, beneficios, historial, otra pestaña) se refleja al instante.   node pruebas/e2e/tiempo-real.cjs [--url ...]
const path = require('path')
const { abrirApp, navegador, clic, SALIDA } = require('./comun.cjs')
;(async () => {
  const app = await abrirApp()
  const { b, p, errores } = await navegador(app.url)
  const espera = (ms) => new Promise((r) => setTimeout(r, ms)), fallos = []
  const exigir = (c, m) => { console.log(c ? 'ok   ' : 'FALLA', m); if (!c) fallos.push(m) }
  const vista = async (n) => { await clic(p, 'nav button', n); await espera(250) }
  const campo = async (etq, valor) => { const h = await p.evaluateHandle((e) => [...document.querySelectorAll('label.campo')].find((l) => l.querySelector('span')?.textContent.startsWith(e)).querySelector('input'), etq); await h.evaluate((x) => { x.focus(); x.select() }); await p.keyboard.press('Backspace'); if (valor) await p.keyboard.type(valor); await espera(250) }
  const valor = (etq) => p.evaluate((e) => [...document.querySelectorAll('label.campo')].find((l) => l.querySelector('span')?.textContent.startsWith(e)).querySelector('input').value, etq)
  const desc = () => p.$eval('.descripcion textarea', (x) => x.value)
  const hist = async () => { await vista('Historial'); const r = await p.evaluate(() => document.querySelector('.historial')?.innerText ?? ''); await vista('Crear'); return r }
  // Texto que de verdad se copiaría del historial
  const copiaHist = async () => { await vista('Historial'); await p.evaluate(() => { window.__c = ''; navigator.clipboard.writeText = async (t) => { window.__c = t } }); await clic(p, '.historial button', 'Copiar descripción'); await espera(200); const r = await p.evaluate(() => window.__c); await vista('Crear'); return r }
  try {
    p.on('dialog', (d) => d.accept())
    await p.type('textarea.entrada', 'Chevrolet Corsa 1.4 2002 manual rojo 3990'); await clic(p, 'button', 'Generar publicación')
    await p.waitForSelector('.descripcion textarea', { timeout: 20000 }); await espera(5000)
    await clic(p, 'button', 'Guardar en el historial'); await espera(300)
    exigir(await p.evaluate(() => /se actualiza sola/.test(document.body.innerText)), 'guardada y en vivo')
    // texto libre en vivo
    await p.$eval('textarea.entrada', (x) => { x.focus(); x.setSelectionRange(1e4, 1e4) }); await p.type('textarea.entrada', ' aire acondicionado 120000 km precio fijo'); await espera(900)
    let d = await desc(); exigir(/120\.000 km/.test(d) && /aire acondicionado/i.test(d) && /precio fijo/i.test(d) && !/negociable/i.test(d), 'el texto libre actualiza sin volver a generar')
    exigir(/120\.000/.test(await copiaHist()), 'y también la del historial')
    // retoque + campos
    await p.$eval('.descripcion textarea', (x) => { x.focus(); x.setSelectionRange(1e4, 1e4) }); await p.type('.descripcion textarea', ' MI FRASE'); await espera(200)
    await campo('Precio ($)', '4200'); await campo('Color', 'azul')
    d = await desc(); exigir(/MI FRASE/.test(d) && /4\.200/.test(d) && !/3\.990/.test(d) && /azul/i.test(d) && !/rojo/i.test(d), 'cambiar precio y color conserva el retoque')
    d = await copiaHist(); exigir(/MI FRASE/.test(d) && /4\.200/.test(d) && /azul/i.test(d), 'el historial tiene lo mismo')
    await campo('Color', ''); d = await desc(); exigir(!/azul/i.test(d), 'vaciar el color lo quita')
    await p.evaluate(() => [...document.querySelectorAll('.casilla')].find((x) => x.textContent.startsWith('Recibe')).querySelector('input').click()); await espera(250)
    d = await copiaHist(); exigir(!/parte de pago|cambia/i.test(d) && /MI FRASE/.test(d), 'quitar una etiqueta actualiza el historial')
    // perfil y beneficios
    await vista('Ajustes'); await campo('Tu número', '0991112233'); await campo('Tu nombre', 'Nuevo Nombre')
    await p.evaluate(() => document.querySelector('.beneficios input[type=checkbox]') && [...document.querySelectorAll('.beneficios li')].find((l) => /Garant/.test(l.querySelector('input:not([type=checkbox])').value)).querySelector('input[type=checkbox]').click()); await espera(250)
    d = await copiaHist(); exigir(/0991\.112\.233/.test(d) && !/0987/.test(d) && /nuevo nombre/i.test(d) && !/garant/i.test(d), 'perfil y beneficios actualizan el historial sin pulsar guardar')
    d = await desc(); exigir(/0991\.112\.233/.test(d) && !/garant/i.test(d) && /MI FRASE/.test(d), 'y la publicación en pantalla')
    // cambio de modelo: lo investigado del anterior se va
    await campo('Modelo', 'Vitara'); await espera(9000)
    d = await desc(); exigir(/vitara/i.test(d) && !/corsa/i.test(d), 'cambiar el modelo actualiza todo')
    exigir(await p.evaluate(() => /Vitara/.test(document.body.innerText) && !/Wikipedia[^\n]*Corsa|Corsa[^\n]*Wikipedia|Opel Corsa/.test(document.body.innerText)), 'la investigación es del modelo nuevo')
    exigir(/vitara/i.test(await hist()) , 'título del historial al día')
    // recarga y otra pestaña
    await p.reload({ waitUntil: 'networkidle0' }); await p.waitForSelector('.descripcion textarea'); d = await desc()
    exigir(/MI FRASE/.test(d) && /vitara/i.test(d), 'recargar conserva todo')
    const q = await b.newPage(); await q.goto(app.url, { waitUntil: 'networkidle0' }); await p.bringToFront()
    await campo('Precio ($)', '5100'); await q.bringToFront(); await clic(q, 'nav button', 'Historial'); await espera(400)
    await q.evaluate(() => { navigator.clipboard.writeText = async (t) => { window.__c = t } }); await clic(q, '.historial button', 'Copiar descripción'); await espera(300)
    exigir(/5\.100/.test(await q.evaluate(() => window.__c)), 'la otra pestaña se entera'); await p.bringToFront()
    await p.evaluate(() => scrollTo(0, 1e6)); await espera(300); await p.screenshot({ path: path.join(SALIDA, 'tiempo-real.png') })
    exigir(await p.evaluate(() => JSON.parse(localStorage.getItem('ap.historial')).length === 1), 'una sola publicación (no se duplica)')
    exigir(!errores.length, 'sin errores ' + errores.join('|'))
  } catch (e) { fallos.push(e.message); console.log(e) }
  await b.close(); app.cerrar?.()
  console.log(fallos.length ? 'INCORRECTO ' + fallos.join('; ') : 'CORRECTO'); process.exit(fallos.length ? 1 : 0)
})()
