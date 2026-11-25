import type { Variante } from '../dominio/plantillas'
import { Copiar } from './Copiar'

/** Comentarios y respuestas del vehículo actual, en su propia sección: siempre según los datos y etiquetas vigentes. */
export function Respuestas({ vehiculo, lista, irACrear }: { vehiculo: string; lista: Variante[]; irACrear: () => void }) {
  return (
    <section className="tarjeta">
      <h2>Comentarios y respuestas</h2>
      {!lista.length
        ? <p className="vacio">Primero genera una publicación. <button type="button" className="enlace" onClick={irACrear}>Ir a Crear</button></p>
        : <p className="ayuda">Para responder o subir la publicación{vehiculo && <> de <strong>{vehiculo}</strong></>}.</p>}
      <ul className="comentarios">
        {lista.map((c) => (
          <li key={c.id}>
            <small>{c.nombre}</small>
            <p>{c.texto}</p>
            <Copiar texto={c.texto} />
          </li>
        ))}
      </ul>
    </section>
  )
}
