import { useState } from 'react'
import type { Ajustes, Perfil } from '../dominio/tipos'
import { almacen } from '../servicios/almacen'
import { placasDeTexto, procesarLote, type ResultadoLote } from '../servicios/lote'

interface Props {
  perfil: Perfil
  ajustes: Ajustes
  alGuardar: () => void // refresca el historial
}

/** Pega varias placas → se consulta cada una (SRI + Wikipedia) y se guarda su publicación en el historial. */
export function VariasPlacas({ perfil, ajustes, alGuardar }: Props) {
  const [texto, setTexto] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [resultados, setResultados] = useState<ResultadoLote[]>([])
  const { validas, invalidas } = placasDeTexto(texto)

  async function procesar() {
    setTrabajando(true); setResultados([])
    await procesarLote(validas, perfil, ajustes, (_, r) => {
      if (r.ok && r.publicacion && r.placaConsultada) {
        almacen.guardarEnHistorial(r.publicacion)
        almacen.guardarPlaca(r.placaConsultada)
        alGuardar()
      } else if (!r.ok) {
        almacen.guardarPlacaSinRespuesta(r.placa, r.error ?? 'Sin respuesta')
        alGuardar()
      }
      setResultados((x) => [...x, r])
    })
    setTrabajando(false)
  }

  return (
    <section className="tarjeta">
      <h2>Varias placas</h2>
      <p className="ayuda">
        Pega una o varias placas (separadas por espacios, comas o saltos de línea). Para cada una se consultan el SRI y
        Wikipedia y su publicación queda guardada aquí abajo, lista para copiar.
      </p>
      <textarea className="entrada" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder="PBA1234, PCH7548&#10;JQ094F" aria-label="Placas" disabled={trabajando} />
      {invalidas.length > 0 && <p className="aviso">No parecen placas: {invalidas.join(', ')}</p>}
      <div className="fila">
        <button type="button" className="boton" disabled={!validas.length || trabajando} onClick={procesar}>
          {trabajando ? `Consultando ${resultados.length + 1} de ${validas.length}…` : `Consultar y guardar ${validas.length || ''} ${validas.length === 1 ? 'placa' : 'placas'}`}
        </button>
      </div>
      {resultados.length > 0 && (
        <ul className="lote">
          {resultados.map((r) => (
            <li key={r.placa}>
              <span className="chapa">{r.placa}</span>{' '}
              {r.ok ? `✅ ${r.publicacion?.titulo}` : `❌ ${r.error}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
