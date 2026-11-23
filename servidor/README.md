# Servidor de placas (Cloudflare Worker)

El SRI responde a los navegadores, pero **no permite que otras páginas lean sus datos** (política CORS del
navegador). Este pequeño servidor consulta el SRI y entrega a AutoPublicador **solo datos del vehículo**
(nunca datos del propietario), con permiso únicamente para `https://zeuspyec.github.io` y `localhost`.

```
GET /placa/PBA1234  →  { placa, base: {...}, rubros: [...], consultado }
GET /salud          →  { ok: true }
```

- Valida la placa (autos `ABC1234`/`ABC123`, motos `AB123C`).
- Guarda cada consulta 6 horas para no repetirla.
- Elimina recursivamente cualquier campo con datos personales (propietario, cédula, dirección, teléfono…).
- Errores claros: 400 placa no válida, 404 no registrada, 502 SRI sin respuesta.

## Publicado

`https://autopublicador-placas.erick-costa.workers.dev` (fijado en `src/servicios/placa.ts` → `SERVIDOR_PLACAS`).

Además de base y rubros consulta el historial de pagos (`consultaPagos/obtenerPorPlacaCampvCpn`, solo fecha/tipo/monto) y el plan
excepcional, y prueba las placas antiguas con 0 (`PJM343` → `PJM0343`).

## Publicarlo de nuevo (gratis)

Requiere una cuenta de Cloudflare (gratuita).

```bash
cd servidor
npx wrangler login      # abre el navegador para autorizar con tu cuenta de Cloudflare
npx wrangler deploy     # publica y muestra la dirección: https://autopublicador-placas.TU-CUENTA.workers.dev
```

Luego, en la app: **Ajustes → Servidor de placas**, pega la dirección, **Guardar** y **Probar servidor**.
(O se fija como predeterminada en `src/servicios/placa.ts` → `SERVIDOR_PLACAS` para todos los usuarios.)

## Probar en local

```bash
npx wrangler dev --port 8787
curl http://localhost:8787/salud
```

Las pruebas automáticas (`npm test` en la raíz) cubren CORS, eliminación de datos personales, validación y errores.
