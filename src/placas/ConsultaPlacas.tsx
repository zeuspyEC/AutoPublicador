import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copiar } from '../componentes/Copiar'
import { copiar } from '../servicios/almacen'
import { normalizarPlaca, placaValida, SERVIDOR_PLACAS } from '../servicios/placa'
import {
  compararFuentes, dinero, fecha, FUENTES_MANUALES, informeTexto, interpretacion, NIVELES, nivelDeVerificacion, valoresPendientes,
  type RespuestaConsulta, type SriConsulta,
} from './informe'

const CLAVE_RECIENTES = 'ap.placas.recientes'
const CLAVE_TEMA = 'ap.placas.tema'
type Tema = 'sistema' | 'claro' | 'oscuro'
const TEMAS: Record<Tema, { icono: string; nombre: string; siguiente: Tema }> = {
  sistema: { icono: '🌗', nombre: 'Automático', siguiente: 'claro' },
  claro: { icono: '☀️', nombre: 'Claro', siguiente: 'oscuro' },
  oscuro: { icono: '🌙', nombre: 'Oscuro', siguiente: 'sistema' },
}

const leer = <T,>(clave: string, defecto: T): T => { try { return (JSON.parse(localStorage.getItem(clave) ?? 'null') as T) ?? defecto } catch { return defecto } }
const guardar = (clave: string, v: unknown) => { try { localStorage.setItem(clave, JSON.stringify(v)) } catch { /* sin almacenamiento */ } }
/** «IMPUESTOS SRI Y TASAS» → «Impuestos SRI y Tasas» (siglas en mayúsculas, preposiciones en minúscula). */
const titulo = (s?: unknown) => String(s ?? '').toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (_, a, b) => a + b.toUpperCase())
  .replace(/(?<=\s)(De|Del|La|Las|Los|Y|E|A|En)(?=\s)/g, (m) => m.toLowerCase())
  .replace(/\b(Sri|Ant|Amt|Atm|Cte|Sppat|Iacv|Rtv|Camv|Cpn|Suv|Usa)\b/g, (m) => m.toUpperCase())
const si = (x: unknown) => x === true || /^(s|si|sí|true)$/i.test(String(x ?? '').trim())

function aplicarTema(t: Tema) {
  const r = document.documentElement
  if (t === 'sistema') delete r.dataset.tema
  else r.dataset.tema = t
  const oscuro = t === 'oscuro' || (t === 'sistema' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#0b1020' : '#1e3a8a')
}

async function pedirConsulta(placa: string, nuevo: boolean): Promise<RespuestaConsulta> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), 70000)
  try {
    const r = await fetch(`${SERVIDOR_PLACAS}/consulta/${placa}${nuevo ? '?nuevo=1' : ''}`, { signal: c.signal, headers: { Accept: 'application/json' } })
    const j = await r.json().catch(() => null)
    if (!r.ok || !j) throw new Error(j?.error ?? `El servidor respondió ${r.status}.`)
    return j as RespuestaConsulta
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('Las fuentes tardaron demasiado en responder. Intenta otra vez.')
    if (e instanceof TypeError) throw new Error(navigator.onLine ? 'No se pudo conectar con el servidor de consultas. Intenta otra vez.' : 'No tienes conexión a internet.')
    throw e
  } finally { clearTimeout(t) }
}

export function ConsultaPlacas() {
  const inicial = normalizarPlaca(new URLSearchParams(location.search).get('placa') ?? '')
  const [entrada, setEntrada] = useState(inicial)
  const [estado, setEstado] = useState<'inicio' | 'cargando' | 'listo' | 'error'>('inicio')
  const [datos, setDatos] = useState<RespuestaConsulta | null>(null)
  const [error, setError] = useState('')
  const [recientes, setRecientes] = useState<string[]>(() => leer(CLAVE_RECIENTES, []))
  const [tema, setTema] = useState<Tema>(() => leer(CLAVE_TEMA, 'sistema'))

  useEffect(() => {
    aplicarTema(tema)
    guardar(CLAVE_TEMA, tema)
    if (tema !== 'sistema') return
    const m = matchMedia('(prefers-color-scheme: dark)')
    const cb = () => aplicarTema('sistema')
    m.addEventListener('change', cb)
    return () => m.removeEventListener('change', cb)
  }, [tema])

  const consultar = useCallback(async (valor: string, nuevo = false) => {
    const placa = normalizarPlaca(valor)
    setEntrada(placa)
    if (!placaValida(placa)) {
      setEstado('error')
      setError('Escribe una placa válida: 3 letras y 3 o 4 números (PBA1234), o de moto: 2 letras, 3 números y 1 letra (IA123B).')
      return
    }
    setEstado('cargando')
    setError('')
    history.replaceState(null, '', `?placa=${placa}`)
    try {
      const r = await pedirConsulta(placa, nuevo)
      setDatos(r)
      setEstado('listo')
      if (r.sri.encontrada || r.atm.encontrada) setRecientes((l) => { const n = [placa, ...l.filter((x) => x !== placa)].slice(0, 8); guardar(CLAVE_RECIENTES, n); return n })
      document.title = `${placa} · Consulta de placas`
    } catch (e) {
      setEstado('error')
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => { if (inicial) void consultar(inicial) }, [consultar, inicial])

  return (
    <div className="consulta-placas">
      <header className="cabecera-placas">
        <div>
          <h1>Consulta de placas</h1>
          <p className="ayuda">Datos oficiales del vehículo en Ecuador: SRI y ATM, verificados entre sí.</p>
        </div>
        <button type="button" className="boton secundario tema" onClick={() => setTema(TEMAS[tema].siguiente)} aria-label={`Tema: ${TEMAS[tema].nombre}. Cambiar`} title={`Tema: ${TEMAS[tema].nombre}`}>
          {TEMAS[tema].icono} <span>{TEMAS[tema].nombre}</span>
        </button>
      </header>

      <form className="tarjeta buscador-placa" onSubmit={(e) => { e.preventDefault(); void consultar(entrada) }}>
        <label htmlFor="placa">Placa del vehículo</label>
        <div className="fila">
          <input id="placa" className="campo-placa" value={entrada} onChange={(e) => setEntrada(e.target.value.toUpperCase())} placeholder="PBA1234"
            autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={10} inputMode="text" aria-describedby="ayuda-placa" />
          <button type="submit" className="boton principal grande" disabled={estado === 'cargando'}>{estado === 'cargando' ? 'Consultando…' : 'Consultar'}</button>
        </div>
        <p id="ayuda-placa" className="ayuda">Autos: PBA1234 o PBA123 · Motos: IA123B. Sin guiones ni espacios (se quitan solos).</p>
        {recientes.length > 0 && (
          <div className="recientes" aria-label="Consultas recientes">
            <span>Recientes:</span>
            {recientes.map((p) => <button key={p} type="button" className="chip" onClick={() => void consultar(p)}>{p}</button>)}
          </div>
        )}
      </form>

      {estado === 'cargando' && <Cargando placa={entrada} />}
      {estado === 'error' && <div className="tarjeta error-consulta" role="alert"><strong>No se pudo consultar</strong><p>{error}</p>{placaValida(entrada) && <button type="button" className="boton secundario" onClick={() => void consultar(entrada, true)}>Reintentar</button>}</div>}
      {estado === 'listo' && datos && <Resultado datos={datos} actualizar={() => void consultar(datos.placa, true)} />}
      {estado === 'inicio' && <Presentacion />}

      <footer className="pie-placas">
        <p>Solo se muestran datos del vehículo: ningún dato del propietario. Las consultas se guardan 6 horas para no sobrecargar las fuentes oficiales.</p>
        <p><a href="../">Ir a AutoPublicador</a></p>
      </footer>
    </div>
  )
}

function Presentacion() {
  return (
    <section className="tarjeta presentacion" aria-labelledby="t-que">
      <h2 id="t-que">¿Qué obtienes?</h2>
      <ul className="lista-check">
        <li><strong>Ficha del vehículo</strong> registrada en el SRI: marca, modelo, año, país, clase, servicio y cantón.</li>
        <li><strong>Verificación cruzada</strong>: el SRI y la ATM se comparan dato por dato.</li>
        <li><strong>Valores pendientes</strong> de matrícula y transferencia, con recargos e intereses.</li>
        <li><strong>Historial de pagos</strong> y cuántos traspasos de dominio se pagaron.</li>
        <li><strong>Cilindraje</strong> calculado con el impuesto ambiental pagado (cuando el SRI no lo informa).</li>
        <li><strong>Revisiones técnicas</strong> registradas en la ATM de Guayaquil desde 2016.</li>
        <li>Accesos directos a <strong>ANT, AMT y CTE</strong> para multas y revisión en Quito.</li>
      </ul>
    </section>
  )
}

function Cargando({ placa }: { placa: string }) {
  return (
    <section className="tarjeta cargando" aria-live="polite" aria-busy="true">
      <h2>Consultando {placa}…</h2>
      <ul className="pasos">
        <li><span className="girando" aria-hidden="true" /> SRI · matrícula, valores y pagos</li>
        <li><span className="girando" aria-hidden="true" /> ATM Guayaquil · datos y revisiones técnicas</li>
      </ul>
      <p className="ayuda">La primera consulta de una placa tarda unos segundos; las siguientes son inmediatas.</p>
    </section>
  )
}

function Resultado({ datos, actualizar }: { datos: RespuestaConsulta; actualizar: () => void }) {
  const comparacion = useMemo(() => compararFuentes(datos), [datos])
  const nivel = nivelDeVerificacion(datos, comparacion)
  const inter = useMemo(() => interpretacion(datos), [datos])
  const texto = useMemo(() => informeTexto(datos), [datos])
  const { sri, atm } = datos
  const b = sri.base
  const nombre = [b?.descripcionMarca ?? atm.marca, b?.descripcionModelo ?? atm.modelo, String(b?.anioAuto ?? atm.anio ?? '')].filter(Boolean).map(titulo).join(' ')
  const compartir = async () => {
    const url = `${location.origin}${location.pathname}?placa=${datos.placa}`
    if (navigator.share) { try { await navigator.share({ title: `Placa ${datos.placa}`, text: nombre, url }); return } catch { /* cancelado */ } }
    await copiar(url)
  }

  return (
    <div className="resultado-placa">
      <section className={`tarjeta resumen-placa nivel-${nivel}`} aria-labelledby="t-resumen">
        <div className="titulo-placa">
          <span className="chapa grande">{datos.placa}</span>
          <div>
            <h2 id="t-resumen">{nombre || 'Sin datos del vehículo'}</h2>
            <p className="consultado">Consultado el {new Date(datos.consultado).toLocaleString('es-EC', { dateStyle: 'long', timeStyle: 'short' })}</p>
          </div>
        </div>
        <div className={`sello nivel-${nivel}`} role="status">
          <strong>{nivel === 'verificada' ? '✔' : nivel === 'no-encontrada' ? '✖' : '⚠'} {NIVELES[nivel].titulo}</strong>
          <span>{NIVELES[nivel].texto}</span>
        </div>
        <div className="fila acciones no-imprimir">
          <Copiar texto={texto} etiqueta="Copiar informe" principal />
          <a className="boton secundario" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer">Enviar por WhatsApp</a>
          <button type="button" className="boton secundario" onClick={() => void compartir()}>Compartir enlace</button>
          <button type="button" className="boton secundario" onClick={() => print()}>Imprimir o PDF</button>
          <button type="button" className="boton secundario" onClick={actualizar} title="Vuelve a consultar las fuentes sin usar la copia guardada">Actualizar datos</button>
        </div>
      </section>

      {inter && inter.avisos.length > 0 && (
        <section className="tarjeta avisos-placa" aria-labelledby="t-avisos">
          <h2 id="t-avisos">⚠️ Para tener en cuenta</h2>
          <ul>{inter.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
        </section>
      )}

      {comparacion.length > 0 && (
        <section className="tarjeta" aria-labelledby="t-verif">
          <h2 id="t-verif">Verificación entre fuentes</h2>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead><tr><th scope="col">Dato</th><th scope="col">SRI</th><th scope="col">ATM</th><th scope="col">Resultado</th></tr></thead>
              <tbody>
                {comparacion.map((c) => (
                  <tr key={c.dato}>
                    <th scope="row">{c.dato}</th><td>{c.sri || '—'}</td><td>{c.atm || '—'}</td>
                    <td><span className={`etiqueta-estado ${c.estado}`}>{{ coincide: '✔ Coincide', difiere: '⚠ Difiere', 'solo-sri': 'Solo SRI', 'solo-atm': 'Solo ATM' }[c.estado]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ayuda">La ATM guarda el modelo abreviado: se considera igual si coincide el comienzo.</p>
        </section>
      )}

      <FichaSri sri={sri} cilindraje={inter?.hallazgos.find((h) => h.campo === 'motor')} />
      {sri.encontrada && <Valores sri={sri} />}
      {sri.encontrada && <Pagos sri={sri} />}
      <Revisiones datos={datos} />
      <OtrasFuentes placa={datos.placa} />
    </div>
  )
}

function Fuente({ ok, error, nombre }: { ok: boolean; error?: string; nombre: string }) {
  return <span className={`fuente-estado ${ok ? 'ok' : 'falla'}`}>{ok ? `✔ ${nombre}` : `✖ ${nombre}: ${error ?? 'sin datos'}`}</span>
}

function FichaSri({ sri, cilindraje }: { sri: SriConsulta; cilindraje?: { etiqueta: string; valor: string } }) {
  if (!sri.encontrada || !sri.base) {
    return <section className="tarjeta" aria-labelledby="t-ficha"><h2 id="t-ficha">Ficha del SRI</h2><Fuente ok={false} error={sri.error} nombre="SRI" /></section>
  }
  const b = sri.base
  const filas: [string, unknown][] = [
    ['Marca', titulo(b.descripcionMarca)], ['Modelo registrado', b.descripcionModelo], ['Año del modelo', b.anioAuto], ['País de origen', titulo(b.descripcionPais)],
    ['Clase', titulo(b.nombreClase)], ['Servicio', titulo(b.descripcionServicio)],
    ['Color', [b.colorVehiculo1, b.colorVehiculo2].filter(Boolean).map(titulo).join(' / ')],
    [cilindraje?.etiqueta ?? 'Cilindraje', cilindraje?.valor ?? (b.cilindraje ? `${b.cilindraje} cc` : '')],
    ['Cantón de matrícula', titulo(b.descripcionCanton)], ['Placa registrada', sri.registrada], ['Código CAMV / CPN', b.numeroCamvCpn],
    ['Último año de matrícula pagado', b.ultimoAnioPagado], ['Última matrícula', fecha(b.fechaUltimaMatricula)], ['Matrícula vigente hasta', fecha(b.fechaCaducidadMatricula)],
    ['Fecha de compra / registro', fecha(b.fechaCompraRegistro)], ['Última revisión registrada', fecha(b.fechaRevision)],
    ['Exonerado', b.estadoExoneracion ? (si(b.estadoExoneracion) ? 'Sí' : 'No') : ''], ['Prohibido de enajenar', b.prohibidoEnajenar ? (si(b.prohibidoEnajenar) ? 'Sí ⚠️' : 'No') : ''],
    ['Vehículo eléctrico', si(b.verMensajeElectricos) ? 'Sí' : ''], ['Impuesto ambiental en cuotas', si(b.aplicaCuota) ? 'Sí' : ''],
    ['Motivo', b.mensajeMotivoAuto], ['Observación del SRI', b.observacion],
  ]
  const visibles = filas.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
  const faltan = [['Color', b.colorVehiculo1], ['Cilindraje', b.cilindraje ?? cilindraje], ['Clase', b.nombreClase], ['Servicio', b.descripcionServicio], ['Cantón', b.descripcionCanton]]
    .filter(([, v]) => !v).map(([k]) => k)
  return (
    <section className="tarjeta" aria-labelledby="t-ficha">
      <h2 id="t-ficha">Ficha del vehículo · SRI</h2>
      <dl className="ficha">{visibles.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl>
      {faltan.length > 0 && <p className="ayuda">El SRI no informa para esta placa: {faltan.join(', ').toLowerCase()}. No se completan con suposiciones.</p>}
    </section>
  )
}

function Valores({ sri }: { sri: SriConsulta }) {
  const v = valoresPendientes(sri)
  const comps = (cod?: number) => (sri.componentes ?? []).find((c) => c.codigoRubro === cod)?.componentes ?? []
  return (
    <section className="tarjeta" aria-labelledby="t-valores">
      <h2 id="t-valores">Valores pendientes · SRI</h2>
      {v.total === 0 ? <p className="estado-ok">✔ Sin valores pendientes en el SRI.</p> : (
        <>
          <div className="cifras">
            <div><span>Total pendiente</span><strong>{dinero(v.total)}</strong></div>
            {v.matricula > 0 && <div><span>Matrícula e impuestos</span><strong>{dinero(v.matricula)}</strong></div>}
            {v.traspaso > 0 && <div><span>Transferencia de dominio</span><strong>{dinero(v.traspaso)}</strong></div>}
            {v.recargos > 0 && <div><span>Incluye recargos e intereses</span><strong>{dinero(v.recargos)}</strong></div>}
          </div>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead><tr><th scope="col">Concepto</th><th scope="col">Tipo</th><th scope="col">Años</th><th scope="col" className="num">Valor</th></tr></thead>
              <tbody>
                {v.rubros.map((x, i) => (
                  <tr key={`${x.codigoRubro}-${i}`}>
                    <td>{titulo(x.descripcionRubro)}{comps(x.codigoRubro).length > 0 && <small className="desglose">{comps(x.codigoRubro).map((c) => `${titulo(c.codigoComponente)} ${c.anioFiscal ?? ''}: ${dinero(+(c.valorComponente ?? 0))}`).join(' · ')}</small>}</td>
                    <td>{titulo(x.descripcionTipoDeuda ?? x.codigoTipoDeuda)}</td>
                    <td>{x.anioDesdePago && x.anioDesdePago !== x.anioHastaPago ? `${x.anioDesdePago}–${x.anioHastaPago}` : x.anioHastaPago ?? '—'}</td>
                    <td className="num">{dinero(+(x.valorRubro ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {(sri.planExcepcional ?? []).length > 0 && (
        <details className="detalle"><summary>Plan excepcional de pagos ({sri.planExcepcional!.length})</summary>
          <ul>{sri.planExcepcional!.map((p, i) => <li key={i}>{Object.entries(p).filter(([, x]) => x !== null && x !== '').map(([k, x]) => `${k}: ${x}`).join(' · ')}</li>)}</ul>
        </details>
      )}
    </section>
  )
}

function Pagos({ sri }: { sri: SriConsulta }) {
  const rp = sri.resumenPagos
  const pagos = sri.pagos ?? []
  const iacv = sri.impuestoAmbiental ?? []
  return (
    <section className="tarjeta" aria-labelledby="t-pagos">
      <h2 id="t-pagos">Historial de pagos · SRI</h2>
      {rp?.totalPagos ? (
        <div className="cifras">
          <div><span>Pagos registrados</span><strong>{rp.totalPagos}</strong></div>
          <div><span>Traspasos de dominio</span><strong>{rp.traspasos ?? 0}</strong></div>
          {rp.ultimoTraspaso && <div><span>Último traspaso</span><strong>{fecha(rp.ultimoTraspaso)}</strong></div>}
          {rp.primerPago && <div><span>Primer pago</span><strong>{fecha(rp.primerPago)}</strong></div>}
        </div>
      ) : <p className="ayuda">El SRI no registra pagos para esta placa.</p>}
      {pagos.length > 0 && (
        <div className="tabla-scroll">
          <table className="tabla">
            <caption>{pagos.length === 15 ? 'Los 15 pagos más recientes' : `${pagos.length} pagos`}</caption>
            <thead><tr><th scope="col">Fecha</th><th scope="col">Tipo</th><th scope="col" className="num">Monto</th></tr></thead>
            <tbody>{pagos.map((p, i) => <tr key={i}><td>{fecha(p.fechaDePago)}</td><td>{titulo(p.tipoDeuda).replace(/^Pago Del Valor De (La )?/i, '')}</td><td className="num">{p.monto != null ? dinero(+p.monto) : '—'}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {(sri.detallesPago ?? []).filter((d) => d.detalle?.length).map((d) => (
        <details key={d.fechaDePago} className="detalle">
          <summary>Detalle del pago del {fecha(d.fechaDePago)}</summary>
          <ul>{d.detalle.map((x, i) => <li key={i}>{titulo(x.descripcionRubro)} {x.anio} · {titulo(x.descripcionComponente)}: {dinero(+(x.valor ?? 0))}</li>)}</ul>
        </details>
      ))}
      {iacv.length > 0 && (
        <details className="detalle">
          <summary>Impuesto ambiental pagado por año ({iacv.length})</summary>
          <p className="ayuda">El SRI cobraba este impuesto según el cilindraje (2012–2019): con él se calcula el cilindraje registrado.</p>
          <ul>{[...iacv].sort((x, y) => +(y.anio ?? 0) - +(x.anio ?? 0)).map((x, i) => <li key={i}>{x.anio}: {dinero(+(x.valor ?? 0))}</li>)}</ul>
        </details>
      )}
    </section>
  )
}

function Revisiones({ datos }: { datos: RespuestaConsulta }) {
  const { atm } = datos
  const rev = atm.revisiones ?? []
  return (
    <section className="tarjeta" aria-labelledby="t-rtv">
      <h2 id="t-rtv">Revisión técnica · ATM Guayaquil</h2>
      {!atm.encontrada ? <Fuente ok={false} error={atm.error} nombre="ATM" /> : (
        <>
          <dl className="ficha compacta">
            <div><dt>Marca</dt><dd>{titulo(atm.marca)}</dd></div>
            <div><dt>Modelo</dt><dd>{atm.modelo}</dd></div>
            <div><dt>Año</dt><dd>{atm.anio}</dd></div>
          </dl>
          {rev.length === 0 ? <p className="ayuda">Sin revisiones técnicas en Guayaquil entre {atm.desde} y {atm.hasta}. Si el vehículo se matricula en Quito, revisa la AMT abajo.</p> : (
            <div className="tabla-scroll">
              <table className="tabla">
                <thead><tr><th scope="col">Fecha</th><th scope="col">Trámite</th><th scope="col">Resultado</th></tr></thead>
                <tbody>{rev.map((r, i) => (
                  <tr key={i}><td>{fecha(r.fecha)}</td><td>{titulo(r.observacion)}</td>
                    <td><span className={`etiqueta-estado ${/APROB/i.test(r.estado) ? 'coincide' : /CONDIC/i.test(r.estado) ? 'solo-sri' : 'difiere'}`}>{titulo(r.estado)}</span>
                      {r.revision != null && <small className="desglose">Revisión n.º {r.revision}</small>}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function OtrasFuentes({ placa }: { placa: string }) {
  return (
    <section className="tarjeta no-imprimir" aria-labelledby="t-otras">
      <h2 id="t-otras">Otras consultas oficiales</h2>
      <p className="ayuda">Estas entidades no permiten que otras páginas lean sus datos: el botón copia la placa y abre su consulta oficial para que la pegues allí.</p>
      <ul className="otras-fuentes">
        {FUENTES_MANUALES.map((f) => (
          <li key={f.url}>
            <div><strong>{f.nombre}</strong><small>{f.detalle}</small></div>
            <button type="button" className="boton secundario" onClick={async () => { await copiar(placa); window.open(f.url, '_blank', 'noopener') }}>Copiar placa y abrir</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
