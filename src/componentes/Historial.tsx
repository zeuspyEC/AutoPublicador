import { useMemo, useState } from 'react'
import { publicacionVigente } from '../dominio/plantillas'
import { migrar } from '../dominio/etiquetas'
import { buscarEnHistorial, contarEstados, diasDesde, estadoDe, ESTADOS, haceCuanto } from '../dominio/historial'
import { etiquetasMarketplace } from '../dominio/marketplace'
import { VEHICULO_VACIO } from '../dominio/tipos'
import type { EstadoVenta, PlacaConsultada, Publicacion } from '../servicios/almacen'
import { Copiar } from './Copiar'
import { VariasPlacas } from './VariasPlacas'
import type { Ajustes, Perfil } from '../dominio/tipos'

interface Props {
  lista: Publicacion[]
  placas: PlacaConsultada[]
  abrir: (p: Publicacion) => void
  duplicar: (p: Publicacion) => void
  borrar: (id: string) => void
  cambiarEstado: (id: string, estado: EstadoVenta) => void
  usarPlaca: (p: PlacaConsultada) => void
  borrarPlaca: (placa: string) => void
  perfil: Perfil | null
  ajustes: Ajustes
  refrescar: () => void
}

const fecha = (iso: string) => new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })
/** Pasada una semana conviene volver a subir la publicación en Marketplace para que aparezca otra vez arriba. */
const DIAS_RECORDAR = 7
const sinTildes = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()

export function Historial({ lista, placas, abrir, duplicar, borrar, cambiarEstado, usarPlaca, borrarPlaca, perfil, ajustes, refrescar }: Props) {
  const [consulta, setConsulta] = useState('')
  const [filtro, setFiltro] = useState<EstadoVenta | 'todos'>('todos')
  const [consultaPlacas, setConsultaPlacas] = useState('')
  // El texto de cada publicación se arma con su vehículo y el perfil y ajustes de ahora: nunca queda desactualizado
  const vigentes = useMemo(() => buscarEnHistorial(lista, consulta, filtro).map((p) => {
    const v = migrar(p.vehiculo, VEHICULO_VACIO, (c) => p.origenes?.[c] === 'manual')
    return { ...p, etiquetas: etiquetasMarketplace(v, ajustes.ubicacion), ...(p.seleccion && perfil ? publicacionVigente({ v, perfil, beneficios: ajustes.beneficios, ubicacion: ajustes.ubicacion }, p.seleccion) : {}) }
  }), [lista, perfil, ajustes, consulta, filtro])
  const cuenta = useMemo(() => contarEstados(lista), [lista])
  const placasVisibles = useMemo(() => {
    const palabras = sinTildes(consultaPlacas).replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean)
    return palabras.length ? placas.filter((p) => palabras.every((w) => sinTildes(`${p.placa} ${p.resumen}`).includes(w))) : placas
  }, [placas, consultaPlacas])

  return (
    <div className="ajustes">
      {perfil && <VariasPlacas perfil={perfil} ajustes={ajustes} alGuardar={refrescar} />}
      <section className="tarjeta" aria-labelledby="t-publicaciones">
        <h2 id="t-publicaciones">Publicaciones guardadas</h2>
        {!lista.length && <p className="vacio">Todavía no has guardado publicaciones. Genera una y pulsa «Guardar en el historial».</p>}
        {lista.length > 0 && (
          <div className="buscador">
            <input type="search" value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder="🔎 Buscar por placa, marca, modelo, año o color" aria-label="Buscar publicaciones" />
            <div className="resumen-estados" role="group" aria-label="Filtrar por estado">
              <button type="button" className={`chip ${filtro === 'todos' ? 'activo' : ''}`} aria-pressed={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todas ({lista.length})</button>
              {ESTADOS.map((e) => (
                <button key={e.id} type="button" className={`chip ${filtro === e.id ? 'activo' : ''}`} aria-pressed={filtro === e.id} onClick={() => setFiltro(e.id)}>
                  {e.icono} {e.nombre} ({cuenta[e.id]})
                </button>
              ))}
            </div>
          </div>
        )}
        {lista.length > 0 && !vigentes.length && <p className="vacio">Ninguna publicación coincide con la búsqueda.</p>}
        <ul className="historial">
          {vigentes.map((p) => {
            const estado = estadoDe(p)
            const info = ESTADOS.find((e) => e.id === estado)!
            const original = lista.find((x) => x.id === p.id)!
            const dias = diasDesde(p.fecha)
            return (
              <li key={p.id} className={`tarjeta ${estado}`}>
                <div className="cabecera-historial">
                  <strong>{p.placa && <><span className="chapa">{p.placa}</span> </>}{p.titulo}</strong>
                  <div className="meta-historial">
                    <span className={`estado ${estado}`}>{info.icono} {info.nombre}</span>
                    <span title={fecha(p.fecha)}>Guardada {haceCuanto(p.fecha)}</span>
                  </div>
                  {estado === 'disponible' && dias >= DIAS_RECORDAR && <span className="recordatorio">⏰ Tiene {dias} días: conviene volver a subirla para que aparezca arriba en Marketplace.</span>}
                </div>
                {!p.seleccion && <p className="ayuda">Guardada con una versión anterior: ábrela y cambia algo para que se mantenga al día.</p>}
                <div className="fila">
                  <Copiar texto={p.titulo} etiqueta="Copiar título" />
                  <Copiar texto={p.descripcion} etiqueta="Copiar descripción" />
                  {p.etiquetas.length > 0 && <Copiar texto={p.etiquetas.join(', ')} etiqueta="Copiar etiquetas" />}
                </div>
                <div className="fila">
                  <button type="button" className="boton secundario" onClick={() => abrir(original)}>Abrir y editar</button>
                  <button type="button" className="boton secundario" title="Crea una publicación nueva con estos mismos datos" onClick={() => duplicar(original)}>Duplicar</button>
                  <select className="estado-select" value={estado} aria-label="Estado de la venta" onChange={(e) => cambiarEstado(p.id, e.target.value as EstadoVenta)}>
                    {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.icono} {e.nombre}</option>)}
                  </select>
                  <button type="button" className="icono" title="Eliminar" aria-label={`Eliminar ${p.titulo}`} onClick={() => borrar(p.id)}>🗑</button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="tarjeta" aria-labelledby="t-placas">
        <h2 id="t-placas">Placas consultadas</h2>
        <p className="ayuda">Cada placa consultada en el SRI queda aquí con sus datos, para usarla otra vez sin volver a consultar.</p>
        {!placas.length && <p className="vacio">Aún no has consultado placas.</p>}
        {placas.length > 3 && (
          <div className="buscador">
            <input type="search" value={consultaPlacas} onChange={(e) => setConsultaPlacas(e.target.value)} placeholder="🔎 Buscar placa o vehículo" aria-label="Buscar placas" />
          </div>
        )}
        {placas.length > 0 && !placasVisibles.length && <p className="vacio">Ninguna placa coincide.</p>}
        <ul className="historial">
          {placasVisibles.map((p) => (
            <li key={p.placa} className="tarjeta">
              <div className="cabecera-historial">
                <strong><span className="chapa">{p.placa}</span> {p.resumen || <em className="vacio">Sin datos</em>}</strong>
                <small title={fecha(p.fecha)}>Consultada {haceCuanto(p.fecha)}</small>
              </div>
              {p.sinRespuesta && <p className="aviso">Sin respuesta: {p.sinRespuesta}</p>}
              {p.resultado.avisos.map((a) => <p key={a} className="aviso">{a}</p>)}
              <div className="fila">
                <button type="button" className="boton secundario" onClick={() => usarPlaca(p)}>{p.sinRespuesta ? 'Corregir o volver a consultar' : 'Crear publicación con esta placa'}</button>
                <button type="button" className="icono" title="Eliminar" aria-label={`Eliminar la placa ${p.placa}`} onClick={() => borrarPlaca(p.placa)}>🗑</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
