import type { Publicacion } from '../servicios/almacen'
import { Copiar } from './Copiar'

export function Historial({ lista, abrir, borrar }: { lista: Publicacion[]; abrir: (p: Publicacion) => void; borrar: (id: string) => void }) {
  if (!lista.length) return <p className="vacio">Todavía no has guardado publicaciones. Genera una y pulsa «Guardar en el historial».</p>
  return (
    <ul className="historial">
      {lista.map((p) => (
        <li key={p.id} className="tarjeta">
          <div className="cabecera-historial">
            <strong>{p.titulo}</strong>
            <small>{new Date(p.fecha).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}</small>
          </div>
          <div className="fila">
            <Copiar texto={p.titulo} etiqueta="Copiar título" />
            <Copiar texto={p.descripcion} etiqueta="Copiar descripción" />
            <button type="button" className="boton secundario" onClick={() => abrir(p)}>Abrir y editar</button>
            <button type="button" className="icono" title="Eliminar" onClick={() => { if (confirm('¿Eliminar esta publicación del historial?')) borrar(p.id) }}>🗑</button>
          </div>
        </li>
      ))}
    </ul>
  )
}
