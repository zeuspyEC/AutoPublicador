// Analizador de texto libre: «peugeot 206 xt 2008 1.6 techo pantalla 4990 negociable matrícula 2025»
// → campos del vehículo. Todo lo que se detecta queda marcado con origen «texto».
import { ALIAS_MARCA, COLORES, EQUIPAMIENTO, MARCA_POR_MODELO, MODELOS, PROCEDENCIAS, VERSIONES } from './catalogo'
import { VEHICULO_VACIO, type Origenes, type Vehiculo } from './tipos'

export interface Analisis {
  vehiculo: Vehiculo
  origenes: Origenes
  faltantes: (keyof Vehiculo)[] // datos importantes que no se encontraron
  correcciones: string[] // p. ej., «alegro» se corrigió a «Allegro»
}

/** Distancia de edición (Levenshtein): cuántas letras hay que cambiar para pasar de una palabra a otra. */
export function distancia(a: string, b: string): number {
  const f = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = f[0]
    f[0] = i
    for (let j = 1; j <= b.length; j++) {
      const previo = f[j]
      f[j] = Math.min(f[j] + 1, f[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = previo
    }
  }
  return f[b.length]
}

/** Modelos que también son palabras comunes del español: solo se aceptan si la marca está escrita. */
const AMBIGUOS = new Set(['uno', 'premio', 'rio', 'city', 'fit', 'soul', 'ka', 'gol', 'song', 'racer', 'cielo', 'mobi', 'argo',
  'groove', 'pilot', 'edge', 'tang', 'yuan', 'dolphin', 'seagull', 'spark', 'swift', 'rush', 'ram', 'amigo', 'beat', 'sail',
  'forsa', 'duna', 'polo', 'fox', 'escape', 'explorer', 'ranger', 'journey', 'patrol', 'march', 'versa', 'kicks', 'focus', 'symbol'])

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** «4.990», «4,990», «4990» → «4990». */
function soloDigitos(s: string): string {
  return s.replace(/\D/g, '')
}

function anioDeDosDigitos(n: number): string {
  const actual = new Date().getFullYear() % 100
  return String(n <= actual + 1 ? 2000 + n : 1900 + n)
}

export function analizar(texto: string): Analisis {
  const v: Vehiculo = { ...VEHICULO_VACIO, equipamiento: [], etiquetas: [] }
  const o: Origenes = {}
  const correcciones: string[] = []
  const poner = <K extends keyof Vehiculo>(k: K, valor: Vehiculo[K]) => { v[k] = valor; o[k] = 'texto' }

  const original = (texto || '').replace(/\s+/g, ' ').trim()
  let t = original.toLowerCase()
  const plano = sinTildes(t)

  // --- Precio (antes que el año, para no confundir «$2000» con un año) ---
  const anterior = t.match(/(?:antes|precio anterior|rebajad[oa] de|de)\s*\$\s*([\d.,]{3,})/)
  if (anterior) { poner('precioAnterior', soloDigitos(anterior[1])); t = t.replace(anterior[0], ' ') }
  const precio = t.match(/\$\s*([\d.,]{3,})/) || t.match(/([\d.,]{3,})\s*(?:usd|d[oó]lares|dolares)\b/) ||
    t.match(/(?<![a-záéíóúüñ])(?:precio|vale|en|a)\s*:?\s*\$?\s*(\d{1,3}(?:[.,]\d{3})+|\d{3,6})\b(?!\s*(?:km|kms|cc|mil))/)
  if (precio && !/^(19|20)\d\d$/.test(soloDigitos(precio[1]))) { poner('precio', soloDigitos(precio[1])); t = t.replace(precio[0], ' ') }

  // --- Matrícula (su año no es el año del carro) ---
  const mat = t.match(/(?:matr[ií]cula(?:do)?|papeles|al d[ií]a)\s*(?:al d[ií]a)?\s*:?\s*(?:hasta\s*)?(20\d\d)/)
  if (mat) { poner('matricula', `Al día ${mat[1]}`); t = t.replace(mat[0], ' ') }
  else if (/(papeles|matr[ií]cula|documentos)\s*(en regla|al d[ií]a)|\bal d[ií]a\b/.test(t)) poner('matricula', 'Al día')
  if (/(cero|sin|0)\s*multas/.test(t)) poner('ceroMultas', true)

  // --- Kilometraje ---
  // Miles con punto o coma (no con espacio: «4x4 145.000 km» no debe leerse como 4 145 000)
  const km = t.match(/(?<![\w.,])(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(mil)?\s*(?:km|kms|kil[oó]metros)\b/)
  if (km) {
    let n = +soloDigitos(km[1])
    if (km[2]) n *= 1000
    poner('kilometraje', String(n)); t = t.replace(km[0], ' ')
  }

  // --- Motor ---
  const motor = t.match(/\b(\d)[.,](\d)\s*(?:l|lt|lts|litros?|cc|t|turbo)?\b/) || t.match(/\b(\d)(\d)\d\d\s*(?:cc|c\.c\.)/)
  const motoCc = !motor && t.match(/\b(\d{2,3})\s*(?:cc|c\.c\.)/) // motos: «150cc», «200 cc»
  if (motor) { poner('motor', `${motor[1]}.${motor[2]}`); t = t.replace(motor[0], ' ') }
  else if (motoCc) { poner('motor', `${motoCc[1]} cc`); t = t.replace(motoCc[0], ' ') }

  // --- Año: 4 dígitos, o «año 92», «del 98», «modelo 08» ---
  const anio4 = t.match(/\b(19[5-9]\d|20[0-3]\d)\b/)
  const anio2 = t.match(/\b(?:a[ñn]o|del|modelo|mod\.?)\s*'?(\d{2})\b/)
  if (anio4) poner('anio', anio4[1])
  else if (anio2) poner('anio', anioDeDosDigitos(+anio2[1]))

  // --- Precio sin símbolo («… cero multas 4990 negociable»): el número suelto que queda, desde 500 ---
  if (!v.precio) {
    const sueltos = [...t.matchAll(/(?<![\w.,/])(\d{1,3}(?:[.,]\d{3})+|\d{3,6})(?![\w.,/]|\s*(?:km|kms|cc|mil|hp|cv|p\b|puertas))/g)]
      .map((m) => soloDigitos(m[1]))
      .filter((n) => n !== v.anio && !/^(19[5-9]\d|20[0-3]\d)$/.test(n) && +n >= 500)
    if (sueltos.length) poner('precio', sueltos[0])
  }

  // --- Transmisión y combustible ---
  // «TM» / «TA»: abreviaturas del SRI y de muchos vendedores (transmisión manual / automática)
  if (/\b(autom[aá]tic[oa]|a\/t|tiptronic|cvt|caja autom)|\bta\b/.test(t)) poner('transmision', 'Automática')
  else if (/\b(manual|mec[aá]nic[oa]|t\/m|m\/t|est[aá]ndar|sincr[oó]nic)|\btm\b/.test(t) && !/mec[aá]nico de confianza|tu mec[aá]nico/.test(t)) poner('transmision', 'Manual')
  const comb = plano.match(/\b(gasolina|diesel|hibrido|electrico|glp|gnv)\b/)
  if (comb) poner('combustible', { gasolina: 'Gasolina', diesel: 'Diésel', hibrido: 'Híbrido', electrico: 'Eléctrico', glp: 'GLP', gnv: 'GNV' }[comb[1]]!)

  // --- Carrocería, tracción, puertas ---
  const traccion = t.match(/\b(4x4|4x2|awd|4wd|2wd)\b/)
  if (traccion) poner('traccion', traccion[1].toUpperCase())
  const puertas = t.match(/\b([2-5])\s*(?:p\b|ptas|puertas)/)
  if (puertas) poner('puertas', puertas[1])
  const carroceria = plano.match(/\b(sedan|hatchback|suv|camioneta|pick ?up|jeep|station wagon|furgoneta|van|coupe|convertible)\b/)
  if (carroceria) poner('carroceria', { sedan: 'Sedán', hatchback: 'Hatchback', suv: 'SUV', camioneta: 'Camioneta', pickup: 'Pickup',
    'pick up': 'Pickup', jeep: 'Jeep', 'station wagon': 'Station wagon', furgoneta: 'Furgoneta', van: 'Van', coupe: 'Coupé',
    convertible: 'Convertible' }[carroceria[1]] ?? '')

  // --- Color y procedencia ---
  const color = COLORES.find((c) => new RegExp(`\\b${c}\\b`).test(plano))
  if (color) poner('color', color === 'plata' ? 'Plateado' : color === 'cafe' ? 'Café' : color[0].toUpperCase() + color.slice(1))
  const proc = plano.match(/(?:procedencia|origen)\s*:?\s*([a-z]+)/)
  const procClave = Object.keys(PROCEDENCIAS).find((p) => (proc ? proc[1].startsWith(p) : new RegExp(`\\b${p}(o|a|os|as|e|es)?\\b`).test(plano)))
  if (procClave) poner('procedencia', PROCEDENCIAS[procClave])

  // --- Marca, modelo y versión ---
  let marca = ''
  for (const [alias, oficial] of Object.entries(ALIAS_MARCA).sort((a, b) => b[0].length - a[0].length))
    if (new RegExp(`\\b${escapar(alias)}\\b`).test(plano)) { marca = oficial; break }
  let modelo = ''
  const candidatos = marca ? [[marca, MODELOS[marca] ?? []] as const] : Object.entries(MODELOS)
  const encontrados: string[] = []
  for (const [, lista] of candidatos)
    for (const mod of lista) {
      // Sin marca escrita, los modelos que son palabras comunes («uno», «premio», «río»…) no cuentan
      if (!marca && AMBIGUOS.has(sinTildes(mod.toLowerCase()))) continue
      const re = new RegExp(`(^|[^a-z0-9])${escapar(sinTildes(mod.toLowerCase()))}([^a-z0-9]|$)`)
      if (re.test(plano)) encontrados.push(mod)
    }
  // Un modelo numérico igual al año (Peugeot «2008») cede ante otro modelo encontrado («206 … 2008»)
  const utiles = encontrados.length > 1 ? encontrados.filter((m) => m !== v.anio) : encontrados
  for (const mod of utiles) if (mod.length > modelo.length) modelo = mod
  if (modelo && modelo === v.anio) { v.anio = ''; delete o.anio } // «Peugeot 2008» sin otro año: es el modelo
  if (!marca && modelo) marca = MARCA_POR_MODELO[sinTildes(modelo.toLowerCase())] ??
    Object.entries(MODELOS).find(([, l]) => l.includes(modelo))?.[0] ?? ''
  if (marca && !modelo) {
    // Modelo no catalogado: la palabra que sigue a la marca
    const sig = plano.match(new RegExp(`\\b${escapar(sinTildes(marca.toLowerCase()))}\\s+([a-z0-9-]+)`))
    if (sig && !/^(19|20)\d\d$/.test(sig[1]) && !/^\d[.,]\d$/.test(sig[1])) {
      // ¿Error de tipeo de un modelo conocido de la marca? («alegro» → «Allegro»)
      const escrito = sig[1]
      const tolerancia = escrito.length >= 6 ? 2 : 1
      const parecido = (MODELOS[marca] ?? []).filter((m) => !/\s/.test(m))
        .map((m) => ({ m, d: distancia(escrito, sinTildes(m.toLowerCase())) }))
        // Los códigos con números («N200», «F-370») son nombres exactos: nunca se «corrigen» a otro modelo
        .filter((x) => escrito.length >= 4 && !/\d/.test(escrito) && x.d > 0 && x.d <= tolerancia)
        .sort((a, b) => a.d - b.d)[0]
      if (parecido) { modelo = parecido.m; correcciones.push(`«${escrito}» se corrigió a «${parecido.m}»`) }
      else modelo = escrito.length <= 3 || /\d/.test(escrito) ? escrito.toUpperCase() : escrito[0].toUpperCase() + escrito.slice(1)
    }
  }
  if (marca) poner('marca', marca)
  if (modelo) poner('modelo', modelo === 'Río' ? 'Rio' : modelo === 'Rav 4' ? 'RAV4' : modelo)

  const versiones = VERSIONES.filter((ver) => new RegExp(`(^|[^a-z0-9])${escapar(sinTildes(ver.toLowerCase()))}([^a-z0-9]|$)`).test(plano))
    .filter((ver) => !sinTildes(modelo.toLowerCase()).split(' ').includes(sinTildes(ver.toLowerCase())))
    .filter((ver) => ver !== 'Full' || !/full equip/.test(plano))
  // «Sedán»/«Hatchback» son carrocería (ya se tomó arriba), no versión; y sin repetir variantes con o sin tilde
  const ver = [...new Set(versiones.filter((x) => !/^(sedan|sedán|hatchback)$/i.test(x))
    .map((x) => (x === 'Clasico' ? 'Clásico' : x)))]
  if (ver.length) poner('version', ver.join(' '))

  // --- Equipamiento y estado ---
  for (const [re, nombre] of EQUIPAMIENTO) if (re.test(t) && !v.equipamiento.includes(nombre)) v.equipamiento.push(nombre)
  if (v.equipamiento.length) o.equipamiento = 'texto'
  if (/full equip|full extras|\bfull\b/.test(plano)) poner('fullEquipo', true)
  if (/toda prueba|a toda prueba/.test(plano)) poner('aTodaPrueba', true)
  if (/precio fijo|no (?:es )?negociable|sin rebaja/.test(plano)) poner('negociable', false)
  else if (/negociable|conversable|escucho ofertas/.test(plano)) poner('negociable', true)
  if (/(?:no|sin) (?:recib\w+ |acept\w+ |hago )?cambios?\b|no recib[oe] (?:carro|auto|moto)/.test(plano)) poner('recibeCambio', false)
  else if (/\bcambio\b|cambi[oa]|parte de pago|recibo (?:carro|auto|moto)/.test(plano)) poner('recibeCambio', true)

  const notas: string[] = []
  if (/unico dueno|un solo dueno/.test(plano)) notas.push('Único dueño')
  if (/excelente estado|impecable|como nuevo/.test(plano)) notas.push('Excelente estado')
  if (/buen estado/.test(plano) && !/excelente estado/.test(plano)) notas.push('Buen estado')
  if (/motor (?:reparado|overhaul|a cero)/.test(plano)) notas.push('Motor reparado')
  if (/mantenimientos?\s+al d[ií]a|mantenimiento en concesionario/.test(plano)) notas.push('Mantenimientos al día')
  if (notas.length) poner('notas', notas.join(', '))

  const importantes: (keyof Vehiculo)[] = ['marca', 'modelo', 'anio', 'motor', 'transmision', 'precio']
  return { vehiculo: v, origenes: o, faltantes: importantes.filter((k) => !v[k]), correcciones }
}
