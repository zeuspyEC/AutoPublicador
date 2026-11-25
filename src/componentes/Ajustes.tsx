import { useState } from 'react'
import { BENEFICIOS_PREDETERMINADOS, UBICACION_PREDETERMINADA, type Ajustes as TAjustes, type Perfil } from '../dominio/tipos'
import { diagnosticar, olvidarModelos, type Diagnostico } from '../servicios/google'
import { SERVIDOR_PLACAS } from '../servicios/placa'
import { FormPerfil } from './FormPerfil'

interface Props {
  perfil: Perfil
  ajustes: TAjustes
  guardarPerfil: (p: Perfil) => void
  guardarAjustes: (a: TAjustes) => void
  borrarTodo: () => void
}

export function Ajustes({ perfil, ajustes, guardarPerfil, guardarAjustes, borrarTodo }: Props) {
  const [nuevo, setNuevo] = useState('')
  const [clave, setClave] = useState(ajustes.claveGemini)
  const [probando, setProbando] = useState(false)
  const [servidor, setServidor] = useState(ajustes.servidorPlacas)
  const [servidorOk, setServidorOk] = useState('')
  const [diag, setDiag] = useState<Diagnostico | null>(null)
  const set = (a: Partial<TAjustes>) => guardarAjustes({ ...ajustes, ...a })

  return (
    <div className="ajustes">
      <section className="tarjeta">
        <h2>Tu perfil</h2>
        <FormPerfil inicial={perfil} textoBoton="Guardar perfil" enVivo alGuardar={guardarPerfil} />
      </section>

      <section className="tarjeta">
        <h2>Ubicación</h2>
        <label className="campo">
          <span>Ubicación general (sin dirección exacta, para que te escriban)</span>
          <input value={ajustes.ubicacion} onChange={(e) => set({ ubicacion: e.target.value })} />
        </label>
        {ajustes.ubicacion !== UBICACION_PREDETERMINADA && (
          <button type="button" className="enlace" onClick={() => set({ ubicacion: UBICACION_PREDETERMINADA })}>Volver a «{UBICACION_PREDETERMINADA}»</button>
        )}
      </section>

      <section className="tarjeta">
        <h2>Beneficios que se ofrecen</h2>
        <p className="ayuda">Se incluyen en las descripciones. Marca los que aplican y edita el texto si lo necesitas. Las formas de pago son fijas en todas las plantillas: solo contado (efectivo o tarjeta), auto o moto como parte de pago y sin financiamiento.</p>
        <ul className="beneficios">
          {ajustes.beneficios.map((b, i) => (
            <li key={b.id}>
              <input type="checkbox" checked={b.activo} aria-label="Incluir"
                onChange={(e) => set({ beneficios: ajustes.beneficios.map((x, j) => (j === i ? { ...x, activo: e.target.checked } : x)) })} />
              <input value={b.texto} onChange={(e) => set({ beneficios: ajustes.beneficios.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })} />
              <button type="button" className="icono" title="Eliminar" onClick={() => set({ beneficios: ajustes.beneficios.filter((_, j) => j !== i) })}>✕</button>
            </li>
          ))}
        </ul>
        <form className="fila" onSubmit={(e) => {
          e.preventDefault()
          if (nuevo.trim()) set({ beneficios: [...ajustes.beneficios, { id: `b${Date.now()}`, texto: nuevo.trim(), activo: true }] })
          setNuevo('')
        }}>
          <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Nuevo beneficio…" />
          <button className="boton secundario" type="submit">Agregar</button>
        </form>
        <button type="button" className="enlace" onClick={() => set({ beneficios: BENEFICIOS_PREDETERMINADOS })}>Restaurar los beneficios originales</button>
      </section>

      <section className="tarjeta">
        <h2>Búsqueda en Google (opcional)</h2>
        <p className="ayuda">
          Wikipedia da los datos generales del modelo. Para buscar en Google los datos exactos de la versión y el año
          (con los enlaces consultados), pega una clave gratuita de Google AI Studio:
        </p>
        <ol className="ayuda pasos">
          <li>Entra a <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer">aistudio.google.com/api-keys</a> con tu cuenta de Google.</li>
          <li>Pulsa «Crear clave de API», elige o crea el proyecto y copia la clave.</li>
          <li>Pégala aquí. Se guarda solo en este dispositivo.</li>
        </ol>
        <form className="fila" onSubmit={(e) => { e.preventDefault(); olvidarModelos(); setDiag(null); set({ claveGemini: clave.trim() }) }}>
          <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="AIza…" autoComplete="off" />
          <button className="boton secundario" type="submit">{ajustes.claveGemini && ajustes.claveGemini === clave.trim() ? '✓ Guardada' : 'Guardar clave'}</button>
        </form>
        {ajustes.claveGemini && (
          <>
            <div className="fila">
              <button type="button" className="boton secundario" disabled={probando} onClick={async () => {
                setProbando(true); setDiag(null)
                olvidarModelos()
                setDiag(await diagnosticar(ajustes.claveGemini))
                setProbando(false)
              }}>{probando ? 'Probando con Google…' : '🧪 Probar clave ahora'}</button>
              <button type="button" className="enlace" onClick={() => { setClave(''); setDiag(null); set({ claveGemini: '' }) }}>Quitar la clave</button>
            </div>
            {diag && (
              <div className="tarjeta-interna">
                <p><strong>{diag.conclusion}</strong></p>
                {diag.modelos.length > 0 && <p className="ayuda">Modelos que permite tu clave: {diag.modelos.slice(0, 6).join(', ')}{diag.modelos.length > 6 ? '…' : ''}</p>}
                <ul className="diagnostico">
                  {diag.pruebas.map((p, i) => (
                    <li key={i}>{p.ok ? '✅' : '❌'} {p.modelo} {p.busqueda ? 'con búsqueda de Google' : 'sin búsqueda'}: {p.motivo}</li>
                  ))}
                </ul>
                <p className="ayuda">
                  Revisa en Google AI Studio: <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer">claves</a> ·{' '}
                  <a href="https://aistudio.google.com/usage" target="_blank" rel="noreferrer">uso y límites</a> ·{' '}
                  <a href="https://aistudio.google.com/billing" target="_blank" rel="noreferrer">facturación (para habilitar la búsqueda)</a>
                </p>
              </div>
            )}
          </>
        )}
      </section>

      <section className="tarjeta">
        <h2>Servidor de placas</h2>
        <p className="ayuda">
          El SRI no deja que otras páginas lean sus datos directamente desde el navegador. El servidor de placas (carpeta
          {' '}<code>servidor</code> del repositorio) los consulta y se los entrega a la app. Si no hay servidor, la app intenta
          directo y, si no puede, ofrece la consulta manual.
        </p>
        <form className="fila" onSubmit={(e) => { e.preventDefault(); setServidorOk(''); set({ servidorPlacas: servidor.trim().replace(/\/+$/, '') }) }}>
          <input value={servidor} onChange={(e) => setServidor(e.target.value)} placeholder={SERVIDOR_PLACAS || 'https://autopublicador-placas.TU-CUENTA.workers.dev'} inputMode="url" autoComplete="off" />
          <button className="boton secundario" type="submit">Guardar</button>
        </form>
        <div className="fila">
          <button type="button" className="boton secundario" onClick={async () => {
            const url = (ajustes.servidorPlacas || SERVIDOR_PLACAS).replace(/\/+$/, '')
            if (!url) { setServidorOk('No hay servidor configurado.'); return }
            setServidorOk('Probando…')
            try {
              const r = await fetch(url + '/salud')
              setServidorOk(r.ok ? '✅ El servidor responde.' : `❌ El servidor respondió ${r.status}.`)
            } catch { setServidorOk('❌ No se pudo conectar con el servidor (revisa la dirección).') }
          }}>Probar servidor</button>
          {servidorOk && <span>{servidorOk}</span>}
        </div>
      </section>

      <section className="tarjeta peligro">
        <h2>Datos de este dispositivo</h2>
        <p className="ayuda">Todo (perfil, ajustes e historial) se guarda solo en este navegador.</p>
        <button type="button" className="boton peligro" onClick={() => { if (confirm('¿Borrar perfil, ajustes e historial de este dispositivo?')) borrarTodo() }}>
          Borrar todos mis datos
        </button>
      </section>
    </div>
  )
}
