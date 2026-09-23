import { missingRequired, buildSubmission, generarRadicado } from './form.js';

/**
 * Finaliza el registro. Si existe SUBMIT_WEBHOOK_URL, envía la solicitud allí (POST JSON);
 * si no, el registro queda simulado y solo se genera el radicado.
 */
export async function finalizeRegistration(state) {
  const missing = missingRequired(state);
  if (missing.length) {
    return { ok: false, error: `Faltan datos obligatorios: ${missing.map((f) => f.label).join(', ')}.` };
  }
  if (state.data.aceptaPoliticaDatos !== true || state.data.aceptaTerminos !== true) {
    return { ok: false, error: 'Para finalizar es necesario aceptar la política de datos y los términos y condiciones.' };
  }

  const radicado = generarRadicado();
  const payload = { radicado, fecha: new Date().toISOString(), solicitud: buildSubmission(state) };

  const webhook = process.env.SUBMIT_WEBHOOK_URL;
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.SUBMIT_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.SUBMIT_WEBHOOK_TOKEN}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`Webhook respondió ${res.status}`);
    } catch (err) {
      console.error('Error enviando el registro:', err.message);
      return { ok: false, error: 'No se pudo enviar el registro en este momento. Intenta de nuevo en unos minutos.' };
    }
  }

  state.finalized = true;
  state.radicado = radicado;
  state.awaiting = 'done';
  state.readyToConfirm = false;
  return { ok: true, radicado };
}

export function finalizedMessage(state) {
  const medio = state.data.medioContacto ? ` por ${state.data.medioContacto}` : '';
  return `¡Listo, ${state.data.primerNombre}! Tu registro quedó creado con el radicado **${state.radicado}**. `
    + `Guarda este número: el siguiente paso de tu solicitud te llegará${medio}.`;
}
