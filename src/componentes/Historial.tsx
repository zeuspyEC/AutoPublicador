import { useMemo } from 'react'
import { publicacionVigente } from '../dominio/plantillas'
import { migrar } from '../dominio/etiquetas'
import { etiquetasMarketplace } from '../dominio/marketplace'
import { VEHICULO_VACIO } from '../dominio/tipos'
import type { PlacaConsultada, Publicacion } from '../servicios/almacen'
import { Copiar } from './Copiar'
import { VariasPlacas } from './VariasPlacas'
import type { Ajustes, Perfil } from '../dominio/tipos'

interface Props {
  lista: Publicacion[]
  placas: PlacaConsultada[]
  abrir: (p: Publicacion) => void
  borrar: (id: string) => void
  usarPlaca: (p: PlacaConsultada) => void
  borrarPlaca: (placa: string) => void
  perfil: Perfil | null
  ajustes: Ajustes
  refrescar: () => void
}

const fecha = (iso: string) => new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })

export function Historial({ lista, placas, abrir, borrar, usarPlaca, borrarPlaca, perfil, ajustes, refrescar }: Props) {
  // El texto de cada publicación se arma con su vehículo y el perfil y ajustes de ahora: nunca queda desactualizado
  const vigentes = useMemo(() => lista.map((p) => {
    const v = migrar(p.vehiculo, VEHICULO_VACIO, (c) => p.origenes?.[c] === 'manual')
    return { ...p, etiquetas: etiquetasMarketplace(v, ajustes.ubicacion), ...(p.seleccion && perfil ? publicacionVigente({ v, perfil, beneficios: ajustes.beneficios, ubicacion: ajustes.ubicacion }, p.seleccion) : {}) }
  }), [lista, perfil, ajustes])

  return (
    <div className="ajustes">
      {perfil && <VariasPlacas perfil={perfil} ajustes={ajustes} alGuardar={refrescar} />}
      <section className="tarjeta">
        <h2>Publicaciones guardadas</h2>
        {!lista.length && <p className="vacio">Todavía no has guardado publicaciones. Genera una y pulsa «Guardar en el historial».</p>}
        <ul className="historial">
          {vigentes.map((p) => (
            <li key={p.id} className="tarjeta">
              <div className="cabecera-historial">
                <strong>{p.placa && <><span className="chapa">{p.placa}</span> </>}{p.titulo}</strong>
                <small>{fecha(p.fecha)}</small>
              </div>
              {!p.seleccion && <p className="ayuda">Guardada con una versión anterior: ábrela y cambia algo para que se mantenga al día.</p>}
              <div className="fila">
                <Copiar texto={p.titulo} etiqueta="Copiar título" />
                <Copiar texto={p.descripcion} etiqueta="Copiar descripción" />
                {p.etiquetas.length > 0 && <Copiar texto={p.etiquetas.join(', ')} etiqueta="Copiar etiquetas" />}
                <button type="button" className="boton secundario" onClick={() => abrir(lista.find((x) => x.id === p.id)!)}>Abrir y editar</button>
                <button type="button" className="icono" title="Eliminar" onClick={() => { if (confirm('¿Eliminar esta publicación del historial?')) borrar(p.id) }}>🗑</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="tarjeta">
        <h2>Placas consultadas</h2>
        <p className="ayuda">Cada placa consultada en el SRI queda aquí con sus datos, para usarla otra vez sin volver a consultar.</p>
        {!placas.length && <p className="vacio">Aún no has consultado placas.</p>}
        <ul className="historial">
          {placas.map((p) => (
            <li key={p.placa} className="tarjeta">
              <div className="cabecera-historial">
                <strong><span className="chapa">{p.placa}</span> {p.resumen || <em className="vacio">Sin datos</em>}</strong>
                <small>{fecha(p.fecha)}</small>
              </div>
              {p.sinRespuesta && <p className="aviso">Sin respuesta: {p.sinRespuesta}</p>}
              {p.resultado.avisos.map((a) => <p key={a} className="aviso">{a}</p>)}
              <div className="fila">
                <button type="button" className="boton secundario" onClick={() => usarPlaca(p)}>{p.sinRespuesta ? 'Corregir o volver a consultar' : 'Crear publicación con esta placa'}</button>
                <button type="button" className="icono" title="Eliminar" onClick={() => { if (confirm(`¿Eliminar la placa ${p.placa} del historial?`)) borrarPlaca(p.placa) }}>🗑</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
