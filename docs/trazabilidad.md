# Trazabilidad: requisitos → código → pruebas

Este documento conecta cada requisito del Asistente Neo con el código que lo implementa y con la evidencia que demuestra que funciona. Complementa la matriz de riesgos de [ia-responsable.md](ia-responsable.md) (R1–R14), que hace lo mismo para los riesgos.

**Cómo leerla:** `archivo › símbolo` señala el código; `prueba › «nombre»` señala un caso de prueba concreto (Vitest en `tests/unit/`, Playwright en `e2e/`). **CI** indica que la evidencia se ejecuta automáticamente en cada PR (ver [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)); **local** indica que se ejecuta a mano antes de fusionar (E2E y evaluaciones con Claude).

## 1. Versiones

| Versión | Commit / tag | Qué es | Dónde está |
|---|---|---|---|
| v1.0.0 | `4025390` · tag `v1.0.0` | Primera versión: JavaScript sin framework, Claude por API directa, modo guiado, 9 pruebas | Historial de `main` |
| v2.0.0 | `a85ada6` · tag `v2.0.0` | Reescritura en Next.js + TypeScript (fases 1–5). Desplegada en producción en Vercel (`asistente-neo.vercel.app`) | Historial de `main` |
| Sin publicar | `main` | Correcciones de saltos de línea, CI y documentación de trazabilidad | `main` |

El detalle de cada versión está en [CHANGELOG.md](../CHANGELOG.md).

## 2. Requisitos funcionales

| ID | Requisito | Implementación | Evidencia | Ejecución |
|---|---|---|---|---|
| RF-01 | La persona responde en lenguaje natural y el asistente llena varios campos con un solo mensaje | `lib/conversacion/extractor.ts › extraerCampos`; `lib/ia/herramientas.ts › crearHerramientas` (actualizarCampo) | `motor.test › «extrae casi todo el formulario en un solo turno»`; `ia.test › «extrae varios campos con actualizarCampo y el código los valida»`; evaluaciones de extracción (F1 93 % en el conjunto de prueba); E2E `personas.spec › «Andrés…»` | CI + local |
| RF-02 | Cada campo se valida según las reglas del formulario (nombres, documento por tipo, celular, correo, DIVIPOLA, año, ventas) | `lib/form/validadores.ts › interpretarCampo, esquemaValores, esquemaRegistroCompleto`; `lib/form/divipola.ts` | `validadores.test` (12 casos); `ia.test › «rechaza datos inválidos que proponga la IA (el código decide)»` | CI |
| RF-03 | El número de documento se confirma leyéndolo en grupos | `lib/conversacion/motor.ts › Turnero`; `validadores.ts › reglaDocumento` | `motor.test › «lee el documento en grupos para confirmarlo»`; `validadores.test › «confirmación de documento: debe coincidir»`; E2E Domiciano | CI + local |
| RF-04 | Si algo es ambiguo, el asistente pregunta en vez de adivinar | `motor.ts`; `divipola.ts › buscarMunicipios` | `motor.test › «pregunta si nombre y apellido vinieron juntos (no adivina)»`; `validadores.test › «departamento y ciudad con DIVIPOLA»`; precisión 100 % en las evaluaciones | CI |
| RF-05 | Actividad económica: 3 opciones CIIU explicadas en lenguaje sencillo y la persona elige | `lib/form/ciiu.ts › sugerirCiiu, candidatosCiiu`; `lib/ia/ciiu.ts › clasificarCiiu` | `ia.test › «sugerirCIIU muestra 3 opciones para que la persona elija»`; `motor.test › «propone CIIU y estima ventas con el cálculo visible»`; evaluaciones CIIU (top-3 100 %); E2E Marcela | CI + local |
| RF-06 | Ventas: entiende montos coloquiales y periodos, estima con pasos visibles y pide confirmación | `lib/form/dinero.ts › interpretarMonto, detectarPeriodo, anualizar, estimarVentasAnuales` | `dinero.test` (27 casos); `motor.test › «convierte ventas mensuales a anuales con confirmación»`; `ia.test › «estimarVentas calcula en código y pide confirmación»`; E2E Marcela | CI + local |
| RF-07 | Los consentimientos solo se aceptan con una acción explícita de la persona; sin ellos no se finaliza | `lib/form/campos.ts › CAMPOS_SOLO_ACCION_EXPLICITA`; `lib/conversacion/acciones.ts` | `validadores.test › «consentimientos: solo aceptación explícita»`; `motor.test › «no finaliza sin consentimientos»`; `ia.test › «la IA no puede aceptar la política ni confirmar el documento»` | CI |
| RF-08 | Resumen final editable, radicado y JSON con la estructura del formulario | `lib/form/presentacion.ts › filasResumen`; `lib/conversacion/estado.ts › construirRegistro, generarRadicado`; `components/asistente/DialogoRevision.tsx` | `motor.test › «completa el registro de punta a punta»`; E2E de las 3 personas (comparan el JSON descargado) | CI + local |
| RF-09 | Vista previa del formulario en vivo, editable tocando cada campo | `components/asistente/VistaFormulario.tsx`, `EditorCampo.tsx` | E2E `salvaguardas.spec › «vista Formulario: llenarlo uno mismo a pantalla completa, revisar y finalizar»` | local |
| RF-10 | Selector «Chat \| Formulario» (pestañas en celular) y modo «Solo chat» | `components/asistente/Asistente.tsx`, `usePreferencias.ts` | E2E `«la sesión se puede retomar al recargar y se puede cambiar entre Chat y Formulario»`, `«modo solo chat…»`, `celular.spec` | local |
| RF-11 | Accesibilidad: voz para hablar y escuchar, texto grande, modo oscuro de alto contraste, botones de 44 px | `components/asistente/voz.ts › useReconocimientoVoz, useLecturaVoz`; `usePreferencias.ts` | E2E Domiciano (voz simulada y texto grande); `celular.spec › «…objetivos táctiles grandes»`; ver RNF-07 | local |
| RF-12 | Salida a un asesor humano en cualquier momento | `motor.ts`; variables `NEXT_PUBLIC_ASESOR_*` | `motor.test › «escala a un asesor en cualquier momento»` | CI |
| RF-13 | Si la IA o la red fallan, el asistente sigue funcionando (modo guiado en el servidor y en el navegador) | `lib/ia/turno.ts › turnoConIA`; `motor.ts › resolverSinIA`; `components/asistente/useAsistente.ts` | `ia.test › «si la IA falla, el turno se resuelve con el motor guiado»`; E2E `«si se cae la red, el asistente sigue funcionando en el navegador»` | CI + local |
| RF-14 | La sesión se retoma al recargar; los datos personales viven solo en el navegador (24 h) | `useAsistente.ts`; `estado.ts › sanitizarEstado` | E2E `«la sesión se puede retomar al recargar…»` | local |
| RF-15 | Preguntas frecuentes con respuestas aprobadas; las desconocidas van a una bandeja que revisa un humano | `lib/conocimiento/faq.ts › buscarFaq, parecePregunta`; `data/faq/*.md`; `app/admin/acciones.ts` | `motor.test › «envía preguntas desconocidas a la bandeja»`, `««¿si tengo dos nombres?» explica el campo…»`; `analitica.test › «las respuestas aprobadas por un humano entran a la base de conocimiento»`; E2E panel /admin | CI + local |
| RF-16 | Panel /admin: embudo, fricción, desempeño por segmento, CSAT y aprendizaje CIIU | `lib/analitica/metricas.ts › calcularMetricas`; `app/admin/page.tsx`; `lib/admin/sesion.ts` | `analitica.test › «calcula el embudo, la fricción y la completitud por segmento…»`; E2E panel /admin | CI + local |
| RF-17 | Sinónimos CIIU confirmados mejoran las sugerencias siguientes (sin datos sintéticos) | `motor.ts`; `lib/datos/*` | `motor.test › «registra el aprendizaje del CIIU elegido»`; `analitica.test › «los sinónimos de datos sintéticos no alimentan el aprendizaje»` | CI |
| RF-18 | Encuesta de satisfacción de una pregunta al final | `app/api/encuesta/route.ts` | E2E de las 3 personas (responden la encuesta) | local |
| RF-19 | Modo demo sin conexión que reproduce las 3 personas | `components/demo/*`; `data/demo/*.json`; `scripts/grabar-demo.mts` | Solo auditoría axe de `/demo` (ver huecos) | local |
| RF-20 | Página de transparencia «Cómo funciona» | `app/como-funciona/page.tsx` | Auditoría axe de `/como-funciona` | local |

## 3. Requisitos no funcionales

| ID | Requisito | Implementación | Evidencia | Riesgo relacionado |
|---|---|---|---|---|
| RNF-01 | La IA propone, el código decide (validación y transiciones deterministas) | `validadores.ts`, `estado.ts`, `herramientas.ts` | `ia.test › «rechaza datos inválidos…»`, `«acciones y consentimientos nunca pasan por la IA»` | R1 |
| RNF-02 | Minimización de datos hacia la IA | `lib/ia/prompt.ts › CAMPOS_OCULTOS_A_LA_IA, sistemaEstado` | `ia.test › «no envía documento, celular, correo, género ni minoría»`, `«el estado enviado es idéntico…»` | R7 |
| RNF-03 | Analítica sin datos personales | `lib/seguridad.ts › redactarPII`; `lib/analitica/registrar.ts` | `analitica.test › «redacta correo, celular, documento y nombres conocidos»`, `«los eventos de un turno solo llevan códigos…»` | R7 |
| RNF-04 | Nunca pide ni guarda claves u OTP; resiste la inyección de prompt | `seguridad.ts › detectarDatoProhibido, detectarInyeccion` | `motor.test › «nunca guarda claves ni códigos OTP»`, `«resiste intentos de cambiar sus instrucciones»`; E2E `«aviso de IA visible, advertencia de fraude…»` | R8, R9 |
| RNF-05 | No promete aprobación ni da asesoría financiera | `prompt.ts`; `data/faq/aprobacion.md` | `motor.test › «no promete aprobación»`, `«aclara que Neocrédito no cobra»` | Postura de base |
| RNF-06 | Trato igual sin importar género, minoría, ciudad o actividad | `motor.ts`; `ciiu.ts` | `equidad.test` (3 casos) | R4, R5 |
| RNF-07 | Accesibilidad WCAG 2.1 AA | Componentes en `components/` | E2E `«accesibilidad WCAG 2.1 AA (axe)…»` (0 violaciones) | R3 |
| RNF-08 | Límites de uso por sesión y por IP | `lib/servidor/limites.ts › permitir` | `limites.test` (2 casos) | R12 |
| RNF-09 | Calidad medible de la extracción y del CIIU, sin regresiones | `evals/ejecutar.mts`; `evals/umbrales.json` | `npm run evals:umbrales` (falla si una métrica baja del umbral) | R1 |
| RNF-10 | La interfaz no desborda la ventana | `app/globals.css` | E2E `«la página no crece más que la ventana…»` | — |

## 4. Huecos conocidos

- **Claude en vivo:** la ruta con IA está probada con un modelo simulado. Falta ejecutar `npm run evals -- --ia` con clave y guardar `evals/resultados/*-ia.json` como evidencia (ver Limitaciones en el README).
- **RF-19 (demo):** solo se verifica la accesibilidad de `/demo`, no que la reproducción llegue al final.
- **E2E fuera del CI:** las pruebas de Playwright (RF-09 a RF-11, RF-14, RF-18, RNF-07) se ejecutan localmente. El último resultado registrado es 12 de 12 (2026-10-30).
- **Compilación de producción fuera del CI:** `next build` se detiene porque la versión instalada de Next.js tiene un aviso de seguridad. Actualizar Next.js y añadir `npm run build` al CI.

## 5. Cómo mantener esta matriz

1. Un requisito nuevo recibe el siguiente ID (`RF-21`, `RNF-11`) en un issue antes de programarlo.
2. El PR que lo implementa menciona el ID en el título o la descripción y añade la fila aquí con su código y su prueba.
3. Si cambia el nombre de una prueba o de un símbolo citado, se actualiza la fila en el mismo PR.
4. Un riesgo nuevo va a [ia-responsable.md](ia-responsable.md) con el siguiente `R`.
