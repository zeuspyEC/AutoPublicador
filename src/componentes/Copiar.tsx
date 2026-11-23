import { useState } from 'react'
import { copiar } from '../servicios/almacen'

/** Botón «Copiar» que confirma con «¡Copiado!» durante un momento. */
export function Copiar({ texto, etiqueta = 'Copiar', principal = false }: { texto: string; etiqueta?: string; principal?: boolean }) {
  const [estado, setEstado] = useState<'' | 'ok' | 'error'>('')
  return (
    <button
      type="button"
      className={`boton ${principal ? 'principal' : 'secundario'} ${estado === 'ok' ? 'copiado' : ''}`}
      onClick={async () => {
        const ok = await copiar(texto)
        setEstado(ok ? 'ok' : 'error')
        setTimeout(() => setEstado(''), 1600)
      }}
    >
      {estado === 'ok' ? '¡Copiado! ✓' : estado === 'error' ? 'No se pudo copiar' : etiqueta}
    </button>
  )
}
