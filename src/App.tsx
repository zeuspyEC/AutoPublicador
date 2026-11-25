import { useEffect, useMemo, useRef, useState } from 'react'
import { analizar } from './dominio/analizador'
import { comentarios as generarComentarios, descripciones as generarDescripciones, titulos as generarTitulos } from './dominio/plantillas'
import { VEHICULO_VACIO, type Ajustes as TAjustes, type Origen, type Origenes, type Perfil, type Vehiculo } from './dominio/tipos'
import { almacen, type PlacaConsultada, type Publicacion } from './servicios/almacen'
import { investigarGoogle, investigarTextoPegado, investigarWikipedia, type Hallazgo, type Investigacion } from './servicios/investigador'
import { consultarSri, ErrorPlaca, interpretarPegado, interpretarSri, normalizarPlaca, placaValida, resumenDePlaca, SERVIDOR_PLACAS } from './servicios/placa'
import { CampoPlaca } from './componentes/CampoPlaca'
import { placasConocidas, type PlacaConocida } from './dominio/sugerencias'
import { Ajustes } from './componentes/Ajustes'
import { FormPerfil } from './componentes/FormPerfil'
import { FormVehiculo } from './componentes/FormVehiculo'
import { Historial } from './componentes/Historial'
import { PanelInvestigacion, type EstadoInvestigacion } from './componentes/PanelInvestigacion'
import { fusionar, valorParaCampo, type Diferencia } from './dominio/fusion'
import { migrar } from './dominio/etiquetas'
import { Respuestas } from './componentes/Respuestas'
import { Resultados } from './componentes/Resultados'

type Vista = 'crear' | 'historial' | 'ajustes' | 'respuestas'

const IMPORTANTES: (keyof Vehiculo)[] = ['marca', 'modelo', 'anio', 'motor', 'transmision', 'precio']
const NOMBRE_CAMPO: Partial<Record<keyof Vehiculo, string>> = { marca: 'marca', modelo: 'modelo', version: 'versión', puertas: 'puertas', anio: 'año', motor: 'motor', transmision: 'transmisión', precio: 'precio', color: 'color', procedencia: 'procedencia', matricula: 'matrícula', carroceria: 'carrocería' }

const EJEMPLOS = [
  'Peugeot 206 XT 1.6 2008 procedencia argentina, techo corredizo, pantalla android, cámara de retro, aros. Matrícula 2025 cero multas. $4990 antes $5300, negociable, recibo carro o moto, a toda prueba',
  'Chevrolet Vitara clásico 3P DLX 1997 T/M A/A ecuatoriano, matrícula al día 2025, cero multas, 4990',
  'Toyota Hilux 2.5 2014 diésel 4x4 cabina doble 145.000 km, único dueño, $28500 negociable',
]

export default function App() {
  const [perfil, setPerfil] = useState<Perfil | null>(() => almacen.perfil())
  const [ajustes, setAjustes] = useState<TAjustes>(() => almacen.ajustes())
  const [vista, setVista] = useState<Vista>('crear')
  const borrador = useMemo(() => almacen.borrador(), [])
  const [texto, setTexto] = useState(borrador?.texto ?? '')
  const [v, setV] = useState<Vehiculo>(() => migrar(borrador?.vehiculo, VEHICULO_VACIO, (c) => borrador?.origenes?.[c] === 'manual')) // completa borradores antiguos
  const [origenes, setOrigenes] = useState<Origenes>(borrador?.origenes ?? {})
  const [generado, setGenerado] = useState(!!borrador?.vehiculo?.modelo)
  const [wiki, setWiki] = useState<EstadoInvestigacion>({ estado: 'inactivo' })
  const [google, setGoogle] = useState<EstadoInvestigacion>({ estado: 'inactivo' })
  const [placa, setPlaca] = useState('')
  const [placaConsultada, setPlacaConsultada] = useState('')
  const [sri, setSri] = useState<EstadoInvestigacion>({ estado: 'inactivo' })
  const [pegado, setPegado] = useState<EstadoInvestigacion>({ estado: 'inactivo' })
  const [correcciones, setCorrecciones] = useState<string[]>([])
  const [diferencias, setDiferencias] = useState<Diferencia[]>([])
  const [historial, setHistorial] = useState<Publicacion[]>(() => almacen.historial())
  const [placas, setPlacas] = useState<PlacaConsultada[]>(() => almacen.placas())
  const [idPublicacion, setIdPublicacion] = useState<string>(() => crypto.randomUUID())
  const textoGenerado = useRef(borrador?.texto ?? '')
  const ronda = useRef(0) // descarta respuestas de investigaciones anteriores
  const vActual = useRef(v)
  vActual.current = v
  const resultadosRef = useRef<HTMLElement>(null)

  useEffect(() => { almacen.guardarBorrador({ texto, vehiculo: v, origenes }) }, [texto, v, origenes])

  const faltantes = IMPORTANTES.filter((k) => !v[k])
  const ctx = useMemo(() => (perfil ? { v, perfil, beneficios: ajustes.beneficios, ubicacion: ajustes.ubicacion } : null), [v, perfil, ajustes])
  const titulos = useMemo(() => (ctx ? generarTitulos(ctx) : []), [ctx])
  const descripciones = useMemo(() => (ctx ? generarDescripciones(ctx) : []), [ctx])
  const comentarios = useMemo(() => (ctx ? generarComentarios(ctx) : []), [ctx])
  const conocidas = useMemo(() => placasConocidas(placas, historial), [placas, historial])
  const placaNormal = normalizarPlaca(placa)
  const placaOk = !placa.trim() || placaValida(placaNormal)

  /** Completa los campos vacíos con lo investigado (sobre el estado actual: el vendedor pudo editar mientras tanto). */
  const origenesActuales = useRef(origenes)
  origenesActuales.current = origenes

  /** Fusiona lo investigado: el SRI manda sobre el texto (y se informan las diferencias); el resto solo completa vacíos. */
  function completarCon(r: Investigacion, origen: Origen) {
    const f = fusionar(vActual.current, origenesActuales.current, r, origen)
    vActual.current = f.vehiculo
    origenesActuales.current = f.origenes
    setV(f.vehiculo)
    setOrigenes(f.origenes)
    if (f.diferencias.length) setDiferencias((d) => [...d.filter((x) => !f.diferencias.some((y) => y.campo === x.campo)), ...f.diferencias])
  }

  /** Deshace la prioridad del SRI: vuelve a los valores del texto. */
  function usarTexto() {
    const nv = { ...vActual.current }
    for (const d of diferencias) (nv as unknown as Record<string, unknown>)[d.campo] = d.anterior
    vActual.current = nv
    setV(nv)
    setOrigenes((co) => { const n = { ...co }; for (const d of diferencias) n[d.campo] = 'texto'; return n })
    setDiferencias([])
  }

  async function buscarGoogle(base: Vehiculo, n: number) {
    if (!ajustes.claveGemini) return
    setGoogle({ estado: 'buscando' })
    try {
      const r = await investigarGoogle(base, ajustes.claveGemini)
      if (n !== ronda.current) return
      setGoogle({ estado: 'listo', resultado: r })
      completarCon(r, 'google')
    } catch (e) {
      if (n === ronda.current) setGoogle({ estado: 'error', error: (e as Error).message })
    }
  }

  async function buscarWikipedia(base: Vehiculo, n: number) {
    if (!base.modelo) { setWiki({ estado: 'inactivo' }); return }
    setWiki({ estado: 'buscando' })
    try {
      const r = await investigarWikipedia(base)
      if (n === ronda.current) { setWiki({ estado: 'listo', resultado: r }); completarCon(r, 'wikipedia') }
    } catch (e) {
      if (n === ronda.current) setWiki({ estado: 'error', error: 'No se pudo consultar Wikipedia. Revisa tu conexión a internet.' })
      console.error(e)
    }
  }

  /** Consulta la placa en el SRI; si el navegador no puede, deja el panel para pegar el resultado. */
  async function buscarPlaca(p: string, n: number) {
    setSri({ estado: 'buscando' })
    try {
      const { base, rubros, pagos, registrada, componentes, detallesPago, resumenPagos, impuestoAmbiental } = await consultarSri(p, fetch, 15000, ajustes.servidorPlacas || SERVIDOR_PLACAS)
      const r = interpretarSri(p, base, rubros, pagos, registrada || p, { componentes, detallesPago, resumenPagos, impuestoAmbiental })
      registrarPlaca(p, r) // se recuerda aunque el vendedor ya esté con otro vehículo
      if (n !== ronda.current) return
      setSri({ estado: 'listo', resultado: r })
      completarCon(r, 'sri')
    } catch (e) {
      almacen.guardarPlacaSinRespuesta(p, (e as Error).message)
      setPlacas(almacen.placas())
      if (n === ronda.current) setSri({ estado: 'error', error: (e as Error).message, sinAcceso: e instanceof ErrorPlaca && e.tipo === 'sin-acceso' })
    }
  }

  async function generar() {
    const a = analizar(texto)
    // Mismo vehículo (misma placa y mismo texto): se vuelve a consultar sin perder lo que el vendedor marcó o editó a mano
    if (generado && placaNormal === placaConsultada && texto === textoGenerado.current) {
      for (const [k, o] of Object.entries(origenes) as [keyof Vehiculo, Origen][]) if (o === 'manual') {
        ;(a.vehiculo as unknown as Record<string, unknown>)[k] = v[k]
        a.origenes[k] = 'manual'
      }
    }
    textoGenerado.current = texto
    const n = ++ronda.current
    vActual.current = a.vehiculo
    setV(a.vehiculo); setOrigenes(a.origenes); setGenerado(true); setIdPublicacion(crypto.randomUUID()); setCorrecciones(a.correcciones); setDiferencias([]); origenesActuales.current = a.origenes
    setGoogle({ estado: 'inactivo' }); setPegado({ estado: 'inactivo' }); setSri({ estado: 'inactivo' }); setWiki({ estado: 'inactivo' })
    setPlacaConsultada(placa.trim() ? placaNormal : '')
    setTimeout(() => resultadosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    // Con placa: el SRI primero (puede ser la única fuente de marca y modelo). Si el texto ya trae el modelo, todo en paralelo.
    // Con placa, el SRI va primero: Wikipedia y Google investigan el vehículo que realmente registra esa placa
    if (placa.trim()) await buscarPlaca(placaNormal, n)
    if (n !== ronda.current) return
    const base = vActual.current
    await Promise.all([buscarWikipedia(base, n), buscarGoogle(base, n)])
  }

  /** Guarda la placa en el historial de placas consultadas (la más reciente primero). */
  function registrarPlaca(p: string, r: Investigacion) {
    almacen.guardarPlaca({ placa: p, fecha: new Date().toISOString(), resumen: resumenDePlaca(r), resultado: r })
    setPlacas(almacen.placas())
  }

  /** Sugerencia elegida en el campo de placa: carga lo guardado al instante; si no tuvo respuesta, solo completa la placa. */
  function elegirSugerencia(s: PlacaConocida) {
    if (s.consultada) usarPlaca(s.consultada, texto)
    else if (s.publicacion && s.vehiculo && !texto.trim()) abrir(s.publicacion)
    else setPlaca(s.placa)
  }

  /** Nueva publicación con una placa del historial: usa los datos guardados, sin volver a consultar el SRI. */
  function usarPlaca(p: PlacaConsultada, descripcion = '') {
    if (p.sinRespuesta) { nuevo(); setPlaca(p.placa); setVista('crear'); return }
    const n = ++ronda.current
    const a = descripcion.trim() ? analizar(descripcion) : { vehiculo: VEHICULO_VACIO, origenes: {} as Origenes, correcciones: [] }
    vActual.current = a.vehiculo
    textoGenerado.current = descripcion
    setTexto(descripcion); setPlaca(p.placa); setPlacaConsultada(p.placa); setCorrecciones(a.correcciones); setDiferencias([]); setOrigenes(a.origenes); origenesActuales.current = a.origenes; setV(a.vehiculo)
    setGoogle({ estado: 'inactivo' }); setPegado({ estado: 'inactivo' }); setWiki({ estado: 'inactivo' })
    setSri({ estado: 'listo', resultado: p.resultado })
    completarCon(p.resultado, 'sri')
    setGenerado(true); setIdPublicacion(crypto.randomUUID()); setVista('crear')
    buscarWikipedia(vActual.current, n)
    buscarGoogle(vActual.current, n)
  }

  function pegarSri(t: string): boolean {
    const r = interpretarPegado(placaConsultada, t)
    if (!r) return false
    setSri({ estado: 'listo', resultado: r })
    completarCon(r, 'sri')
    registrarPlaca(placaConsultada, r)
    if (wiki.estado === 'inactivo' && vActual.current.modelo) buscarWikipedia(vActual.current, ronda.current)
    return true
  }

  function pegarGoogle(t: string) {
    const r = investigarTextoPegado(t, vActual.current)
    setPegado({ estado: 'listo', resultado: r })
    completarCon(r, 'google')
  }

  function cambiar<K extends keyof Vehiculo>(campo: K, valor: Vehiculo[K]) {
    setV((cv) => ({ ...cv, [campo]: valor }))
    setOrigenes((co) => ({ ...co, [campo]: 'manual' }))
  }

  function aplicar(h: Hallazgo, opcion: string) {
    const campo = h.campo
    if (!campo) return
    const origen: Origen = /wikipedia\.org/.test(h.fuente.url) ? 'wikipedia' : /sri\.gob\.ec/.test(h.fuente.url) ? 'sri' : 'google'
    const valor = valorParaCampo(campo, opcion)
    if (campo === 'equipamiento') setV((cv) => ({ ...cv, equipamiento: cv.equipamiento.includes(valor) ? cv.equipamiento : [...cv.equipamiento, valor] }))
    else setV((cv) => ({ ...cv, [campo]: valor }))
    setOrigenes((co) => ({ ...co, [campo]: origen }))
  }

  function nuevo() {
    ronda.current++
    setTexto(''); setPlaca(''); setPlacaConsultada(''); setV(VEHICULO_VACIO); setOrigenes({}); setGenerado(false); setCorrecciones([]); setDiferencias([])
    setWiki({ estado: 'inactivo' }); setGoogle({ estado: 'inactivo' }); setSri({ estado: 'inactivo' }); setPegado({ estado: 'inactivo' })
    setIdPublicacion(crypto.randomUUID())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function abrir(p: Publicacion) {
    ronda.current++
    textoGenerado.current = p.texto
    setTexto(p.texto); setV(migrar(p.vehiculo, VEHICULO_VACIO, (c) => p.origenes?.[c] === 'manual')); setOrigenes(p.origenes); setGenerado(true); setIdPublicacion(p.id)
    setWiki({ estado: 'inactivo' }); setGoogle({ estado: 'inactivo' }); setSri({ estado: 'inactivo' }); setPegado({ estado: 'inactivo' })
    setPlaca(p.placa ?? ''); setPlacaConsultada(p.placa ?? ''); setCorrecciones([]); setDiferencias([]); setVista('crear')
  }

  if (!perfil) {
    return (
      <main className="bienvenida">
        <div className="tarjeta">
          <h1>AutoPublicador</h1>
          <p className="lema">Escribe los datos de un carro y obtén títulos y descripciones listos para Facebook Marketplace.</p>
          <p className="ayuda">Primero, tus datos de vendedor. Se guardan solo en este dispositivo y puedes cambiarlos después en Ajustes.</p>
          <FormPerfil textoBoton="Empezar" alGuardar={(p) => { almacen.guardarPerfil(p); setPerfil(p) }} />
        </div>
      </main>
    )
  }

  return (
    <>
      <header className="barra">
        <div className="marca-app">
          <strong>AutoPublicador</strong>
          <small>{perfil.nombre}</small>
        </div>
        <nav>
          {(['crear', 'historial', 'ajustes', 'respuestas'] as Vista[]).map((x) => (
            <button key={x} type="button" className={vista === x ? 'activa' : ''} onClick={() => { setVista(x); if (x === 'respuestas') window.scrollTo(0, 0) }}>
              {x === 'crear' ? 'Crear' : x === 'historial' ? `Historial${historial.length + placas.length ? ` (${historial.length + placas.length})` : ''}` : x === 'ajustes' ? 'Ajustes' : 'Respuestas'}
            </button>
          ))}
        </nav>
      </header>

      <main className="contenido">
        {vista === 'ajustes' && (
          <Ajustes perfil={perfil} ajustes={ajustes}
            guardarPerfil={(p) => { almacen.guardarPerfil(p); setPerfil(p) }}
            guardarAjustes={(a) => { almacen.guardarAjustes(a); setAjustes(a) }}
            borrarTodo={() => { almacen.borrarTodo(); location.reload() }} />
        )}

        {vista === 'respuestas' && (
          <Respuestas lista={generado ? comentarios : []} vehiculo={[v.marca, v.modelo, v.anio].filter(Boolean).join(' ')} irACrear={() => setVista('crear')} />
        )}

        {vista === 'historial' && (
          <Historial lista={historial} placas={placas} abrir={abrir} usarPlaca={usarPlaca}
            perfil={perfil} ajustes={ajustes} refrescar={() => { setHistorial(almacen.historial()); setPlacas(almacen.placas()) }}
            borrar={(id) => { almacen.borrarDeHistorial(id); setHistorial(almacen.historial()) }}
            borrarPlaca={(pl) => { almacen.borrarPlaca(pl); setPlacas(almacen.placas()) }} />
        )}

        {vista === 'crear' && (
          <>
            <section className="tarjeta paso">
              <h2><span className="numero">1</span> Describe el vehículo</h2>
              <p className="ayuda">Lo importante para identificarlo: marca, modelo, año, motor, transmisión, precio y lo que lo hace atractivo.</p>
              <textarea className="entrada" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)}
                placeholder="Ej.: Kia Rio 1.4 2016 manual, 85.000 km, aire, pantalla, matrícula 2025, $11.500 negociable" />
              <CampoPlaca placa={placa} valida={placaOk} conocidas={conocidas} cambiar={setPlaca} elegir={elegirSugerencia} />
              <div className="fila">
                <button type="button" className="boton principal grande" disabled={(!texto.trim() && !placa.trim()) || !placaOk} onClick={generar}>Generar publicación ✨</button>
                {generado && <button type="button" className="boton secundario" onClick={nuevo}>Nuevo vehículo</button>}
              </div>
              {!texto && (
                <div className="ejemplos">
                  <small>Probar con un ejemplo:</small>
                  {EJEMPLOS.map((e) => <button key={e} type="button" className="chip" onClick={() => setTexto(e)}>{e.slice(0, 38)}…</button>)}
                </div>
              )}
            </section>

            {generado && (
              <>
                <section className="tarjeta paso" ref={resultadosRef}>
                  <h2><span className="numero">2</span> Datos del vehículo</h2>
                  {diferencias.length > 0 && (
                    <div className="aviso">
                      🚗 La placa {placaConsultada} está registrada en el SRI con datos distintos a tu texto; se usaron los del SRI:
                      <ul>{diferencias.map((d) => <li key={d.campo}>{NOMBRE_CAMPO[d.campo] ?? d.campo}: «{d.anterior}» → {d.oficial ? `«${d.oficial}»` : 'se quitó (era del modelo de tu texto, no de esta placa)'}</li>)}</ul>
                      <button type="button" className="enlace" onClick={usarTexto}>Usar los datos de mi texto</button>
                    </div>
                  )}
                  {correcciones.map((c) => <p key={c} className="aviso">✏️ {c}. Si no era eso, corrígelo abajo.</p>)}
                  {faltantes.length > 0 && (
                    <p className="aviso">Faltan datos importantes: {faltantes.map((f) => NOMBRE_CAMPO[f]).join(', ')}. Complétalos para una publicación más completa.</p>
                  )}
                  <FormVehiculo v={v} origenes={origenes} faltantes={faltantes} cambiar={cambiar}
                    etiquetas={ajustes.etiquetas} guardarEtiquetas={(e) => { const a = { ...ajustes, etiquetas: e }; almacen.guardarAjustes(a); setAjustes(a) }} />
                </section>

                <section className="tarjeta paso">
                  <h2><span className="numero">3</span> Datos reales del modelo</h2>
                  <PanelInvestigacion v={v} placa={placaConsultada} sri={sri} wikipedia={wiki} google={google} pegado={pegado}
                    hayClaveGoogle={!!ajustes.claveGemini} investigarGoogle={() => buscarGoogle(v, ronda.current)}
                    pegarSri={pegarSri} pegarGoogle={pegarGoogle} aplicar={aplicar} irAAjustes={() => setVista('ajustes')} />
                </section>

                <section className="tarjeta paso">
                  <h2><span className="numero">4</span> Publicación lista</h2>
                  <Resultados v={v} titulos={titulos} descripciones={descripciones}
                    alGuardar={(titulo, descripcion) => {
                      almacen.guardarEnHistorial({ id: idPublicacion, fecha: new Date().toISOString(), texto, vehiculo: v, origenes, titulo, descripcion, placa: placaConsultada || undefined })
                      setHistorial(almacen.historial())
                    }} />
                </section>
              </>
            )}
          </>
        )}
      </main>
      <footer className="pie">Datos guardados solo en este dispositivo · AutoPublicador v{__VERSION__}</footer>
    </>
  )
}
