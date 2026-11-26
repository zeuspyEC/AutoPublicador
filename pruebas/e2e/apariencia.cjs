// Tema claro/oscuro, letra grande y mejoras v0.14.0 en TODAS las pantallas: contraste medido de cada texto visible (WCAG),
// capturas por tema, sin desbordamiento, nombre de ejemplo neutro, historial (buscar, estado, duplicar, deshacer),
// respuestas propias y copia de seguridad.   node pruebas/e2e/apariencia.cjs [--url ...]
const path = require('path')
const { abrirApp, navegador, clic, SALIDA } = require('./comun.cjs')

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

;(async () => {
  const app = await abrirApp()
  const { b, p, errores } = await navegador(app.url)
  const espera = (ms) => new Promise((r) => setTimeout(r, ms)), fallos = []
  const exigir = (c, m) => { console.log(c ? 'ok   ' : 'FALLA', m); if (!c) fallos.push(m) }
  const sinDesborde = () => p.evaluate(() => Math.max(document.documentElement.scrollWidth, innerWidth) <= 391)
  const foto = (n) => p.screenshot({ path: path.join(SALIDA, `tema-${n}.png`), fullPage: true })
  const ir = async (v) => { await clic(p, 'nav button', v); await espera(350) }
  const revisar = async (pantalla) => {
    const malos = await p.evaluate(medirContraste)
    exigir(!malos.length, `contraste suficiente en ${pantalla}${malos.length ? ':\n      ' + malos.slice(0, 8).join('\n      ') : ''}`)
    exigir(await sinDesborde(), `sin desplazamiento horizontal en ${pantalla}`)
  }
  try {
    p.on('dialog', (d) => d.accept())
    // ---------- bienvenida: nombre de ejemplo neutro ----------
    await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle0' })
    exigir(await p.$eval('input[autocomplete="name"]', (x) => x.placeholder) === 'Ej.: Juan Pérez', 'el nombre de ejemplo es genérico')
    exigir(!/erick|costa/i.test(await p.content()), 'ningún nombre real en la página')
    for (const modo of ['light', 'dark']) {
      await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: modo }]); await espera(200)
      await revisar(`la bienvenida (${modo === 'light' ? 'teléfono claro' : 'teléfono oscuro'})`)
      await foto(`bienvenida-${modo}`)
    }
    await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
    await p.type('input[autocomplete="name"]', 'Vendedor de Prueba'); await p.type('input[autocomplete="tel"]', '0987654321')
    await clic(p, 'button', 'Empezar'); await espera(400)

    // ---------- datos para todas las pantallas ----------
    await p.evaluate(() => { window.__c = ''; navigator.clipboard.writeText = async (t) => { window.__c = t } })
    await p.type('textarea.entrada', 'Chevrolet Corsa 1.4 2002 manual rojo, matrícula 2025 cero multas, aire, 3990 negociable'); await clic(p, 'button', 'Generar publicación')
    await p.waitForSelector('.etiquetas-fb .chip', { timeout: 20000 }); await espera(2500)
    await clic(p, 'button', 'Guardar en el historial'); await espera(300)
    exigir(await p.$$eval('a.boton', (xs) => xs.some((x) => x.textContent === 'Enviar por WhatsApp' && x.href.startsWith('https://wa.me/?text=') && decodeURIComponent(x.href).includes('Corsa'))), 'botón «Enviar por WhatsApp» con título y descripción')
    await clic(p, 'button', 'Copiar título + descripción'); await espera(150)
    exigir(/CORSA|Corsa/.test(await p.evaluate(() => window.__c)) && (await p.evaluate(() => window.__c)).includes('\n\n'), 'copiar título y descripción juntos')
    exigir(/\d+ caracteres · \d+ líneas/.test(await p.$eval('.contador', (x) => x.textContent)), 'contador de caracteres de la descripción')

    // respuestas propias (Ajustes) → Respuestas
    await ir('Ajustes')
    await clic(p, 'button', '➕ Nueva respuesta'); await espera(200)
    await p.type('.respuesta-propia input', 'Mi saludo'); await p.type('.respuesta-propia textarea', 'Hola, el ')
    await clic(p, '.campos-respuesta .chip', '{vehiculo}'); await p.focus('.respuesta-propia textarea'); await p.keyboard.press('End'); await p.keyboard.type(' sigue en ')
    await clic(p, '.campos-respuesta .chip', '{precio}'); await espera(200)
    await ir('Respuestas')
    const propia = await p.evaluate(() => [...document.querySelectorAll('.comentarios li')].find((l) => l.querySelector('small').textContent === 'Mi saludo')?.querySelector('p').textContent)
    exigir(propia === 'Hola, el Chevrolet Corsa 2002 sigue en $3.990', `respuesta propia con los datos del vehículo: «${propia}»`)

    // ---------- cada tema, cada pantalla ----------
    for (const tema of ['Claro', 'Oscuro']) {
      await ir('Ajustes'); await clic(p, '.segmentado label', tema === 'Claro' ? '☀️' : '🌙'); await espera(300)
      exigir(await p.evaluate(() => document.documentElement.dataset.tema) === tema.toLowerCase(), `tema ${tema} aplicado al instante`)
      const color = await p.$eval('meta[name="theme-color"]', (m) => m.content)
      exigir(color === (tema === 'Claro' ? '#1e3a8a' : '#0b1020'), `barra del navegador en tono ${tema.toLowerCase()} (${color})`)
      for (const v of ['Crear', 'Historial', 'Ajustes', 'Respuestas']) {
        await ir(v); await revisar(`${v} (${tema.toLowerCase()})`); await foto(`${tema.toLowerCase()}-${v.toLowerCase()}`)
      }
    }
    // oscuro elegido: aunque el teléfono esté en claro; y se mantiene al recargar sin destello
    await p.reload({ waitUntil: 'domcontentloaded' })
    exigir(await p.evaluate(() => document.documentElement.dataset.tema) === 'oscuro', 'el tema elegido se recuerda al recargar (antes de cargar la app)')
    await p.waitForSelector('nav button'); await espera(300)
    exigir(await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(11, 16, 32)', 'fondo oscuro aunque el teléfono esté en claro')
    exigir(await p.evaluate(() => [...document.querySelectorAll('nav button')].find((x) => x.classList.contains('activa')).textContent) === 'Respuestas', 'se recuerda la última pestaña abierta')
    // automático sigue al teléfono
    await ir('Ajustes'); await clic(p, '.segmentado label', '📱'); await espera(200)
    await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]); await espera(300)
    exigir(await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(11, 16, 32)' && await p.$eval('meta[name="theme-color"]', (m) => m.content) === '#0b1020', '«Automático» sigue al teléfono en oscuro')
    await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]); await espera(300)
    exigir(await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(244, 246, 251)', '«Automático» vuelve a claro con el teléfono')

    // letra grande
    await clic(p, '.segmentado label', 'AaGrande'); await espera(200)
    exigir(await p.evaluate(() => getComputedStyle(document.documentElement).fontSize) === '18.5px', 'letra grande')
    for (const v of ['Crear', 'Historial', 'Ajustes']) { await ir(v); exigir(await sinDesborde(), `letra grande sin desbordamiento en ${v}`) }
    await foto('letra-grande-crear')
    await ir('Ajustes'); await clic(p, '.segmentado label', 'AaNormal')

    // ---------- historial: duplicar, estado, buscar, eliminar con «Deshacer» ----------
    await ir('Historial')
    await clic(p, '.historial button', 'Duplicar'); await espera(400)
    exigir(await p.evaluate(() => [...document.querySelectorAll('nav button')].find((x) => x.classList.contains('activa')).textContent) === 'Crear', 'duplicar abre la copia en Crear')
    await clic(p, 'button', 'Guardar en el historial'); await espera(300)
    await ir('Historial')
    exigir((await p.$$('.historial li.tarjeta')).length >= 2, 'la copia queda como otra publicación')
    await p.select('.estado-select', 'vendido'); await espera(200)
    exigir(await p.$eval('.historial li', (x) => x.classList.contains('vendido')) && (await p.$eval('.resumen-estados', (x) => x.textContent)).includes('Vendido (1)'), 'marcar como vendida y contarla')
    await clic(p, '.resumen-estados .chip', '✅'); await espera(200)
    exigir((await p.$$('#t-publicaciones ~ .historial > li')).length === 1, 'filtrar por «Vendido»')
    await clic(p, '.resumen-estados .chip', 'Todas'); await p.type('input[type="search"]', 'corsa 2002'); await espera(200)
    exigir((await p.$$('#t-publicaciones ~ .historial > li')).length === 2, 'buscar por modelo y año')
    await p.click('input[type="search"]', { clickCount: 3 }); await p.keyboard.type('hilux'); await espera(200)
    exigir((await p.$$('#t-publicaciones ~ .historial > li')).length === 0 && !!(await p.$('.vacio')), 'búsqueda sin resultados avisa')
    await p.click('input[type="search"]', { clickCount: 3 }); await p.keyboard.press('Backspace'); await espera(200)
    // estado se conserva aunque la publicación se actualice en vivo
    const antes = await p.evaluate(() => JSON.parse(localStorage.getItem('ap.historial')).length)
    await p.click('.historial .icono'); await espera(250)
    exigir(await p.evaluate(() => JSON.parse(localStorage.getItem('ap.historial')).length) === antes - 1 && !!(await p.$('.aviso-flotante')), 'eliminar muestra «Deshacer»')
    await revisar('el aviso flotante (claro)')
    await clic(p, '.aviso-flotante button', 'Deshacer'); await espera(250)
    exigir(await p.evaluate(() => JSON.parse(localStorage.getItem('ap.historial')).length) === antes, '«Deshacer» la recupera')

    // ---------- copia de seguridad ----------
    await ir('Ajustes')
    await p.evaluate(() => { window.__c = ''; navigator.clipboard.writeText = async (t) => { window.__c = t } })
    await clic(p, 'button', '📋 Copiar respaldo'); await espera(200)
    const respaldo = await p.evaluate(() => window.__c)
    const r = JSON.parse(respaldo)
    exigir(r.app === 'AutoPublicador' && r.historial.length === antes && r.ajustes.claveGemini === '', 'el respaldo lleva todo menos la clave de Google')
    await p.evaluate(() => { localStorage.setItem('ap.historial', '[]'); localStorage.setItem('ap.placas', '[]') })
    await p.reload({ waitUntil: 'networkidle0' }); await p.evaluate(() => { navigator.clipboard.writeText = async (t) => { window.__c = t } })
    await ir('Ajustes')
    await p.$eval('textarea[aria-label="Respaldo pegado"]', (t, v) => { const s = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; s.call(t, v); t.dispatchEvent(new Event('input', { bubbles: true })) }, respaldo)
    await clic(p, 'button', 'Restaurar lo pegado'); await espera(300)
    exigir(await p.evaluate(() => JSON.parse(localStorage.getItem('ap.historial')).length) === antes && /Respaldo restaurado/.test(await p.$eval('#t-respaldo ~ [role=status]', (x) => x.textContent)), 'restaurar devuelve las publicaciones')
    await p.$eval('textarea[aria-label="Respaldo pegado"]', (t) => { const s = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; s.call(t, 'hola'); t.dispatchEvent(new Event('input', { bubbles: true })) })
    await clic(p, 'button', 'Restaurar lo pegado'); await espera(200)
    exigir(!!(await p.$('#t-respaldo ~ .aviso.error')), 'un texto que no es respaldo se rechaza')
    await ir('Historial')
    exigir((await p.$eval('.resumen-estados', (x) => x.textContent)).includes('Vendido (1)'), 'el estado «vendido» sobrevive al respaldo')

    // ---------- sin conexión e ir arriba ----------
    await p.setOfflineMode(true); await espera(300)
    exigir(!!(await p.$('.sin-conexion')), 'aviso «Sin conexión»')
    await p.setOfflineMode(false); await espera(300)
    exigir(!(await p.$('.sin-conexion')), 'el aviso se va al volver internet')
    await ir('Crear'); await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await espera(400)
    exigir(!!(await p.$('.ir-arriba')), 'botón «Ir arriba» al bajar')
    exigir(!errores.length, 'sin errores ' + errores.join('|'))
  } catch (err) { fallos.push(err.message); console.log(err) }
  await b.close(); app.cerrar?.()
  console.log(fallos.length ? 'INCORRECTO ' + fallos.join('; ') : 'CORRECTO'); process.exit(fallos.length ? 1 : 0)
})()
