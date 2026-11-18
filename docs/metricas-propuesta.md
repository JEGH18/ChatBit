# Métricas que la propuesta promete medir en un piloto

Todas se calculan en `lib/analitica/metricas.ts` a partir de eventos **sin datos personales** y se ven en `/admin`. Definiciones comunes:

- **Sesión iniciada**: una sesión con al menos un mensaje o un campo completado (no cuenta a quien solo abrió la página).
- **Sesión finalizada**: tiene el evento `finalizado` (tocó «Finalizar registro» con todos los datos válidos).
- **Sesión abandonada**: no finalizada y sin actividad durante 30 minutos.
- **Campo mostrado / completado**: eventos `campo_mostrado` (el asistente empezó a pedirlo) y `campo_completado` o `campo_omitido`.

## KPIs principales

| KPI | Fórmula | Fuente (eventos / tablas) | Meta sugerida para el piloto* |
|---|---|---|---|
| **Tasa de finalización del registro** | sesiones finalizadas ÷ sesiones iniciadas | `Sesion.finalizada`, eventos `mensaje`/`campo_completado` | Superar en ≥ 10 puntos la línea base del formulario actual |
| **Abandono por campo** | sesiones abandonadas cuyo último campo pedido fue *c* ÷ sesiones que llegaron a *c* | `Sesion.ultimoCampo`, `campo_mostrado` | Ningún campo con abandono > 5 % |
| **Completitud de ventas** | sesiones con `campo_completado(ventasUltimoAnio)` ÷ sesiones iniciadas | eventos | ≥ 90 % entre las que llegan al campo |
| **Completitud de CIIU** | sesiones con `campo_completado(actividadEconomica)` ÷ sesiones iniciadas | eventos | ≥ 90 % entre las que llegan al campo |
| **Tiempo promedio de diligenciamiento** | mediana de (`finalizadaEn` − `creadaEn`) en sesiones finalizadas, en minutos. Se usa la mediana porque las pausas largas sesgan el promedio; se reporta también el promedio | `Sesion` | ≤ 8 minutos |
| **Satisfacción (CSAT)** | respuestas 🙂 ÷ total de respuestas de la encuesta (y promedio en escala 1–3) | `Encuesta.puntaje` | ≥ 80 % de 🙂 |
| **% de escalamiento a asesor** | sesiones con evento `escalamiento` ÷ sesiones iniciadas | eventos | Entre 3 % y 10 % (muy bajo puede indicar que la salida no se ve; muy alto, que el asistente no resuelve) |

\* Las metas son propuestas para discutir con el equipo del canal; deben fijarse después de medir la **línea base** del formulario actual con la misma definición.

## Métricas de apoyo

| Métrica | Fórmula | Para qué sirve |
|---|---|---|
| Tiempo mediano por campo | mediana de (primer `campo_completado` − primer `campo_mostrado`) por campo | Detectar preguntas difíciles |
| Errores de validación por campo | conteo de `error_validacion` por campo (y por código: formato, ambiguo, no encontrado…) | Mejorar instrucciones y ejemplos |
| Solicitudes de ayuda por campo | conteo de `ayuda` por campo | Priorizar explicaciones |
| Finalización chat vs. formulario manual | tasa de finalización de sesiones con y sin `usoFormulario` | Saber si el chat aporta frente al formulario |
| Uso de voz | sesiones con `usoVoz` ÷ iniciadas | Adopción de la voz |
| CIIU top-1 / top-3 en uso real | `ciiu_confirmado` con posición 1 (o ≤ 3) ÷ confirmaciones | Calidad de las sugerencias en producción |
| Preguntas sin resolver | preguntas pendientes en la bandeja y su frecuencia | Cobertura de la base de conocimiento |
| Precisión y cobertura de extracción | `npm run evals` (conjunto de prueba) | Calidad de la IA antes de cada cambio |

## Métricas de equidad (desempeño por segmento)

| Métrica | Fórmula | Alerta |
|---|---|---|
| Completitud por campo y segmento | sesiones del segmento con `campo_completado(c)` ÷ sesiones iniciadas del segmento | Segmento con ≥ 5 sesiones y ≥ 15 puntos por debajo del promedio |
| Finalización por segmento | finalizadas del segmento ÷ iniciadas del segmento | Igual criterio |

Segmentos: rango de edad (opcional, de la encuesta; ver sesgo de supervivencia en `ia-responsable.md`) y canal (usó voz / solo texto). En un piloto se pueden agregar, si el canal lo autoriza, región (departamento) y dispositivo.

## Diseño sugerido del piloto

1. **Línea base**: 2–4 semanas midiendo el formulario actual con las mismas definiciones (requiere instrumentar el formulario web con los eventos `campo_mostrado`, `campo_completado`, `error_validacion` y `finalizado`).
2. **Prueba A/B**: asignar al azar a las personas que llegan al registro entre formulario actual y asistente (por ejemplo 50/50), estratificando por canal de llegada.
3. **Tamaño de muestra orientativo**: para detectar un aumento de 10 puntos en la tasa de finalización (p. ej. de 50 % a 60 %) con 80 % de potencia y α = 0,05 se necesitan ≈ 390 sesiones por grupo.
4. **Revisión semanal** del panel: embudo, brechas por segmento, bandeja de preguntas y nuevas respuestas aprobadas.
