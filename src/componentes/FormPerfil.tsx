import { useState } from 'react'
import { ESTILOS_TELEFONO, formatearTelefono, normalizarTelefono, telefonoValido } from '../dominio/telefono'
import type { Perfil } from '../dominio/tipos'

/** Datos del vendedor: se piden al inicio y se editan en Ajustes. */
export function FormPerfil({ inicial, alGuardar, textoBoton, enVivo = false }: { inicial?: Perfil | null; alGuardar: (p: Perfil) => void; textoBoton: string; enVivo?: boolean }) {
  const [p, fijar] = useState<Perfil>(inicial ?? { nombre: '', telefono: '', estiloTelefono: 'guiones', horario: '' })
  const [tocado, setTocado] = useState(false)
  const limpio = (x: Perfil): Perfil => ({ ...x, nombre: x.nombre.trim(), telefono: normalizarTelefono(x.telefono), horario: x.horario.trim() })
  /** En Ajustes cada cambio válido se aplica al instante en todas las publicaciones. */
  const setP = (x: Perfil) => { fijar(x); if (enVivo) { setTocado(true); if (x.nombre.trim().length >= 3 && telefonoValido(x.telefono)) alGuardar(limpio(x)) } }
  const nombreOk = p.nombre.trim().length >= 3
  const telOk = telefonoValido(p.telefono)

  return (
    <form
      className="form-perfil"
      onSubmit={(e) => {
        e.preventDefault()
        setTocado(true)
        if (nombreOk && telOk) alGuardar(limpio(p))
      }}
    >
      <label className="campo">
        <span>Tu nombre (así aparecerá en las publicaciones)</span>
        <input value={p.nombre} onChange={(e) => setP({ ...p, nombre: e.target.value })} placeholder="Ej.: Juan Pérez" autoComplete="name" />
        {tocado && !nombreOk && <small className="error">Escribe tu nombre.</small>}
      </label>
      <label className="campo">
        <span>Tu número de celular</span>
        <input value={p.telefono} onChange={(e) => setP({ ...p, telefono: e.target.value })} placeholder="09xxxxxxxx" inputMode="tel" autoComplete="tel" />
        {tocado && !telOk && <small className="error">Debe ser un celular de Ecuador: 10 dígitos que empiezan con 09.</small>}
      </label>
      <fieldset className="campo">
        <legend>Cómo se escribe tu número en la publicación</legend>
        <p className="ayuda">Facebook oculta los números escritos seguidos. Elige un formato separado:</p>
        <div className="opciones-estilo">
          {ESTILOS_TELEFONO.map((e) => (
            <label key={e.id} className={`chip ${p.estiloTelefono === e.id ? 'activo' : ''}`}>
              <input type="radio" name="estilo" checked={p.estiloTelefono === e.id} onChange={() => setP({ ...p, estiloTelefono: e.id })} />
              <span>{e.nombre}</span>
              <code>{formatearTelefono(telOk ? p.telefono : '0987654321', e.id)}</code>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="campo">
        <span>Horario de atención (opcional)</span>
        <input value={p.horario} onChange={(e) => setP({ ...p, horario: e.target.value })} placeholder="Ej.: Todos los días de 08:30 a 17:30" />
        <small className="ayuda">Si lo dejas vacío, no se menciona en las publicaciones.</small>
      </label>
      {enVivo ? <p className="ayuda">{nombreOk && telOk ? '✓ Se guarda solo y se aplica al instante en todas tus publicaciones.' : 'Corrige lo marcado para que se aplique.'}</p>
        : <button className="boton principal grande" type="submit">{textoBoton}</button>}
    </form>
  )
}
