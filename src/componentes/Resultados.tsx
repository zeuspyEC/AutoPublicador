import { LIMITE_TITULO, textoVigente, type Variante } from '../dominio/plantillas'
import { tieneNumeroLimpio } from '../dominio/telefono'
import type { Seleccion } from '../dominio/retoques'
import type { Vehiculo } from '../dominio/tipos'
import { Copiar } from './Copiar'
import { EtiquetasFB } from './EtiquetasFB'

interface Props {
  v: Vehiculo
  titulos: Variante[]
  descripciones: Variante[]
  seleccion: Seleccion
  cambiar: (s: Seleccion) => void
  guardada: boolean
  alGuardar: () => void
  etiquetas: string[]
}

const miles = (d: string) => (+d).toLocaleString('es-EC').replace(/,/g, '.')

/** Variantes listas para copiar: el vendedor elige un título y una descripción (y puede retocarlos). */
export function Resultados({ v, titulos, descripciones, seleccion, cambiar, guardada, alGuardar, etiquetas }: Props) {
  // Se elige por id (no por posición): al marcar o quitar etiquetas la lista cambia y la elección se conserva
  const t = titulos.find((x) => x.id === seleccion.tituloId) ?? titulos[0]
  const d = descripciones.find((x) => x.id === seleccion.descId) ?? descripciones[0]
  const textoDe = (tipo: 't' | 'd', x?: Variante) => textoVigente(v, tipo, x, seleccion)
  /** Título y descripción juntos: para enviarlos a otro vendedor o guardarlos en un chat. */
  const completo = [textoDe('t', t), d ? textoDe('d', d) : ''].filter(Boolean).join('\n\n')
  const retocar =(clave: string, texto: string, base: string) => {
    const { [clave]: _, ...resto } = seleccion.retoques
    cambiar({ ...seleccion, retoques: texto === base ? resto : { ...resto, [clave]: { texto, base } } })
  }

  return (
    <div className="resultados">
      {v.precio && (
        <div className="precio">
          <span>Precio para Marketplace</span>
          <strong>${miles(v.precio)}</strong>
          <Copiar texto={v.precio} etiqueta="Copiar precio" />
        </div>
      )}

      <h3>Títulos <small>({titulos.length} variantes)</small></h3>
      <ol className="lista-titulos">
        {titulos.map((x) => {
          const texto = textoDe('t', x)
          const largo = [...texto].length
          return (
            <li key={x.id} className={x === t ? 'elegido' : ''} onClick={() => cambiar({ ...seleccion, tituloId: x.id })}>
              <textarea className="texto-titulo" rows={Math.max(2, Math.ceil(largo / 28))} value={texto} onChange={(e) => retocar('t:' + x.id, e.target.value, x.texto)} />
              <div className="fila">
                <span className={`largo ${largo > LIMITE_TITULO ? 'excede' : ''}`}>{largo}/{LIMITE_TITULO}</span>
                <Copiar texto={texto} />
              </div>
            </li>
          )
        })}
      </ol>

      <h3>Descripciones <small>({descripciones.length} plantillas)</small></h3>
      <div className="pestanas" role="tablist">
        {descripciones.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={x === d} className={`pestana ${x === d ? 'activa' : ''}`} onClick={() => cambiar({ ...seleccion, descId: x.id })}>
            {x.nombre}
          </button>
        ))}
      </div>
      {d && (
        <div className="descripcion">
          <textarea value={textoDe('d', d)} rows={18} aria-label={`Descripción ${d.nombre}`} onChange={(e) => retocar('d:' + d.id, e.target.value, d.texto)} />
          <span className="contador">{[...textoDe('d', d)].length} caracteres · {textoDe('d', d).split('\n').length} líneas</span>
          {tieneNumeroLimpio(textoDe('d', d)) && <p className="aviso">⚠️ Hay un número escrito seguido: Facebook podría ocultarlo. Sepáralo con guiones o puntos.</p>}
          <div className="fila">
            <Copiar texto={textoDe('d', d)} etiqueta="Copiar descripción" principal />
            <Copiar texto={completo} etiqueta="Copiar título + descripción" />
            <a className="boton secundario" href={`https://wa.me/?text=${encodeURIComponent(completo)}`} target="_blank" rel="noreferrer">Enviar por WhatsApp</a>
            <button type="button" className="boton secundario" disabled={guardada} onClick={alGuardar}>
              {guardada ? '✓ En el historial (se actualiza sola)' : 'Guardar en el historial'}
            </button>
            {seleccion.retoques['d:' + d.id] && <button type="button" className="enlace" onClick={() => retocar('d:' + d.id, '', '')}>Deshacer mis retoques</button>}
          </div>
        </div>
      )}

      <EtiquetasFB lista={etiquetas} />
    </div>
  )
}
