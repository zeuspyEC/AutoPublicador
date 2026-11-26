// Apariencia: tema (el del teléfono, claro u oscuro) y tamaño de letra. index.html aplica lo guardado antes de que cargue
// la app (sin parpadeo); aquí se aplica cada cambio al instante.
import type { Ajustes, Tema } from '../dominio/tipos'

const COLOR_BARRA = { claro: '#1e3a8a', oscuro: '#0b1020' }

/** Tema que se ve de verdad: «sistema» sigue al teléfono. */
export function temaEfectivo(tema: Tema): 'claro' | 'oscuro' {
  if (tema !== 'sistema') return tema
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'
}

export function aplicarApariencia(a: Pick<Ajustes, 'tema' | 'letra'>) {
  const raiz = document.documentElement
  if (a.tema === 'sistema') delete raiz.dataset.tema; else raiz.dataset.tema = a.tema
  if (a.letra === 'grande') raiz.dataset.letra = 'grande'; else delete raiz.dataset.letra
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', COLOR_BARRA[temaEfectivo(a.tema)])
}

/** Con «sistema», si el teléfono cambia de modo (p. ej., de noche) la barra del navegador también cambia. */
export function seguirAlSistema(alCambiar: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => {}
  const m = matchMedia('(prefers-color-scheme: dark)')
  m.addEventListener('change', alCambiar)
  return () => m.removeEventListener('change', alCambiar)
}
