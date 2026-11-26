import { useState } from 'react'
import { LIMITE_ETIQUETAS_FB, RECOMENDADAS } from '../dominio/marketplace'
import { copiar } from '../servicios/almacen'
import { Copiar } from './Copiar'

/** Etiquetas para el campo «Etiquetas» de Marketplace: se toca una, se pega en Facebook y se da Enter. */
export function EtiquetasFB({ lista }: { lista: string[] }) {
  const [copiada, setCopiada] = useState('')
  if (!lista.length) return null
  const tocar = async (e: string) => {
    if (await copiar(e)) { setCopiada(e); setTimeout(() => setCopiada((x) => (x === e ? '' : x)), 1600) }
  }
  return (
    <section className="etiquetas-fb" aria-label="Etiquetas para Marketplace">
      <h3>Etiquetas para Marketplace <small>({lista.length} de {LIMITE_ETIQUETAS_FB} posibles)</small></h3>
      <p className="ayuda">Toca una etiqueta para copiarla, pégala en «Etiquetas» de Facebook y da Enter. Las primeras {Math.min(RECOMENDADAS, lista.length)} son las más buscadas.</p>
      <div className="chips">
        {lista.map((e, i) => (
          <button key={e} type="button" className={`chip ${i < RECOMENDADAS ? 'activo' : ''} ${copiada === e ? 'copiado' : ''}`} onClick={() => tocar(e)}>
            {copiada === e ? '¡Copiada! ✓' : e}
          </button>
        ))}
      </div>
      <div className="fila">
        <Copiar texto={lista.slice(0, RECOMENDADAS).join(', ')} etiqueta={`Copiar las ${Math.min(RECOMENDADAS, lista.length)} recomendadas`} />
        <Copiar texto={lista.join(', ')} etiqueta="Copiar todas" />
      </div>
    </section>
  )
}
