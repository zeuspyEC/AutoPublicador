// Retoques a mano que sobreviven a los cambios: se guarda el texto retocado y el texto generado sobre el que se retocó (base).
// Al cambiar un dato se aplica al retoque solo lo que cambió entre la base y el texto nuevo.
export interface Retoque { texto: string; base: string }
/** Plantillas elegidas y retoques de una publicación. Claves de los retoques: «t:id» (título) y «d:id» (descripción). */
export interface Seleccion { tituloId: string; descId: string; retoques: Record<string, Retoque> }
export const SELECCION_VACIA: Seleccion = { tituloId: '', descId: '', retoques: {} }

/** Parejas de posiciones iguales entre dos listas (subsecuencia común más larga). */
function parejas(a: string[], b: string[]): [number, number][] {
  const m = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) m[i][j] = a[i] === b[j] ? m[i + 1][j + 1] + 1 : Math.max(m[i + 1][j], m[i][j + 1])
  const r: [number, number][] = []
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] === b[j]) r.push([i++, j++])
    else if (m[i + 1][j] >= m[i][j + 1]) i++
    else j++
  }
  return r
}

// Se compara por palabras (cada salto de línea es una más): un retoque en una línea no impide actualizar el resto de ella
const partir = (t: string): string[] => t.match(/\n|[^\s]+/g) ?? []
const unir = (p: string[]) => p.reduce((t, x) => t + (x === '\n' || !t || t.endsWith('\n') ? '' : ' ') + x, '')

/** Aplica al retoque los cambios base → nuevo. Si un dato cambió donde se retocó, manda el dato nuevo. */
export function aplicarCambios(r: Retoque, nuevo: string): string {
  if (r.base === nuevo) return r.texto
  const base = partir(r.base), nue = partir(nuevo), ret = partir(r.texto)
  const enRet = new Map(parejas(base, ret)), iguales = [...parejas(base, nue), [base.length, nue.length] as [number, number]]
  const salida = [...ret]
  // Tramos distintos, del final al principio para no mover las posiciones pendientes
  const tramos: { b0: number; b1: number; add: string[] }[] = []
  let pb = 0, pn = 0
  for (const [b, n] of iguales) { if (b > pb || n > pn) tramos.push({ b0: pb, b1: b, add: nue.slice(pn, n) }); pb = b + 1; pn = n + 1 }
  for (const { b0, b1, add } of tramos.reverse()) {
    let antes = -1, despues = ret.length
    for (let k = b0 - 1; k >= 0; k--) if (enRet.has(k)) { antes = enRet.get(k)!; break }
    for (let k = b1; k < base.length; k++) if (enRet.has(k)) { despues = enRet.get(k)!; break }
    const quedan = []
    for (let k = b0; k < b1; k++) if (enRet.has(k)) quedan.push(enRet.get(k)!)
    if (quedan.length) salida.splice(quedan[0], quedan[quedan.length - 1] - quedan[0] + 1, ...add)
    else if (b0 === b1) salida.splice(antes + 1, 0, ...add) // solo se agrega
    else if (despues - antes > 1) salida.splice(antes + 1, despues - antes - 1, ...add) // se retocó justo ese dato
    // si el vendedor borró ese tramo, se respeta
  }
  return unir(salida).replace(/\n{3,}/g, '\n\n').trim()
}
