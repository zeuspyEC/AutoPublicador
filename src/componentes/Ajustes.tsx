import { useState } from 'react'
import { BENEFICIOS_PREDETERMINADOS, UBICACION_PREDETERMINADA, type Ajustes as TAjustes, type Perfil } from '../dominio/tipos'
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
  const [perfilOk, setPerfilOk] = useState(false)
  const set = (a: Partial<TAjustes>) => guardarAjustes({ ...ajustes, ...a })

  return (
    <div className="ajustes">
      <section className="tarjeta">
        <h2>Tu perfil</h2>
        <FormPerfil inicial={perfil} textoBoton={perfilOk ? '✓ Guardado' : 'Guardar perfil'} alGuardar={(p) => { guardarPerfil(p); setPerfilOk(true) }} />
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
        <p className="ayuda">Se incluyen en las descripciones. Marca los que aplican y edita el texto si lo necesitas.</p>
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
          <li>Entra a <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a> con tu cuenta de Google.</li>
          <li>Pulsa «Create API key» y copia la clave.</li>
          <li>Pégala aquí. Se guarda solo en este dispositivo.</li>
        </ol>
        <form className="fila" onSubmit={(e) => { e.preventDefault(); set({ claveGemini: clave.trim() }) }}>
          <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="AIza…" autoComplete="off" />
          <button className="boton secundario" type="submit">{ajustes.claveGemini && ajustes.claveGemini === clave.trim() ? '✓ Guardada' : 'Guardar clave'}</button>
        </form>
        {ajustes.claveGemini && <button type="button" className="enlace" onClick={() => { setClave(''); set({ claveGemini: '' }) }}>Quitar la clave</button>}
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
