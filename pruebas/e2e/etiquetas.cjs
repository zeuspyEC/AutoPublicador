// Etiquetas en tiempo real con una placa real: marcar/quitar, etiqueta propia, volver a generar y sección Respuestas.
//   node pruebas/e2e/etiquetas.cjs [--url ...]
const path = require('path')
const { abrirApp, navegador, clic, SALIDA } = require('./comun.cjs')
;(async () => {
  const app = await abrirApp()
  const { b, p, errores } = await navegador(app.url)
  const espera = (ms) => new Promise((r) => setTimeout(r, ms))
  const fallos = []
  const exigir = (c, m) => { console.log(c ? 'ok   ' : 'FALLA', m); if (!c) fallos.push(m) }
  const marca = async (n) => { await p.evaluate((n) => [...document.querySelectorAll('.casilla')].find((x) => x.textContent.startsWith(n)).querySelector('input').click(), n); await espera(200) }
  const vista = async (n) => { await clic(p, 'nav button', n); await espera(200) }
  const textos = async () => {
    const r = await p.evaluate(async () => {
      const o = [...document.querySelectorAll('.texto-titulo')].map((x) => x.value)
      for (const t of document.querySelectorAll('.pestana')) { t.click(); await new Promise((r) => setTimeout(r, 60)); o.push(document.querySelector('.descripcion textarea').value) }
      return o
    })
    await vista('Respuestas')
    const c = await p.evaluate(() => [...document.querySelectorAll('.comentarios p')].map((x) => x.textContent))
    await vista('Crear')
    return [...r, ...c]
  }
  try {
    p.on('dialog', (d) => d.accept())
    await p.type('.campo.placa input', 'MCY0327'); await clic(p, 'button', 'Generar publicación')
    await p.waitForFunction(() => /SRI · placa/.test(document.body.innerText) && [...document.querySelectorAll('.form-vehiculo label.campo')].find((l) => l.textContent.startsWith('Modelo'))?.querySelector('input').value, { timeout: 90000 })
    await espera(3000)
    let t = await textos(); console.log('textos', t.length)
    exigir(t.some((x) => /negociable|conversable/i.test(x)) && !t.some((x) => /precio fijo/i.test(x)), 'empieza negociable')
    await marca('Negociable'); t = await textos()
    exigir(!t.some((x) => /negociable|conversable|descuento/i.test(x)), 'sin «negociable» en ningún texto'); exigir(t.filter((x) => /precio fijo/i.test(x)).length >= 13, 'dice precio fijo')
    if (await p.evaluate(() => !!document.querySelector('.casillas') && /Mencionar la deuda/.test(document.querySelector('.casillas').textContent))) { await marca('Mencionar'); t = await textos(); exigir(!t.some((x) => /negociable/i.test(x)) && t.some((x) => /pendientes de matrícula/.test(x)), 'la deuda no vuelve a poner negociable') }
    await marca('Recibe cambio'); t = await textos(); exigir(!t.some((x) => /parte de pago|vendo ?\/\/|se cambia/i.test(x)), 'sin cambio en ningún texto')
    await marca('Cero multas'); await marca('A toda prueba'); await marca('Full equipo'); t = await textos()
    const ds = t.filter((x) => /NO DAMOS FINANCIAMIENTO/.test(x) && x.includes('\n'))
    exigir(ds.length === 12 && ds.every((x) => /cero multas/i.test(x) && /toda prueba/i.test(x) && /full equipo/i.test(x)), 'las 12 descripciones llevan las tres marcadas')
    await p.type('input[aria-label="Nueva etiqueta"]', 'Llantas nuevas'); await p.keyboard.press('Enter'); await espera(300)
    t = await textos(); exigir(t.filter((x) => /llantas nuevas/i.test(x)).length >= 14, 'etiqueta propia en todas')
    await p.type('input[aria-label="Nueva etiqueta"]', 'precio fijo'); await p.keyboard.press('Enter'); await espera(200)
    exigir(await p.evaluate(() => /ya existe/.test(document.body.innerText)), 'rechaza repetidas')
    await clic(p, 'button', 'Generar publicación'); await espera(9000)
    t = await textos(); exigir(!t.some((x) => /negociable|parte de pago/i.test(x)) && t.some((x) => /llantas nuevas/i.test(x)), 'volver a generar conserva las etiquetas')
    await p.reload(); await espera(1500); t = await textos(); exigir(!t.some((x) => /negociable/i.test(x)) && t.some((x) => /llantas nuevas/i.test(x)), 'recargar las conserva')
    await marca('Llantas nuevas'); t = await textos(); exigir(!t.some((x) => /llantas/i.test(x)), 'al quitarla desaparece')
    await marca('Negociable'); t = await textos(); exigir(!t.some((x) => /precio fijo/i.test(x)), 'de vuelta a negociable')
    await p.evaluate(() => document.querySelector('.casillas').scrollIntoView({ block: 'center' })); await p.screenshot({ path: path.join(SALIDA, 'etiquetas.png') })
    await p.evaluate(() => scrollTo(0, 1e6)); await espera(300); await p.screenshot({ path: path.join(SALIDA, 'final.png') })
    exigir(await p.evaluate(() => { const c = [...document.querySelectorAll('button')].find((x) => /Copiar descripción/.test(x.textContent)); return c.getBoundingClientRect().top < innerHeight }), 'al final está la descripción')
    await vista('Respuestas'); await p.screenshot({ path: path.join(SALIDA, 'respuestas.png') })
    exigir(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sin desborde horizontal')
    exigir(await p.evaluate(() => [...document.querySelectorAll('nav button')].at(-1).textContent === 'Respuestas' && [...document.querySelectorAll('nav button')].at(-1).getBoundingClientRect().right <= innerWidth + 1), 'Respuestas a la derecha y visible')
    exigir(!errores.length, 'sin errores de consola ' + errores.join(' | '))
  } catch (e) { fallos.push(e.message); console.log(e) }
  await b.close(); app.cerrar?.()
  console.log(fallos.length ? 'INCORRECTO ' + fallos.join('; ') : 'CORRECTO'); process.exit(fallos.length ? 1 : 0)
})()
