import { useEffect, useMemo, useRef, useState } from 'react'
import { analizar } from './dominio/analizador'
import { descripciones as generarDescripciones, titulos as generarTitulos } from './dominio/plantillas'
import { VEHICULO_VACIO, type Ajustes as TAjustes, type Origen, type Origenes, type Perfil, type Vehiculo } from './dominio/tipos'
import { almacen, type Publicacion } from './servicios/almacen'
import { investigarGoogle, investigarWikipedia, type Hallazgo, type Investigacion } from './servicios/investigador'
import { Ajustes } from './componentes/Ajustes'
import { FormPerfil } from './componentes/FormPerfil'
import { FormVehiculo } from './componentes/FormVehiculo'
import { Historial } from './componentes/Historial'
import { PanelInvestigacion, valorParaCampo, type EstadoInvestigacion } from './componentes/PanelInvestigacion'
import { Resultados } from './componentes/Resultados'

type Vista = 'crear' | 'historial' | 'ajustes'

const IMPORTANTES: (keyof Vehiculo)[] = ['marca', 'modelo', 'anio', 'motor', 'transmision', 'precio']
const NOMBRE_CAMPO: Partial<Record<keyof Vehiculo, string>> = { marca: 'marca', modelo: 'modelo', anio: 'año', motor: 'motor', transmision: 'transmisión', precio: 'precio' }

const EJEMPLOS = [
  'Peugeot 206 XT 1.6 2008 procedencia argentina, techo corredizo, pantalla android, cámara de retro, aros. Matrícula 2025 cero multas. $4990 antes $5300, negociable, recibo carro o moto, a toda prueba',
  'Chevrolet Vitara clásico 3P DLX 1997 T/M A/A ecuatoriano, matrícula al día 2025, cero multas, 4990',
  'Toyota Hilux 2.5 2014 diésel 4x4 cabina doble 145.000 km, único dueño, $28500 negociable',
]

/**
 * Autocompletado: un dato investigado se aplica solo si el campo está vacío y hay una única opción
 * (p. ej., la tracción de un modelo que solo existió con tracción delantera). Si hay varias, decide el vendedor.
 */
function autocompletar(v: Vehiculo, r: Investigacion, origen: Origen): [Vehiculo, Origenes] {
  const nv = { ...v }
  const no: Origenes = {}
  for (const h of r.hallazgos) {
    if (!h.campo || h.campo === 'equipamiento' || !h.opciones || h.opciones.length !== 1 || nv[h.campo]) continue
    ;(nv as Record<string, unknown>)[h.campo] = valorParaCampo(h.campo, h.opciones[0])
    no[h.campo] = origen
  }
  return [nv, no]
}

export default function App() {
  const [perfil, setPerfil] = useState<Perfil | null>(() => almacen.perfil())
  const [ajustes, setAjustes] = useState<TAjustes>(() => almacen.ajustes())
  const [vista, setVista] = useState<Vista>('crear')
  const borrador = useMemo(() => almacen.borrador(), [])
  const [texto, setTexto] = useState(borrador?.texto ?? '')
  const [v, setV] = useState<Vehiculo>(borrador?.vehiculo ?? VEHICULO_VACIO)
  const [origenes, setOrigenes] = useState<Origenes>(borrador?.origenes ?? {})
  const [generado, setGenerado] = useState(!!borrador?.vehiculo?.modelo)
  const [wiki, setWiki] = useState<EstadoInvestigacion>({ estado: 'inactivo' })
  const [google, setGoogle] = useState<EstadoInvestigacion>({ estado: 'inactivo' })
  const [historial, setHistorial] = useState<Publicacion[]>(() => almacen.historial())
  const [idPublicacion, setIdPublicacion] = useState<string>(() => crypto.randomUUID())
  const ronda = useRef(0) // descarta respuestas de investigaciones anteriores
  const vActual = useRef(v)
  vActual.current = v
  const resultadosRef = useRef<HTMLElement>(null)

  useEffect(() => { almacen.guardarBorrador({ texto, vehiculo: v, origenes }) }, [texto, v, origenes])

  const faltantes = IMPORTANTES.filter((k) => !v[k])
  const ctx = useMemo(() => (perfil ? { v, perfil, beneficios: ajustes.beneficios, ubicacion: ajustes.ubicacion } : null), [v, perfil, ajustes])
  const titulos = useMemo(() => (ctx ? generarTitulos(ctx) : []), [ctx])
  const descripciones = useMemo(() => (ctx ? generarDescripciones(ctx) : []), [ctx])

  /** Completa los campos vacíos con lo investigado (sobre el estado actual: el vendedor pudo editar mientras tanto). */
  function completarCon(r: Investigacion, origen: Origen) {
    const [nv, no] = autocompletar(vActual.current, r, origen)
    vActual.current = nv
    setV(nv)
    setOrigenes((co) => ({ ...co, ...no }))
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

  async function generar() {
    const a = analizar(texto)
    const n = ++ronda.current
    vActual.current = a.vehiculo
    setV(a.vehiculo); setOrigenes(a.origenes); setGenerado(true); setIdPublicacion(crypto.randomUUID())
    setGoogle({ estado: 'inactivo' })
    setTimeout(() => resultadosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    if (!a.vehiculo.modelo) { setWiki({ estado: 'inactivo' }); return }
    setWiki({ estado: 'buscando' })
    const enGoogle = buscarGoogle(a.vehiculo, n) // Google y Wikipedia se consultan a la vez
    try {
      const r = await investigarWikipedia(a.vehiculo)
      if (n === ronda.current) { setWiki({ estado: 'listo', resultado: r }); completarCon(r, 'wikipedia') }
    } catch (e) {
      if (n === ronda.current) setWiki({ estado: 'error', error: 'No se pudo consultar Wikipedia. Revisa tu conexión a internet.' })
      console.error(e)
    }
    await enGoogle
  }

  function cambiar<K extends keyof Vehiculo>(campo: K, valor: Vehiculo[K]) {
    setV((cv) => ({ ...cv, [campo]: valor }))
    setOrigenes((co) => ({ ...co, [campo]: 'manual' }))
  }

  function aplicar(h: Hallazgo, opcion: string) {
    const campo = h.campo
    if (!campo) return
    const origen: Origen = /wikipedia\.org/.test(h.fuente.url) ? 'wikipedia' : 'google'
    const valor = valorParaCampo(campo, opcion)
    if (campo === 'equipamiento') setV((cv) => ({ ...cv, equipamiento: cv.equipamiento.includes(valor) ? cv.equipamiento : [...cv.equipamiento, valor] }))
    else setV((cv) => ({ ...cv, [campo]: valor }))
    setOrigenes((co) => ({ ...co, [campo]: origen }))
  }

  function nuevo() {
    ronda.current++
    setTexto(''); setV(VEHICULO_VACIO); setOrigenes({}); setGenerado(false)
    setWiki({ estado: 'inactivo' }); setGoogle({ estado: 'inactivo' }); setIdPublicacion(crypto.randomUUID())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function abrir(p: Publicacion) {
    ronda.current++
    setTexto(p.texto); setV(p.vehiculo); setOrigenes(p.origenes); setGenerado(true); setIdPublicacion(p.id)
    setWiki({ estado: 'inactivo' }); setGoogle({ estado: 'inactivo' }); setVista('crear')
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
          {(['crear', 'historial', 'ajustes'] as Vista[]).map((x) => (
            <button key={x} type="button" className={vista === x ? 'activa' : ''} onClick={() => setVista(x)}>
              {x === 'crear' ? 'Crear' : x === 'historial' ? `Historial${historial.length ? ` (${historial.length})` : ''}` : 'Ajustes'}
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

        {vista === 'historial' && (
          <Historial lista={historial} abrir={abrir} borrar={(id) => { almacen.borrarDeHistorial(id); setHistorial(almacen.historial()) }} />
        )}

        {vista === 'crear' && (
          <>
            <section className="tarjeta paso">
              <h2><span className="numero">1</span> Describe el vehículo</h2>
              <p className="ayuda">Lo importante para identificarlo: marca, modelo, año, motor, transmisión, precio y lo que lo hace atractivo.</p>
              <textarea className="entrada" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)}
                placeholder="Ej.: Kia Rio 1.4 2016 manual, 85.000 km, aire, pantalla, matrícula 2025, $11.500 negociable" />
              <div className="fila">
                <button type="button" className="boton principal grande" disabled={!texto.trim()} onClick={generar}>Generar publicación ✨</button>
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
                  {faltantes.length > 0 && (
                    <p className="aviso">Faltan datos importantes: {faltantes.map((f) => NOMBRE_CAMPO[f]).join(', ')}. Complétalos para una publicación más completa.</p>
                  )}
                  <FormVehiculo v={v} origenes={origenes} faltantes={faltantes} cambiar={cambiar} />
                </section>

                <section className="tarjeta paso">
                  <h2><span className="numero">3</span> Datos reales del modelo</h2>
                  <PanelInvestigacion v={v} wikipedia={wiki} google={google} hayClaveGoogle={!!ajustes.claveGemini}
                    investigarGoogle={() => buscarGoogle(v, ronda.current)} aplicar={aplicar} irAAjustes={() => setVista('ajustes')} />
                </section>

                <section className="tarjeta paso">
                  <h2><span className="numero">4</span> Publicación lista</h2>
                  <Resultados v={v} titulos={titulos} descripciones={descripciones}
                    alGuardar={(titulo, descripcion) => {
                      almacen.guardarEnHistorial({ id: idPublicacion, fecha: new Date().toISOString(), texto, vehiculo: v, origenes, titulo, descripcion })
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
