// Lectura de fichas (infobox) de Wikipedia a partir del wikitexto. Funciones puras: se prueban sin internet.

/** Extrae los campos de la primera ficha cuyo nombre empiece con alguno de «nombres». */
export function camposFicha(wikitexto: string, nombres: string[]): Record<string, string> {
  const inicio = nombres.map((n) => wikitexto.search(new RegExp(`\\{\\{\\s*${n}`, 'i'))).filter((i) => i >= 0).sort((a, b) => a - b)[0]
  if (inicio === undefined) return {}
  // Recorre respetando el anidamiento de {{ }} y [[ ]] para cortar solo en los «|» de primer nivel
  let i = inicio + 2, llaves = 0, corchetes = 0, actual = ''
  const partes: string[] = []
  for (; i < wikitexto.length; i++) {
    const dos = wikitexto.slice(i, i + 2)
    if (dos === '{{') { llaves++; actual += dos; i++; continue }
    if (dos === '}}') {
      if (llaves === 0) { partes.push(actual); break }
      llaves--; actual += dos; i++; continue
    }
    if (dos === '[[') { corchetes++; actual += dos; i++; continue }
    if (dos === ']]') { corchetes--; actual += dos; i++; continue }
    const c = wikitexto[i]
    if (c === '|' && llaves === 0 && corchetes === 0) { partes.push(actual); actual = ''; continue }
    actual += c
  }
  const campos: Record<string, string> = {}
  for (const p of partes.slice(1)) {
    const k = p.indexOf('=')
    if (k < 0) continue
    const clave = p.slice(0, k).trim().toLowerCase()
    const valor = limpiarWiki(p.slice(k + 1))
    if (clave && valor) campos[clave] = valor
  }
  return campos
}

/** Convierte wikitexto en texto legible: listas a «; », conversiones de unidades a «3835 mm», enlaces a su texto. */
export function limpiarWiki(s: string): string {
  let t = s
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/&nbsp;|&#160;| /g, ' ') // «1.6&nbsp;L» es común en las fichas de motores
    .replace(/&ndash;/g, '–').replace(/&amp;/g, '&')
    .replace(/<br\s*\/?>/gi, '; ')
    .replace(/<[^>]+>/g, '')
    .replace(/'{2,}/g, '')
    // Enlaces antes que plantillas: su «|» interno no debe partir los argumentos de {{ubl|…}}
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1') // [[destino|texto]] → texto
  // Plantillas, de adentro hacia afuera
  for (let n = 0; n < 8 && /\{\{/.test(t); n++) {
    t = t.replace(/\{\{([^{}]*)\}\}/g, (_, cuerpo: string) => {
      const [nombre, ...args] = cuerpo.split('|').map((x) => x.trim())
      const nom = nombre.toLowerCase()
      if (/^(ubl|unbulleted list|plainlist|flatlist|hlist|lista)$/.test(nom)) return args.filter((a) => !a.includes('=')).join('; ')
      if (/^(convert|cvt|convertir)$/.test(nom)) {
        const pos = args.filter((a) => !a.includes('='))
        return pos[1] === '-' || pos[1] === 'to' || pos[1] === 'a' ? `${pos[0]}–${pos[2]} ${pos[3] ?? ''}`.trim() : `${pos[0]} ${pos[1] ?? ''}`.trim()
      }
      if (/^unidad$/.test(nom)) return args.slice(0, 2).join(' ')
      return '' // banderas, «cita requerida», etc.
    })
  }
  t = t
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1') // [[destino|texto]] → texto
    .replace(/\[https?:\/\/\S+\s([^\]]+)\]/g, '$1')
    .replace(/\s*;\s*(;\s*)+/g, '; ')
    .replace(/\s+/g, ' ')
    .replace(/^[;\s]+|[;\s]+$/g, '')
  return t.trim()
}

/** Cilindradas mencionadas («1.4 L», «1,6 l», «1600 cc») → ["1.4", "1.6"], sin repetir y ordenadas. */
export function cilindradas(texto: string): string[] {
  const set = new Set<string>()
  for (const m of texto.matchAll(/\b(\d)[.,](\d)\s*(?:l\b|litros?|lt\b|-litre|-liter)/gi)) set.add(`${m[1]}.${m[2]}`)
  for (const m of texto.matchAll(/\b(\d)(\d)\d\d\s*(?:cc|cm3|cm³)/gi)) set.add(`${m[1]}.${m[2]}`)
  return [...set].sort()
}

/** Rangos de años de producción: «1998-2012 (Francia); 1999-2016 (Argentina)», «1988-presente». */
export function rangosAnios(texto: string): [number, number][] {
  const actual = new Date().getFullYear()
  return [...texto.matchAll(/\b(19\d\d|20\d\d)\s*[-–]\s*(19\d\d|20\d\d|presente|present|actualidad|actual)/gi)]
    .map((m) => [+m[1], /^\d/.test(m[2]) ? +m[2] : actual] as [number, number])
}

/** Tracción a partir de la configuración («tracción delantera», «front-wheel-drive», «four-wheel drive»). */
export function traccionDe(texto: string): string {
  const t = texto.toLowerCase()
  const opciones: string[] = []
  if (/delantera|front-wheel/.test(t)) opciones.push('Delantera')
  if (/trasera|rear-wheel/.test(t)) opciones.push('Trasera')
  if (/total|4x4|four-wheel|all-wheel|cuatro ruedas|integral/.test(t)) opciones.push('4x4')
  return opciones.join(' o ')
}
