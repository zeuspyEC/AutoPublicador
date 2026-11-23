# AutoPublicador

Escribe unos pocos datos de un carro y obtén **títulos y descripciones listos para Facebook Marketplace**,
con datos técnicos reales (con fuente) y tu contacto en un formato que Facebook no oculta.

**👉 Usar ahora:** https://zeuspyec.github.io/AutoPublicador/ (funciona en el celular)

1. La primera vez pide tu nombre y tu celular.
2. Escribe el vehículo en texto libre: `Peugeot 206 XT 1.6 2008 techo pantalla matrícula 2025 $4990 negociable`.
3. La app completa los campos, investiga el modelo (Wikipedia y, si lo activas, Google) y te muestra
   **8 títulos y 6 descripciones**. Corrige lo que quieras, copia y pega en Marketplace.

Toda la explicación del proyecto (requisitos, arquitectura, flujo, decisiones y bitácora) está en
[`CONTEXTO.md`](CONTEXTO.md).

## Desarrollo

```bash
npm install
npm run dev                # http://localhost:5173/AutoPublicador/
npm test                   # pruebas unitarias
npm run test:integracion   # pruebas contra Wikipedia real
npm run build
```

Cada push a `main` ejecuta las pruebas y publica en GitHub Pages (`.github/workflows/desplegar.yml`).
