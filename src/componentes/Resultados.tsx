import { useEffect, useState } from 'react'
import { LIMITE_TITULO, type Variante } from '../dominio/plantillas'
import { tieneNumeroLimpio } from '../dominio/telefono'
import type { Vehiculo } from '../dominio/tipos'
import { Copiar } from './Copiar'

interface Props {
  v: Vehiculo
  titulos: Variante[]
  descripciones: Variante[]
  comentarios: Variante[]
  alGuardar: (titulo: string, descripcion: string) => void
}

const miles = (d: string) => (+d).toLocaleString('es-EC').replace(/,/g, '.')

/** Variantes listas para copiar: el vendedor elige un título y una descripción (y puede retocarlos). */
export function Resultados({ v, titulos, descripciones, comentarios, alGuardar }: Props) {
  const [titulo, setTitulo] = useState(0)
  const [desc, setDesc] = useState(0)
  const [editados, setEditados] = useState<Record<string, string>>({})
  const [guardado, setGuardado] = useState(false)

  // Si cambian los datos, se descartan los retoques manuales (el texto se regeneró)
  useEffect(() => { setEditados({}); setGuardado(false) }, [titulos, descripciones])

  const textoTitulo = (i: number) => editados[`t${i}`] ?? titulos[i]?.texto ?? ''
  const textoDesc = (i: number) => editados[`d${i}`] ?? descripciones[i]?.texto ?? ''
  const d = descripciones[desc]

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
        {titulos.map((t, i) => {
          const texto = textoTitulo(i)
          const largo = [...texto].length
          return (
            <li key={t.id} className={i === titulo ? 'elegido' : ''} onClick={() => setTitulo(i)}>
              <textarea className="texto-titulo" rows={Math.max(2, Math.ceil(largo / 28))} value={texto} onChange={(e) => setEditados({ ...editados, [`t${i}`]: e.target.value })} />
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
        {descripciones.map((x, i) => (
          <button key={x.id} type="button" role="tab" aria-selected={i === desc} className={`pestana ${i === desc ? 'activa' : ''}`} onClick={() => setDesc(i)}>
            {x.nombre}
          </button>
        ))}
      </div>
      {d && (
        <div className="descripcion">
          <textarea value={textoDesc(desc)} rows={18} onChange={(e) => setEditados({ ...editados, [`d${desc}`]: e.target.value })} />
          {tieneNumeroLimpio(textoDesc(desc)) && <p className="aviso">⚠️ Hay un número escrito seguido: Facebook podría ocultarlo. Sepáralo con guiones o puntos.</p>}
          <div className="fila">
            <Copiar texto={textoDesc(desc)} etiqueta="Copiar descripción" principal />
          </div>
        </div>
      )}

      <h3>Comentarios y respuestas <small>(para responder o subir la publicación)</small></h3>
      <ul className="comentarios">
        {comentarios.map((c) => (
          <li key={c.id}>
            <small>{c.nombre}</small>
            <p>{c.texto}</p>
            <Copiar texto={c.texto} />
          </li>
        ))}
      </ul>

      <div className="guardar">
        <button type="button" className="boton secundario" onClick={() => { alGuardar(textoTitulo(titulo), textoDesc(desc)); setGuardado(true) }}>
          {guardado ? '✓ Guardada en el historial' : 'Guardar en el historial'}
        </button>
        <small className="ayuda">Se guarda el título marcado (toca uno para elegirlo) y la descripción abierta.</small>
      </div>
    </div>
  )
}
