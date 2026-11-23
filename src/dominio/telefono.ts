// Teléfono «a prueba de Facebook»: Marketplace oculta los números escritos seguidos (los cambia por asteriscos),
// así que nunca se publica limpio; se separa con guiones, puntos, diagonales o emojis.
import type { EstiloTelefono } from './tipos'

/** Deja solo los dígitos y convierte +593 9… / 593 9… al formato nacional 09…. */
export function normalizarTelefono(entrada: string): string {
  let d = (entrada || '').replace(/\D/g, '')
  if (d.startsWith('593')) d = '0' + d.slice(3)
  if (d.length === 9 && d.startsWith('9')) d = '0' + d
  return d
}

/** Celular ecuatoriano: 10 dígitos que empiezan con 09. */
export function telefonoValido(entrada: string): boolean {
  return /^09\d{8}$/.test(normalizarTelefono(entrada))
}

const EMOJI_DIGITO = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']

export const ESTILOS_TELEFONO: { id: EstiloTelefono; nombre: string }[] = [
  { id: 'guiones', nombre: 'Guiones dobles' },
  { id: 'puntos', nombre: 'Puntos' },
  { id: 'diagonales', nombre: 'Diagonales' },
  { id: 'mixto', nombre: 'Mixto' },
  { id: 'emoji', nombre: 'Emojis' },
]

/** Escribe el número con el estilo elegido. Ejemplo con 0987654321. */
export function formatearTelefono(entrada: string, estilo: EstiloTelefono): string {
  const d = normalizarTelefono(entrada)
  if (!d) return ''
  const [a, b, c] = [d.slice(0, 4), d.slice(4, 7), d.slice(7)]
  switch (estilo) {
    case 'guiones': return `${a}--${b}--${c}` // 0987--654--321
    case 'puntos': return `${a}.${b}.${c}` // 0987.654.321
    case 'diagonales': return d.match(/.{1,2}/g)!.join('/') // 09/87/65/43/21
    case 'mixto': return `${d.slice(0, 2)}-${d.slice(2, 4)}.${d.slice(4, 7)}/${d.slice(7)}` // 09-87.654/321
    case 'emoji': return [...d].map((n) => EMOJI_DIGITO[+n]).join('') // 0️⃣9️⃣…
  }
}

/** Comprobación de seguridad: ¿quedó algún número de 7 o más dígitos seguidos (que Facebook ocultaría)? */
export function tieneNumeroLimpio(texto: string): boolean {
  return /\d{7,}/.test(texto)
}
