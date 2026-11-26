import { useRef, useState } from 'react'
import { CAMPOS_RESPUESTA } from '../dominio/plantillas'
import { leerRespaldo } from '../dominio/respaldo'
import type { Ajustes, Tema } from '../dominio/tipos'
import { almacen, copiar } from '../servicios/almacen'

type Set = (a: Partial<Ajustes>) => void

const TEMAS: { id: Tema; nombre: string; emoji: string }[] = [
  { id: 'sistema', nombre: 'Automático', emoji: '📱' },
  { id: 'claro', nombre: 'Claro', emoji: '☀️' },
  { id: 'oscuro', nombre: 'Oscuro', emoji: '🌙' },
]

/** Tema (el del teléfono, claro u oscuro) y tamaño de letra: se aplican al instante y se recuerdan. */
export function Apariencia({ ajustes, set }: { ajustes: Ajustes; set: Set }) {
  return (
    <section className="tarjeta" aria-labelledby="t-apariencia">
      <h2 id="t-apariencia">Apariencia</h2>
      <fieldset className="campo">
        <legend>Tema</legend>
        <div className="segmentado" role="radiogroup">
          {TEMAS.map((t) => (
            <label key={t.id} className={ajustes.tema === t.id ? 'activo' : ''}>
              <input type="radio" name="tema" value={t.id} checked={ajustes.tema === t.id} onChange={() => set({ tema: t.id })} />
              <span className="emoji" aria-hidden="true">{t.emoji}</span>
              <span>{t.nombre}</span>
            </label>
          ))}
        </div>
        <small className="ayuda">«Automático» usa el modo del teléfono (claro de día u oscuro si lo tienes activado).</small>
      </fieldset>
      <fieldset className="campo">
        <legend>Tamaño de letra</legend>
        <div className="segmentado" role="radiogroup">
          {(['normal', 'grande'] as const).map((l) => (
            <label key={l} className={ajustes.letra === l ? 'activo' : ''}>
              <input type="radio" name="letra" value={l} checked={ajustes.letra === l} onChange={() => set({ letra: l })} />
              <span className="emoji" aria-hidden="true" style={{ fontSize: l === 'grande' ? '1.35rem' : '1rem' }}>Aa</span>
              <span>{l === 'normal' ? 'Normal' : 'Grande'}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  )
}

/** Respuestas rápidas propias: aparecen en «Respuestas» con los datos del vehículo actual. */
export function RespuestasPropias({ ajustes, set }: { ajustes: Ajustes; set: Set }) {
  const lista = ajustes.respuestas
  const cambiar = (i: number, x: Partial<Ajustes['respuestas'][number]>) => set({ respuestas: lista.map((r, j) => (j === i ? { ...r, ...x } : r)) })
  const ultimo = useRef<HTMLTextAreaElement | null>(null)
  return (
    <section className="tarjeta" aria-labelledby="t-respuestas">
      <h2 id="t-respuestas">Mis respuestas rápidas</h2>
      <p className="ayuda">
        Escribe tus propias respuestas para los mensajes de Marketplace. Aparecen en «Respuestas» junto a las de la app. Toca un
        campo para insertarlo: se cambia por el dato del vehículo que tengas en pantalla.
      </p>
      <div className="ajustes">
        {lista.map((r, i) => (
          <div key={r.id} className="respuesta-propia">
            <div className="fila" style={{ marginTop: 0 }}>
              <input value={r.nombre} onChange={(e) => cambiar(i, { nombre: e.target.value })} placeholder="Nombre (p. ej., Sí, está disponible)" aria-label="Nombre de la respuesta" />
              <button type="button" className="icono" title="Eliminar respuesta" aria-label="Eliminar respuesta" onClick={() => set({ respuestas: lista.filter((_, j) => j !== i) })}>✕</button>
            </div>
            <textarea ref={i === lista.length - 1 ? ultimo : undefined} id={`resp-${r.id}`} value={r.texto} rows={3} aria-label="Texto de la respuesta"
              onChange={(e) => cambiar(i, { texto: e.target.value })} placeholder="Hola 👋 el {vehiculo} sigue disponible en {precio}. Escríbeme al {telefono}." />
            <div className="campos-respuesta">
              {CAMPOS_RESPUESTA.map((c) => (
                <button key={c} type="button" className="chip" onClick={() => {
                  const t = document.getElementById(`resp-${r.id}`) as HTMLTextAreaElement | null
                  const pos = t?.selectionStart ?? r.texto.length
                  const fin = t?.selectionEnd ?? pos
                  cambiar(i, { texto: r.texto.slice(0, pos) + `{${c}}` + r.texto.slice(fin) })
                }}>{`{${c}}`}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="fila">
        <button type="button" className="boton secundario" onClick={() => {
          set({ respuestas: [...lista, { id: `r${Date.now()}`, nombre: '', texto: '' }] })
          setTimeout(() => ultimo.current?.focus(), 50)
        }}>➕ Nueva respuesta</button>
      </div>
    </section>
  )
}

/** En la app instalada (WebView de Android) no se pueden descargar archivos generados: ahí se copia el respaldo. */
const enApp = () => /; wv\)/.test(navigator.userAgent) || 'generadorApk' in window || '__generadorApk' in window

/** Copia de seguridad: llevar el historial, las placas y los ajustes a otro teléfono, navegador o a la app instalada. */
export function Respaldo({ restaurado }: { restaurado: () => void }) {
  const [pegado, setPegado] = useState('')
  const [mensaje, setMensaje] = useState<{ texto: string; error?: boolean } | null>(null)
  const archivo = useRef<HTMLInputElement>(null)
  const datos = () => JSON.stringify(almacen.respaldo())

  function restaurar(texto: string) {
    const r = leerRespaldo(texto)
    if (!r) { setMensaje({ texto: 'Eso no es un respaldo de AutoPublicador. Copia el respaldo completo, desde la primera llave «{» hasta la última «}».', error: true }); return }
    const u = almacen.restaurar(r)
    restaurado()
    setPegado('')
    setMensaje({ texto: `✓ Respaldo restaurado: ${u.nuevas} ${u.nuevas === 1 ? 'publicación nueva' : 'publicaciones nuevas'} y ${u.nuevasPlacas} ${u.nuevasPlacas === 1 ? 'placa nueva' : 'placas nuevas'}. No se borró nada de lo que ya tenías.` })
  }

  return (
    <section className="tarjeta" aria-labelledby="t-respaldo">
      <h2 id="t-respaldo">Copia de seguridad</h2>
      <p className="ayuda">
        Tus datos se guardan solo en este dispositivo. Con una copia de seguridad los pasas a otro teléfono, a otro navegador o
        del navegador a la app instalada (cada uno guarda sus datos por separado).
      </p>
      <div className="fila">
        <button type="button" className="boton secundario" onClick={async () => {
          setMensaje((await copiar(datos())) ? { texto: '✓ Respaldo copiado. Pégalo donde lo quieras guardar (por ejemplo, un chat contigo mismo en WhatsApp) o en «Restaurar» del otro dispositivo.' } : { texto: 'No se pudo copiar.', error: true })
        }}>📋 Copiar respaldo</button>
        {!enApp() && (
          <button type="button" className="boton secundario" onClick={() => {
            const url = URL.createObjectURL(new Blob([datos()], { type: 'application/json' }))
            const a = document.createElement('a')
            a.href = url; a.download = `autopublicador-respaldo-${new Date().toISOString().slice(0, 10)}.json`
            document.body.appendChild(a); a.click(); a.remove()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
            setMensaje({ texto: '✓ Archivo de respaldo descargado.' })
          }}>⬇️ Descargar archivo</button>
        )}
      </div>
      <h3>Restaurar</h3>
      <p className="ayuda">Se suman las publicaciones y placas que falten; no se borra nada de lo que ya tienes.</p>
      <textarea rows={3} value={pegado} onChange={(e) => setPegado(e.target.value)} placeholder="Pega aquí el respaldo copiado" aria-label="Respaldo pegado" />
      <div className="fila">
        <button type="button" className="boton secundario" disabled={!pegado.trim()} onClick={() => restaurar(pegado)}>Restaurar lo pegado</button>
        <button type="button" className="boton secundario" onClick={() => archivo.current?.click()}>📂 Abrir archivo de respaldo</button>
        <input ref={archivo} type="file" accept=".json,application/json,text/plain" hidden onChange={async (e) => {
          const f = e.target.files?.[0]
          if (f) restaurar(await f.text())
          e.target.value = ''
        }} />
      </div>
      {mensaje && <p className={mensaje.error ? 'aviso error' : 'ayuda'} role="status">{mensaje.texto}</p>}
    </section>
  )
}
