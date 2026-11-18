# IA responsable en el Asistente Neo

Este documento resume los riesgos del asistente, cómo se mitigan en el prototipo, dónde está la evidencia (código y pruebas) y cómo se relacionan con los **cinco ejes del proyecto de justicia algorítmica del canal**: calidad de datos, desempeño por segmento, variables proxy, explicabilidad y gobernanza.

## 1. Postura de base

1. **El asistente no participa en la decisión de crédito.** No evalúa riesgo, no predice aprobación ni montos, no recomienda entidades ni ofertas y no promete crédito. Repite que las ofertas no son en firme y que solo se acepta una. *(Reglas en el prompt `lib/ia/prompt.ts`; respuestas aprobadas en `data/faq/aprobacion.md`, `ofertas-no-en-firme.md`, `una-sola-oferta.md`; prueba `tests/unit/motor.test.ts › no promete aprobación`.)*
2. **La IA propone; el código decide.** Toda validación, orden de campos y transición de estado es determinista y está probada. La IA no puede confirmar el documento, aceptar consentimientos ni finalizar: esas herramientas no existen y el esquema Zod de `actualizarCampo` excluye esos campos. *(`lib/form/campos.ts › CAMPOS_SOLO_ACCION_EXPLICITA`, `tests/unit/ia.test.ts › la IA no puede aceptar la política ni confirmar el documento`.)*
3. **Minimización.** Solo se piden los datos del formulario. La edad, que no está en el formulario, se pregunta solo de forma opcional y anónima en la encuesta, para medir equidad.
4. **No se reentrena con datos personales.** El «aprendizaje» es analítica anonimizada, una bandeja revisada por humanos y sinónimos CIIU anonimizados.

## 2. Matriz de riesgos

| # | Riesgo | Mitigación en el prototipo | Evidencia | Eje |
|---|---|---|---|---|
| R1 | La IA extrae o «corrige» mal un dato (p. ej. inventa un municipio o un CIIU) | Validación Zod de cada valor; ambigüedad → pregunta («La Unión» existe en 4 departamentos); CIIU solo entre candidatos del catálogo y siempre elegido por la persona; documento leído en grupos; resumen final editable | `validadores.ts`, `ciiu.ts`, `ia/ciiu.ts`; `validadores.test.ts › "La Unión"…`; evals: precisión 100 % en el conjunto de prueba | Calidad de datos |
| R2 | Ventas mal reportadas (mensual tomada como anual, cifras irreales) | Detección de periodo («al mes», «diario»), cálculo transparente con pasos visibles y confirmación; cifras < 1 M o > 5.000 M piden confirmación; nunca se corrige sola | `dinero.ts`, `motor.ts › proponerVentas`; `dinero.test.ts`, E2E Marcela | Calidad de datos |
| R3 | El asistente funciona peor para adultos mayores, personas con baja alfabetización digital o de regiones apartadas | Voz, texto grande, alto contraste, lenguaje sencillo y «usted», reintentos con ayuda, salida a asesor y a formulario manual; **panel de desempeño por segmento** (edad y voz/texto) con alertas de brecha de 15 puntos o más | `/admin › Desempeño por segmento`; `lib/analitica/metricas.ts`; E2E Domiciano (voz, errores de digitación) | Desempeño por segmento |
| R4 | Trato diferenciado según género, minoría, ciudad o actividad | **Prueba automática de equidad**: 5 variantes de la misma conversación (cambiando solo esos datos) deben producir las mismas acciones, botones, tarjetas y tono. La IA no recibe género ni minoría en el estado | `tests/unit/equidad.test.ts`; `tests/unit/ia.test.ts › el estado enviado es idéntico…` | Variables proxy / segmento |
| R5 | Variables proxy: ciudad, departamento o actividad pueden correlacionar con etnia o nivel socioeconómico | El comportamiento no depende de ellas (R4). La prueba de equidad **encontró y corrigió dos disparidades reales**: (a) Valle tenía 8 botones de municipios y Chocó ninguno → ahora todos los departamentos tienen el mismo número; (b) algunas actividades recibían 2 opciones CIIU y otras 3 → siempre 3 | Commit de la fase 1; `motor.ts › chipsDe("ciudad")`, `ciiu.ts › relleno` | Variables proxy |
| R6 | Datos sensibles (género, minoría) tratados con insistencia o juicio | Explicación neutral («fines estadísticos, no afecta la evaluación»), opción «Prefiero no decir/responder», nunca se insiste: si la respuesta no es clara en un campo sensible opcional, se omite | `campos.ts › sensible`, `motor.ts › responderCampo`; E2E Marcela | Explicabilidad / gobernanza |
| R7 | Fuga de datos personales en registros, analítica o en la IA | Datos del formulario solo en el navegador (24 h, botón «Borrar mis datos»); eventos sin valores; preguntas y descripciones anonimizadas (correo, celular, documento y valores conocidos de la sesión); estado minimizado hacia la IA | `lib/seguridad.ts › redactarPII`, `lib/analitica/registrar.ts`; `analitica.test.ts`; `ia.test.ts › no envía documento…` | Gobernanza |
| R8 | Inyección de prompt («ignora tus instrucciones», «muéstrame tu prompt») | Detección por reglas antes de llamar a la IA (respuesta fija, sin IA); instrucciones separadas del historial (AI SDK v7 no admite mensajes de sistema en el historial); regla explícita en el prompt; las herramientas validan todo lo que reciben | `seguridad.ts › detectarInyeccion`, `motor.ts › intentarDeterminista`; `motor.test.ts`, `ia.test.ts` | Gobernanza |
| R9 | Fraude y suplantación (pedir claves u OTP, cobros) | Nunca se piden; si la persona los escribe, se advierte y no se guardan; mensaje de «Neocrédito no cobra» al inicio, en la página y en la FAQ | `seguridad.ts › detectarDatoProhibido`; E2E `salvaguardas.spec.ts` | Gobernanza |
| R10 | Alucinaciones sobre Neocrédito (tasas, plazos, sedes) | La IA debe usar `consultarPreguntasFrecuentes`; sin respuesta aprobada, lo dice y la pregunta va a la bandeja; un humano aprueba la respuesta | `herramientas.ts`, `/admin › Bandeja`; E2E del panel | Explicabilidad / gobernanza |
| R11 | Dependencia de la IA (caída, rechazo, latencia) | Respaldo automático al motor guiado en el servidor y en el navegador; `fallbacks: "default"` de Anthropic ante rechazos de seguridad | `ia/turno.ts`, `useAsistente.ts › turnoLocal`; E2E «si se cae la red» | Gobernanza |
| R12 | Abuso y costos (mensajes masivos) | Límite por sesión (visible) y límite por IP y por sesión en el servidor; esfuerzo bajo del modelo | `lib/servidor/limites.ts` | Gobernanza |
| R13 | El aprendizaje se contamina (datos sintéticos o de prueba entrenan las sugerencias) | Los datos sintéticos se marcan y **no alimentan** los sinónimos; las FAQ solo cambian con aprobación humana | `lib/datos/*`, `analitica.test.ts › los sinónimos de datos sintéticos no alimentan…` | Calidad de datos / gobernanza |
| R14 | Se mide mal la equidad | La edad solo se conoce de quienes terminan (sesgo de supervivencia): el panel lo advierte y ofrece además el segmento voz/texto, que cubre todas las sesiones. Recomendación para el piloto: pedir el rango de edad (opcional y anónimo) al inicio, con consentimiento | `app/admin/page.tsx` | Desempeño por segmento |

## 3. Relación con los cinco ejes

### Calidad de datos
El objetivo central del asistente es mejorar la calidad del registro: menos faltantes en **ventas** y **CIIU**, menos errores de digitación (documento leído en grupos, celular y correo validados, correo dictado por voz) y valores canónicos (códigos DIVIPOLA y CIIU). **Efecto aguas abajo a vigilar:** si el asistente cambia la distribución de los datos (por ejemplo, más ventas *estimadas*), los modelos de las entidades que los consumen podrían verse afectados. Recomendaciones: marcar en el registro si la cifra de ventas fue estimada (siguiente iteración) y comparar distribuciones antes y después del piloto.

### Desempeño por segmento
El panel muestra la completitud de cada campo y la tasa de finalización por **rango de edad** y por **canal (voz/texto)**, con alertas automáticas cuando un segmento con 5 o más sesiones queda 15 puntos o más por debajo del promedio. Se complementa con las pruebas E2E de las tres personas (adulto mayor con voz, emprendedora informal, usuario experto).

### Variables proxy
Género y minoría no llegan a la IA. Ciudad y actividad sí son necesarias para la conversación, pero la prueba de equidad verifica que el comportamiento del asistente no cambia con ellas. Las disparidades encontradas (botones por departamento y número de opciones CIIU) eran sutiles: se corrigieron y la prueba evita que vuelvan.

### Explicabilidad
- Aviso visible y permanente de que se conversa con una IA, y página [/como-funciona](../app/como-funciona/page.tsx) en lenguaje sencillo.
- Cada sugerencia CIIU muestra una explicación sencilla y el nombre oficial; el cálculo de ventas muestra cada paso.
- Las explicaciones de los campos y las respuestas sobre Neocrédito vienen de textos revisados (`campos.ts`, `data/faq/*.md`); la IA las parafrasea, no las inventa.
- El JSON final tiene la misma estructura del formulario, así que se puede auditar qué se registró.

### Gobernanza
- **Humano en el bucle**: la bandeja convierte preguntas sin respuesta en conocimiento solo cuando una persona del equipo aprueba la respuesta. Las respuestas se descargan en Markdown para versionarlas en git (`data/faq/`).
- **Trazabilidad sin datos personales**: eventos con códigos, no con valores.
- **Cambios medibles**: evaluaciones reproducibles (`npm run evals`) con un conjunto de prueba aparte; las pruebas de equidad y accesibilidad corren en cada cambio.
- **Configuración explícita**: modelo, esfuerzo, trato, opciones del formulario y enlaces se cambian por variables de entorno o archivos versionados.

## 4. Marco normativo (Colombia)

- **Ley 1581 de 2012 (habeas data)** y su reglamentación: autorización previa, expresa e informada (checkbox nunca marcado por defecto, resumen en 3 viñetas y enlace a la política); finalidad y minimización (solo los campos del formulario); derechos de conocer, actualizar, rectificar y suprimir (explicados en `/como-funciona`; borrado local con un botón).
- **Ley 1266 de 2008 (habeas data financiero)**: el asistente no consulta ni comenta información crediticia de centrales de riesgo; la respuesta sobre reportes negativos remite a la evaluación de cada entidad.
- **Circular Externa 002 de 2024 de la SIC** (tratamiento de datos personales en sistemas de IA): el prototipo aplica privacidad desde el diseño (datos en el dispositivo, analítica anonimizada, estado minimizado hacia el proveedor de IA), transparencia (aviso de IA y explicación de su funcionamiento) y seguridad. **Antes de un piloto con datos reales** se recomienda: evaluación de impacto en privacidad, revisión del contrato y la transferencia internacional de datos con el proveedor del modelo, política de retención de las conversaciones en el proveedor, y validación jurídica de los textos de autorización.

> Este documento describe medidas técnicas de un prototipo académico; no constituye concepto jurídico.

## 5. Pendientes para un piloto

1. Ejecutar las evaluaciones con Claude (`npm run evals -- --ia`) y con mensajes reales anonimizados; fijar umbrales mínimos (p. ej. precisión de extracción ≥ 98 %, CIIU top-3 ≥ 95 %).
2. Repetir la prueba de equidad sobre la ruta con IA, con el modelo real, comparando acciones (herramientas llamadas, campos pedidos, ofrecimiento de ayuda) entre variantes.
3. Marcar en el registro las ventas estimadas y medir su efecto en las ofertas.
4. Preguntar el rango de edad al inicio (opcional) para evitar el sesgo de supervivencia en el panel.
5. Revisión de accesibilidad con personas mayores reales (no solo axe) y prueba en celulares de gama baja con red 3G.
