import { useEffect, useState } from 'react'
import { LIMITE_TITULO, type Variante } from '../dominio/plantillas'
import { tieneNumeroLimpio } from '../dominio/telefono'
import type { Vehiculo } from '../dominio/tipos'
import { Copiar } from './Copiar'

interface Props {
  v: Vehiculo
  titulos: Variante[]
  descripciones: Variante[]
  alGuardar: (titulo: string, descripcion: string) => void
}

const miles = (d: string) => (+d).toLocaleString('es-EC').replace(/,/g, '.')

/** Variantes listas para copiar: el vendedor elige un título y una descripción (y puede retocarlos). */
export function Resultados({ v, titulos, descripciones, alGuardar }: Props) {
  const [tituloId, setTitulo] = useState('')
  const [descId, setDesc] = useState('')
  const [editados, setEditados] = useState<Record<string, string>>({})
  const [guardado, setGuardado] = useState(false)

  // Si cambian los datos, se descartan los retoques manuales (el texto se regeneró)
  useEffect(() => { setEditados({}); setGuardado(false) }, [titulos, descripciones])

  // Se elige por id (no por posición): al marcar o quitar etiquetas la lista cambia y la elección se conserva
  const t = titulos.find((x) => x.id === tituloId) ?? titulos[0]
  const d = descripciones.find((x) => x.id === descId) ?? descripciones[0]
  const textoDe = (tipo: 't' | 'd', x?: Variante) => (x ? editados[tipo + x.id] ?? x.texto : '')

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
            <li key={x.id} className={x === t ? 'elegido' : ''} onClick={() => setTitulo(x.id)}>
              <textarea className="texto-titulo" rows={Math.max(2, Math.ceil(largo / 28))} value={texto} onChange={(e) => setEditados({ ...editados, ['t' + x.id]: e.target.value })} />
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
          <button key={x.id} type="button" role="tab" aria-selected={x === d} className={`pestana ${x === d ? 'activa' : ''}`} onClick={() => setDesc(x.id)}>
            {x.nombre}
          </button>
        ))}
      </div>
      {d && (
        <div className="descripcion">
          <textarea value={textoDe('d', d)} rows={18} onChange={(e) => setEditados({ ...editados, ['d' + d.id]: e.target.value })} />
          {tieneNumeroLimpio(textoDe('d', d)) && <p className="aviso">⚠️ Hay un número escrito seguido: Facebook podría ocultarlo. Sepáralo con guiones o puntos.</p>}
          <div className="fila">
            <Copiar texto={textoDe('d', d)} etiqueta="Copiar descripción" principal />
            <button type="button" className="boton secundario" onClick={() => { alGuardar(textoDe('t', t), textoDe('d', d)); setGuardado(true) }}>
              {guardado ? '✓ Guardada en el historial' : 'Guardar en el historial'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
