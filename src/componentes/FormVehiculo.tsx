import { useState } from 'react'
import type { Origen, Origenes, Vehiculo } from '../dominio/tipos'

const ETIQUETA_ORIGEN: Record<Origen, string> = { texto: 'de tu texto', sri: 'SRI', wikipedia: 'Wikipedia', google: 'Google', manual: 'editado' }

interface Props {
  v: Vehiculo
  origenes: Origenes
  faltantes: (keyof Vehiculo)[]
  cambiar: <K extends keyof Vehiculo>(campo: K, valor: Vehiculo[K]) => void
}

/** Formulario editable con todos los datos del vehículo; cada campo muestra de dónde salió. */
export function FormVehiculo({ v, origenes, faltantes, cambiar }: Props) {
  const [nuevoEquipo, setNuevoEquipo] = useState('')

  const marca = (k: keyof Vehiculo) => {
    const o = origenes[k]
    return o ? <em className={`origen ${o}`}>{ETIQUETA_ORIGEN[o]}</em> : faltantes.includes(k) ? <em className="origen falta">falta</em> : null
  }
  const texto = (k: keyof Vehiculo, etiqueta: string, props: { placeholder?: string; inputMode?: 'numeric' | 'decimal'; lista?: string } = {}) => (
    <label className={`campo ${faltantes.includes(k) && !v[k] ? 'faltante' : ''}`}>
      <span>{etiqueta} {marca(k)}</span>
      <input value={v[k] as string} placeholder={props.placeholder} inputMode={props.inputMode} list={props.lista}
        onChange={(e) => cambiar(k, (props.inputMode === 'numeric' ? e.target.value.replace(/\D/g, '') : props.inputMode === 'decimal' ? e.target.value.replace(',', '.').replace(/[^\d.]/g, '') : e.target.value) as never)} />
    </label>
  )
  const casilla = (k: keyof Vehiculo, etiqueta: string) => (
    <label className="casilla">
      <input type="checkbox" checked={v[k] as boolean} onChange={(e) => cambiar(k, e.target.checked as never)} />
      <span>{etiqueta}</span>
    </label>
  )

  return (
    <div className="form-vehiculo">
      <div className="rejilla">
        {texto('marca', 'Marca')}
        {texto('modelo', 'Modelo')}
        {texto('version', 'Versión', { placeholder: 'XT, GLS, LTZ…' })}
        {texto('anio', 'Año', { inputMode: 'numeric', placeholder: '2015' })}
        {texto('motor', 'Motor', { placeholder: '1.6 o 150 cc' })}
        <label className={`campo ${faltantes.includes('transmision') && !v.transmision ? 'faltante' : ''}`}>
          <span>Transmisión {marca('transmision')}</span>
          <select value={v.transmision} onChange={(e) => cambiar('transmision', e.target.value as Vehiculo['transmision'])}>
            <option value="">—</option><option>Manual</option><option>Automática</option>
          </select>
        </label>
        {texto('combustible', 'Combustible', { lista: 'lista-combustible' })}
        {texto('kilometraje', 'Kilometraje', { inputMode: 'numeric', placeholder: '120000' })}
        {texto('traccion', 'Tracción', { placeholder: 'Delantera, 4x4…' })}
        {texto('carroceria', 'Carrocería', { placeholder: 'Sedán, SUV…' })}
        {texto('puertas', 'Puertas', { inputMode: 'numeric' })}
        {texto('color', 'Color')}
        {texto('procedencia', 'Procedencia', { placeholder: 'Ecuador, Argentina…' })}
        {texto('matricula', 'Matrícula', { placeholder: 'Al día 2025' })}
        {texto('precio', 'Precio ($)', { inputMode: 'numeric' })}
        {texto('precioAnterior', 'Precio anterior ($)', { inputMode: 'numeric', placeholder: 'opcional' })}
        {texto('deuda', 'Valores pendientes SRI ($)', { inputMode: 'decimal', placeholder: '0.00' })}
      </div>
      <datalist id="lista-combustible"><option>Gasolina</option><option>Diésel</option><option>Híbrido</option><option>Eléctrico</option></datalist>

      <div className="campo">
        <span>Equipamiento {marca('equipamiento')}</span>
        <div className="chips">
          {v.equipamiento.map((e) => (
            <button key={e} type="button" className="chip activo" title="Quitar" onClick={() => cambiar('equipamiento', v.equipamiento.filter((x) => x !== e))}>
              {e} ✕
            </button>
          ))}
          <form className="agregar" onSubmit={(ev) => {
            ev.preventDefault()
            const n = nuevoEquipo.trim()
            if (n && !v.equipamiento.includes(n)) cambiar('equipamiento', [...v.equipamiento, n])
            setNuevoEquipo('')
          }}>
            <input value={nuevoEquipo} onChange={(e) => setNuevoEquipo(e.target.value)} placeholder="Agregar…" />
          </form>
        </div>
      </div>

      <label className="campo">
        <span>Estado / detalles {marca('notas')}</span>
        <input value={v.notas} onChange={(e) => cambiar('notas', e.target.value)} placeholder="Único dueño, excelente estado…" />
      </label>

      <div className="casillas">
        {casilla('ceroMultas', 'Cero multas')}
        {casilla('aTodaPrueba', 'A toda prueba')}
        {casilla('fullEquipo', 'Full equipo')}
        {casilla('negociable', 'Negociable')}
        {casilla('recibeCambio', 'Recibe cambio')}
        {+(v.deuda || 0) > 0 && casilla('mostrarDeuda', `Mencionar la deuda ($${(+v.deuda).toFixed(2).replace('.', ',')}) junto al precio`)}
      </div>
      {+(v.deuda || 0) > 0 && (
        <p className="ayuda">
          {v.mostrarDeuda
            ? 'La deuda aparece en la línea del precio como motivo de «negociable».'
            : 'Tú decides: la deuda no se menciona en la publicación (tampoco se publica «matrícula al día»).'}
        </p>
      )}
    </div>
  )
}
