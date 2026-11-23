import { useState } from 'react'
import type { Hallazgo, Investigacion } from '../servicios/investigador'
import { SRI_PAGINA, urlBaseSri } from '../servicios/placa'
import type { Vehiculo } from '../dominio/tipos'

export type EstadoInvestigacion = { estado: 'inactivo' | 'buscando' | 'listo' | 'error'; resultado?: Investigacion; error?: string; sinAcceso?: boolean }

interface Props {
  v: Vehiculo
  placa: string
  sri: EstadoInvestigacion
  wikipedia: EstadoInvestigacion
  google: EstadoInvestigacion
  pegado: EstadoInvestigacion
  hayClaveGoogle: boolean
  investigarGoogle: () => void
  pegarSri: (texto: string) => boolean
  pegarGoogle: (texto: string) => void
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
  if (est.estado === 'buscando') return <p className="cargando">Consultando {titulo}…</p>
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

/** Respaldo cuando el navegador no puede consultar el SRI: abrir la consulta y pegar el resultado. */
function PegarSri({ placa, pegar }: { placa: string; pegar: Props['pegarSri'] }) {
  const [texto, setTexto] = useState('')
  const [fallo, setFallo] = useState(false)
  return (
    <div className="pegar">
      <p className="ayuda"><strong>Consulta manual (siempre funciona):</strong></p>
      <ol className="ayuda pasos">
        <li>Abre <a href={urlBaseSri(placa)} target="_blank" rel="noreferrer">los datos del SRI de la placa {placa}</a>, selecciona todo y cópialo.
          {' '}(También puedes usar la <a href={SRI_PAGINA} target="_blank" rel="noreferrer">consulta del SRI</a> y copiar la información del vehículo.)</li>
        <li>Pégalo aquí:</li>
      </ol>
      <textarea rows={4} value={texto} onChange={(e) => { setTexto(e.target.value); setFallo(false) }} placeholder='{"descripcionMarca":"CHEVROLET", …}  o  Marca: CHEVROLET …' />
      <div className="fila">
        <button type="button" className="boton secundario" disabled={!texto.trim()} onClick={() => setFallo(!pegar(texto))}>Usar estos datos</button>
      </div>
      {fallo && <p className="aviso">No se reconocieron datos del SRI en lo pegado. Copia la información del vehículo (marca, modelo, año…).</p>}
    </div>
  )
}

function PegarGoogle({ pegar }: { pegar: Props['pegarGoogle'] }) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  if (!abierto) return <button type="button" className="boton secundario" onClick={() => setAbierto(true)}>📋 Pegar lo que copiaste de Google</button>
  return (
    <div className="pegar">
      <p className="ayuda">Copia de Google la ficha técnica o el resumen (motor, transmisión, potencia, consumo…) y pégalo aquí. Sin claves ni APIs.</p>
      <textarea rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Motor 1.6 L, 110 hp, transmisión manual de 5 velocidades…" />
      <div className="fila"><button type="button" className="boton secundario" disabled={!texto.trim()} onClick={() => pegar(texto)}>Extraer datos</button></div>
    </div>
  )
}

/** Datos reales con su fuente (SRI por placa, Wikipedia, Google); el vendedor decide qué usar. */
export function PanelInvestigacion(p: Props) {
  const { v } = p
  const consulta = [v.marca, v.modelo, v.version, v.anio, 'ficha técnica Ecuador'].filter(Boolean).join(' ')
  return (
    <div className="panel-investigacion">
      {p.placa && (
        <>
          <Lista titulo={`SRI · placa ${p.placa}`} est={p.sri} v={v} aplicar={p.aplicar} />
          {p.sri.estado === 'error' && <PegarSri placa={p.placa} pegar={p.pegarSri} />}
        </>
      )}
      {!v.modelo && !p.placa && <p className="ayuda">Escribe al menos la marca y el modelo (o la placa) para buscar sus datos reales.</p>}
      <Lista titulo="Wikipedia" est={p.wikipedia} v={v} aplicar={p.aplicar} />
      <Lista titulo="Google" est={p.google} v={v} aplicar={p.aplicar} />
      <Lista titulo="Copiado de Google" est={p.pegado} v={v} aplicar={p.aplicar} />
      {v.modelo && (
        <div className="acciones-google">
          {p.hayClaveGoogle ? (
            <button type="button" className="boton secundario" disabled={p.google.estado === 'buscando'} onClick={p.investigarGoogle}>
              🔎 {p.google.estado === 'listo' || p.google.estado === 'error' ? 'Volver a buscar en Google' : 'Buscar datos exactos en Google'}
            </button>
          ) : (
            <p className="ayuda">
              Para datos exactos de la versión y el año, activa la búsqueda en Google en{' '}
              <button type="button" className="enlace" onClick={p.irAAjustes}>Ajustes</button> (es gratis).
            </p>
          )}
          <a className="boton enlace-externo" href={`https://www.google.com/search?q=${encodeURIComponent(consulta)}`} target="_blank" rel="noreferrer">
            Abrir en Google ↗
          </a>
          <PegarGoogle pegar={p.pegarGoogle} />
        </div>
      )}
    </div>
  )
}
