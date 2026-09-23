# ChatBit — Asistente de registro Neocrédito

Chatbot con IA que guía a una persona natural, paso a paso, por el **Formulario de registro persona natural** de [Neocrédito](https://neocredito.bancoldex.com/neocredito/home) (Bancóldex) para solicitar un crédito.

El chat recorre las mismas dos partes del formulario web:

| Parte | Campos |
|---|---|
| 1. Información general | Primer nombre, primer apellido, tipo y número de documento (con confirmación), género, celular, correo, ¿tiene RUT?, ¿cómo te enteraste? |
| 2. Información financiera | Departamento y ciudad del negocio, medio de contacto, ¿pertenece a alguna minoría?, actividad económica (CIIU), año de ventas, ventas del último año, política de datos y términos |

Al final muestra un resumen, pide confirmación y genera un **radicado** (`NEO-AAAAMMDD-XXXXXX`).

## Cómo funciona

- **Con IA** (`ANTHROPIC_API_KEY` configurada): Claude conversa en lenguaje natural y guarda los datos con herramientas (`guardar_datos`, `finalizar_registro`). Entiende respuestas libres como *"me llamo Ana Pérez, cc 1144..."*, *"vendí como 10 millones"* o *"tengo una peluquería en Cali"* (→ CIIU 9602, Valle del Cauca).
- **Modo guiado** (sin clave o si la IA falla): pregunta campo por campo con las mismas validaciones. El bot nunca se queda sin responder.
- **Validación en el servidor**: la IA propone valores, pero el código decide (celular de 10 dígitos que empiece por 3, correo válido, confirmación idéntica al documento, departamentos de Colombia, montos en pesos, consentimientos explícitos). El estado que envía el navegador se revalida en cada mensaje.
- **Panel "Tu formulario"**: muestra en vivo cómo se va llenando el formulario.

## Estructura

```
api/chat.js        Función serverless de Vercel (POST /api/chat)
lib/form.js        Campos, validaciones y estado del formulario
lib/catalogs.js    Tipos de documento, departamentos, ciudades, CIIU, enlaces
lib/ai.js          Conversación con Claude + herramientas
lib/guided.js      Motor guiado (respaldo sin IA)
lib/submit.js      Finalización y envío opcional a un webhook
public/            Interfaz del chat (HTML, CSS, JS sin frameworks) y embed.js
scripts/dev.js     Servidor local sin dependencias
tests/             Pruebas (node --test)
```

## Ejecutar en local

Requiere Node.js 20 o superior. No hay dependencias que instalar.

```bash
cp .env.example .env      # pon tu ANTHROPIC_API_KEY (opcional)
npm run dev               # http://localhost:3000
npm test
```

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `ANTHROPIC_API_KEY` | Para usar IA | Clave de https://console.anthropic.com |
| `ANTHROPIC_MODEL` | No | Por defecto `claude-haiku-4-5-20251001` |
| `SUBMIT_WEBHOOK_URL` | No | Si existe, el registro final se envía allí como JSON (POST). Si no, el envío es simulado |
| `SUBMIT_WEBHOOK_TOKEN` | No | Se envía como `Authorization: Bearer ...` al webhook |
| `POLICY_URL`, `TERMS_URL` | No | Enlaces de la política de datos y de los términos |

## Desplegar en Vercel

1. En https://vercel.com/new importa el repositorio `JEGH18/ChatBit` (Framework Preset: **Other**, sin build command).
2. En *Settings → Environment Variables* agrega `ANTHROPIC_API_KEY`.
3. Deploy. Cada push a `main` vuelve a desplegar.

O con la CLI:

```bash
npm i -g vercel@latest
vercel login
vercel link
vercel env add ANTHROPIC_API_KEY
vercel --prod
```

## Incrustar en otra página

```html
<script src="https://TU-PROYECTO.vercel.app/embed.js" defer></script>
```

Agrega un botón flotante "Solicita tu crédito" que abre el asistente.

## Notas

- Las opciones de algunos desplegables (tipos de documento, género, "¿cómo te enteraste?") y el catálogo CIIU son un subconjunto razonable; ajústalos en `lib/catalogs.js` para que coincidan con el formulario real.
- El envío es una simulación salvo que configures `SUBMIT_WEBHOOK_URL`. El servidor no guarda ni registra en logs los datos personales.
