import type { Hallazgo, Investigacion } from '../servicios/investigador'
import type { Vehiculo } from '../dominio/tipos'

export type EstadoInvestigacion = { estado: 'inactivo' | 'buscando' | 'listo' | 'error'; resultado?: Investigacion; error?: string }

interface Props {
  v: Vehiculo
  wikipedia: EstadoInvestigacion
  google: EstadoInvestigacion
  hayClaveGoogle: boolean
  investigarGoogle: () => void
  aplicar: (h: Hallazgo, valor: string) => void
  irAAjustes: () => void
}

/** Valor que se pone en el campo a partir de una opción encontrada («Hatchback 3 y 5 puertas» → «Hatchback»). */
export function valorParaCampo(campo: keyof Vehiculo, opcion: string): string {
  // «Hatchback 3 y 5 puertas» o «Hatchback tres y cinco puertas» → «Hatchback»
  if (campo === 'carroceria') return opcion.replace(/\s+(?:de\s+)?(?:\d|dos|tres|cuatro|cinco|seis|siete)\b.*$/i, '').replace(/:$/, '').trim()
  return opcion.trim()
}

function yaAplicado(v: Vehiculo, h: Hallazgo, opcion: string): boolean {
  if (!h.campo) return false
  const actual = v[h.campo]
  const valor = valorParaCampo(h.campo, opcion)
  return Array.isArray(actual) ? actual.includes(valor) : String(actual).toLowerCase() === valor.toLowerCase()
}

function Lista({ titulo, est, v, aplicar }: { titulo: string; est: EstadoInvestigacion; v: Vehiculo; aplicar: Props['aplicar'] }) {
  if (est.estado === 'inactivo') return null
  if (est.estado === 'buscando') return <p className="cargando">Buscando en {titulo}…</p>
  if (est.estado === 'error') return <p className="aviso error">⚠️ {titulo}: {est.error}</p>
  const r = est.resultado!
  return (
    <section className="fuente-bloque">
      <h4>{titulo}</h4>
      {r.resumen && <p className="resumen">{r.resumen}</p>}
      {r.avisos.map((a) => <p key={a} className="aviso">⚠️ {a}</p>)}
      {r.hallazgos.length === 0 && r.avisos.length === 0 && <p className="ayuda">No se encontraron datos adicionales.</p>}
      <ul className="hallazgos">
        {r.hallazgos.map((h, i) => (
          <li key={i}>
            <div><strong>{h.etiqueta}:</strong> {h.valor}</div>
            {h.campo && h.opciones && h.opciones.length > 0 && (
              <div className="chips">
                {h.opciones.map((o) => {
                  const hecho = yaAplicado(v, h, o)
                  return (
                    <button key={o} type="button" className={`chip ${hecho ? 'activo' : ''}`} disabled={hecho} onClick={() => aplicar(h, o)}>
                      {hecho ? '✓ ' : 'Usar: '}{h.campo === 'motor' ? `${o} L` : o}
                    </button>
                  )
                })}
              </div>
            )}
            <a className="fuente" href={h.fuente.url} target="_blank" rel="noreferrer">Fuente: {h.fuente.nombre}</a>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Datos reales del modelo con su fuente; el vendedor decide qué usar. */
export function PanelInvestigacion({ v, wikipedia, google, hayClaveGoogle, investigarGoogle, aplicar, irAAjustes }: Props) {
  const consulta = [v.marca, v.modelo, v.version, v.anio, 'ficha técnica Ecuador'].filter(Boolean).join(' ')
  return (
    <div className="panel-investigacion">
      {!v.modelo && <p className="ayuda">Escribe al menos la marca y el modelo para buscar sus datos reales.</p>}
      <Lista titulo="Wikipedia" est={wikipedia} v={v} aplicar={aplicar} />
      <Lista titulo="Google" est={google} v={v} aplicar={aplicar} />
      {v.modelo && (
        <div className="acciones-google">
          {hayClaveGoogle ? (
            <button type="button" className="boton secundario" disabled={google.estado === 'buscando'} onClick={investigarGoogle}>
              🔎 {google.estado === 'listo' ? 'Volver a buscar en Google' : 'Buscar datos exactos en Google'}
            </button>
          ) : (
            <p className="ayuda">
              Para datos exactos de la versión y el año, activa la búsqueda en Google en{' '}
              <button type="button" className="enlace" onClick={irAAjustes}>Ajustes</button> (es gratis).
            </p>
          )}
          <a className="boton enlace-externo" href={`https://www.google.com/search?q=${encodeURIComponent(consulta)}`} target="_blank" rel="noreferrer">
            Abrir en Google para verificar ↗
          </a>
        </div>
      )}
    </div>
  )
}
