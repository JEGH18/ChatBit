import {
  FIELDS, STEPS, emptyState, sanitizeState, publicState, displayValue, suggestionsFor,
} from '../lib/form.js';
import { handleGuided } from '../lib/guided.js';
import { handleAI, aiEnabled } from '../lib/ai.js';

const MAX_MESSAGE = 1000;

const GREETING = '¡Hola! Soy el asistente de registro de **Neocrédito**. Te acompaño a llenar tu solicitud de crédito en dos partes: información general e información financiera. Toma unos 3 minutos.\n\nPara empezar, ¿cuál es tu primer nombre?';

function formSchema() {
  return {
    steps: STEPS,
    fields: FIELDS.filter((f) => f.key !== 'confirmacionDocumento')
      .map(({ key, label, step, required }) => ({ key, label, step, required })),
  };
}

function display(state) {
  return Object.fromEntries(Object.entries(state.data).map(([k, v]) => [k, displayValue(k, v)]));
}

function respond(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return respond(res, 405, { error: 'Método no permitido' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') return respond(res, 400, { error: 'Solicitud inválida' });

  const mode = aiEnabled() ? 'ia' : 'guiado';

  if (body.action === 'start') {
    const state = emptyState();
    return respond(res, 200, {
      reply: GREETING, state: publicState(state), display: {}, form: formSchema(),
      suggestions: suggestionsFor(state, state.awaiting), mode,
    });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return respond(res, 400, { error: 'Escribe un mensaje.' });
  if (message.length > MAX_MESSAGE) return respond(res, 400, { error: `El mensaje supera ${MAX_MESSAGE} caracteres.` });

  const state = sanitizeState(body.state);
  let result;
  let usedMode = mode;

  if (mode === 'ia') {
    const backup = structuredClone(state);
    try {
      result = await handleAI(state, message, body.history);
    } catch (err) {
      console.error('Fallo la IA, se usa el modo guiado:', err.message);
      Object.assign(state, backup);
      result = await handleGuided(state, message);
      usedMode = 'guiado';
    }
  } else {
    result = await handleGuided(state, message);
  }

  return respond(res, 200, {
    reply: result.reply,
    suggestions: result.suggestions || [],
    state: publicState(state),
    display: display(state),
    mode: usedMode,
  });
}
