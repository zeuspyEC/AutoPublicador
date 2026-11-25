import { useMemo, useState } from 'react'
import { mismaPlaca, sugerir, type PlacaConocida, type Sugerencia } from '../dominio/sugerencias'

interface Props {
  placa: string
  valida: boolean
  conocidas: PlacaConocida[]
  cambiar: (placa: string) => void
  elegir: (s: PlacaConocida) => void
}

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-EC', { dateStyle: 'medium' })

function Resaltada({ s }: { s: Sugerencia }) {
  if (s.desde < 0) return <>{s.placa}</>
  return <>{s.placa.slice(0, s.desde)}<mark>{s.placa.slice(s.desde, s.desde + s.largo)}</mark>{s.placa.slice(s.desde + s.largo)}</>
}

/** Campo de placa que recuerda: sugiere placas del historial con su vehículo a la derecha mientras se digita. */
export function CampoPlaca({ placa, valida, conocidas, cambiar, elegir }: Props) {
  const [abierta, setAbierta] = useState(false)
  const [activa, setActiva] = useState(-1)
  const lista = useMemo(() => sugerir(placa, conocidas), [placa, conocidas])
  const exacta = conocidas.find((c) => mismaPlaca(c.placa, placa))
  const visible = abierta && lista.length > 0

  function tomar(s: PlacaConocida) { setAbierta(false); setActiva(-1); elegir(s) }

  function tecla(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setAbierta(false); setActiva(-1); return }
    if (!lista.length) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setAbierta(true)
      const paso = e.key === 'ArrowDown' ? 1 : -1
      setActiva((a) => (a < 0 ? (paso > 0 ? 0 : lista.length - 1) : (a + paso + lista.length) % lista.length))
    } else if (e.key === 'Enter' && visible) {
      // Sin flechas: Enter solo completa si queda una única placa que empieza igual (nunca cambia una placa nueva)
      const unica = lista.filter((s) => s.tipo === 'empieza')
      const s = lista[activa] ?? (unica.length === 1 ? unica[0] : undefined)
      if (s) { e.preventDefault(); tomar(s) }
    }
  }

  return (
    <div className="campo placa">
      <span id="etq-placa">Placa (opcional): trae del SRI marca, modelo, año, motor, procedencia, matrícula y valores pendientes</span>
      <div className="placa-fila">
        <div className="placa-caja">
          <input value={placa} placeholder="PBA1234" maxLength={9} autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false}
            role="combobox" aria-labelledby="etq-placa" aria-expanded={visible} aria-controls="lista-placas" aria-autocomplete="list"
            aria-activedescendant={visible && activa >= 0 ? `placa-op-${activa}` : undefined}
            onChange={(e) => { cambiar(e.target.value.toUpperCase()); setAbierta(true); setActiva(-1) }}
            onFocus={() => setAbierta(true)} onBlur={() => { setAbierta(false); setActiva(-1) }} onKeyDown={tecla} />
        </div>
        {exacta && (
          <span className="placa-conocida">{exacta.vehiculo ? <>🚗 <strong>{exacta.vehiculo}</strong></> : 'Sin datos: esta placa no tuvo respuesta'}</span>
        )}
      </div>
      {visible && (
        <ul className="sugerencias" id="lista-placas" role="listbox" aria-label="Placas guardadas">
          {lista[0].tipo === 'parecida' && <li className="sugerencias-nota" role="presentation">¿Quisiste decir…?</li>}
          {lista.map((s, i) => (
            <li key={s.placa} id={`placa-op-${i}`} role="option" aria-selected={i === activa} className={i === activa ? 'activa' : ''}
              onMouseDown={(e) => e.preventDefault() /* el campo no pierde el foco antes del clic */} onClick={() => tomar(s)}>
              <span className="chapa"><Resaltada s={s} /></span>
              <span className={s.vehiculo ? 'vehiculo' : 'vehiculo vacio'}>{s.vehiculo || 'Sin datos (no tuvo respuesta)'}</span>
              <small>{fecha(s.fecha)}</small>
            </li>
          ))}
        </ul>
      )}
      {!valida && !visible && <small className="error">Placa no válida: 3 letras y 3 o 4 números (autos) o 2 letras, 3 números y 1 letra (motos).</small>}
      {exacta?.consultada && !visible && <small className="ayuda">Datos guardados el {fecha(exacta.consultada.fecha)}. «Generar publicación» vuelve a consultar el SRI.</small>}
    </div>
  )
}
