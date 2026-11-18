# Historial de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico.

## [Sin publicar]

### Corregido
- `scripts/datos/compilar-faq.ts` y `scripts/datos/esquema-postgres.mts` fallaban en Windows con saltos de línea CRLF: `npm run dev`/`build` se detenían y cada `npm install` modificaba `prisma/postgres/schema.prisma`. El repositorio ahora fija LF con `.gitattributes`.

### Seguridad
- Next.js y eslint-config-next de 16.4.3 a 16.4.5, que corrige una vulnerabilidad moderada de Next.js (rango 16.2.0–16.4.4). La compilación local ya no se detiene.

### Cambiado
- `engines.node` pasa de `>=20.9` a `24.x`: Vercel compilaba con Node 26 mientras el CI y el desarrollo local usaban Node 24.

### Añadido
- `next build` en el CI.
- CI en GitHub Actions: tipos, eslint, pruebas unitarias, evaluaciones con umbrales y verificación del índice de FAQ.
- `evals/umbrales.json` y `npm run evals:umbrales`: las evaluaciones fallan si una métrica baja.
- Trazabilidad: `docs/trazabilidad.md` (requisitos → código → pruebas), este historial, `CONTRIBUTING.md` y plantillas de issues y PR.

## [2.0.0] — 2026-10-30

Reescritura completa en Next.js 16 + TypeScript. Desplegada en producción en Vercel desde el commit `a85ada6`.

| Fase | Commit | Contenido |
|---|---|---|
| 1 | `2ad119c` | Migración a Next.js, máquina de estados, validación con Zod, motor guiado, DIVIPOLA y CIIU completos, vista previa del formulario, pruebas unitarias |
| 2 | `493376a` | Integración con Claude (Vercel AI SDK) con herramientas; la IA propone y el código decide |
| 3 | `4730e37` | Accesibilidad verificada con axe (WCAG 2.1 AA), voz, texto grande y alto contraste |
| 4 | `96107c2` | Analítica sin datos personales, panel /admin, bandeja humano en el bucle y sinónimos CIIU |
| 5 | `7d77a01`, `301ae8a` | Pruebas E2E, evaluaciones, modo demo, página Cómo funciona, documentación y límites de uso |
| Ajustes | `c275c92`, `999c16e`, `e098ca2`, `36883a7`, `a85ada6` | `.env.example` completo, modo solo chat, modo oscuro de alto contraste, selector Chat \| Formulario |

## [1.0.0] — 2026-09-23

Primera versión (`4025390`): chat en JavaScript sin framework sobre una función serverless de Vercel, Claude por API directa con las herramientas `guardar_datos` y `finalizar_registro`, modo guiado sin IA, validación en el servidor y 9 pruebas con `node --test`.

[Sin publicar]: https://github.com/JEGH18/ChatBit/compare/v2.0.0...main
[2.0.0]: https://github.com/JEGH18/ChatBit/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/JEGH18/ChatBit/releases/tag/v1.0.0
