import {
  FIELDS, FIELD_BY_KEY, norm, parseYesNo, applyUpdates, pendingFields,
  summaryText, suggestionsFor,
} from './form.js';
import { finalizeRegistration, finalizedMessage } from './submit.js';

const CONFIRM_CHIPS = [
  { label: 'Sí, finalizar registro', value: 'Sí, finalizar registro' },
  { label: 'Corregir un dato', value: 'Corregir un dato' },
];
export const RESET_CHIP = { label: 'Iniciar una nueva solicitud', value: 'Iniciar una nueva solicitud', action: 'reset' };

// Campos que el usuario puede pedir corregir, con palabras clave.
const EDITABLE = FIELDS.filter((f) => f.key !== 'confirmacionDocumento');
const KEYWORDS = {
  primerNombre: ['nombre'], primerApellido: ['apellido'], tipoDocumento: ['tipo de documento', 'tipo'],
  numeroDocumento: ['numero de documento', 'documento', 'cedula'], genero: ['genero'],
  celular: ['celular', 'telefono', 'numero de celular'], correo: ['correo', 'email', 'mail'],
  tieneRut: ['rut'], comoSeEntero: ['como te enteraste', 'enteraste'], departamento: ['departamento'],
  ciudad: ['ciudad', 'municipio'], medioContacto: ['contacto', 'contactado'], perteneceMinoria: ['minoria'],
  actividadEconomica: ['actividad', 'ciiu'], anioVentas: ['ano de ventas', 'ano'], ventasUltimoAnio: ['ventas', 'valor'],
  aceptaPoliticaDatos: ['politica', 'datos personales'], aceptaTerminos: ['terminos'],
};

export function findFieldByText(text) {
  const t = norm(text);
  if (!t) return null;
  const byLabel = EDITABLE.find((f) => norm(f.label) === t);
  if (byLabel) return byLabel;
  // la palabra clave más larga que aparezca gana ("numero de celular" antes que "documento")
  let best = null;
  for (const f of EDITABLE) {
    for (const k of KEYWORDS[f.key] || []) {
      if (new RegExp(`(^| )${k}( |$)`).test(t) && (!best || k.length > best.k.length)) best = { f, k };
    }
  }
  return best?.f || null;
}

const correctionChips = () => EDITABLE.map((f) => ({ label: f.label, value: `Corregir ${f.label.toLowerCase()}` }));

function askNext(state, prefix = '') {
  const next = pendingFields(state)[0];
  if (next) {
    state.awaiting = next.key;
    return { reply: `${prefix}${next.ask(state.data)}`, suggestions: suggestionsFor(state, next.key) };
  }
  state.awaiting = 'confirm';
  state.readyToConfirm = true;
  return {
    reply: `${prefix}Revisa que todo esté bien:\n\n${summaryText(state)}\n\n¿Los datos son correctos?`,
    suggestions: CONFIRM_CHIPS,
  };
}

function askField(state, field) {
  state.awaiting = field.key;
  if (field.key === 'numeroDocumento') delete state.data.confirmacionDocumento;
  return { reply: field.ask(state.data), suggestions: suggestionsFor(state, field.key) };
}

export async function handleGuided(state, message) {
  const text = String(message ?? '').trim();

  if (state.finalized) {
    return {
      reply: `Tu registro ya fue enviado con el radicado **${state.radicado}**. Si quieres hacer otra solicitud, empieza de nuevo.`,
      suggestions: [RESET_CHIP],
    };
  }

  // "corregir correo", "cambiar mi celular", etc. funciona en cualquier momento
  const correction = norm(text).match(/^(corregir|cambiar|editar|modificar)( (un dato|mi|el|la))?(.*)$/);
  if (correction) {
    const field = findFieldByText(correction[4]);
    if (field) return askField(state, field);
    state.awaiting = 'correct';
    return { reply: '¿Qué dato quieres corregir?', suggestions: correctionChips() };
  }

  if (state.awaiting === 'correct') {
    const field = findFieldByText(text);
    if (field) return askField(state, field);
    return { reply: 'Elige el dato que quieres corregir.', suggestions: correctionChips() };
  }

  if (state.awaiting === 'confirm' || state.awaiting === 'done') {
    if (pendingFields(state).length) return askNext(state);
    const yes = parseYesNo(text) ?? (/finalizar/.test(norm(text)) ? true : null);
    if (yes === true) {
      const result = await finalizeRegistration(state);
      if (!result.ok) return { reply: result.error, suggestions: CONFIRM_CHIPS };
      return { reply: finalizedMessage(state), suggestions: [RESET_CHIP] };
    }
    if (yes === false) {
      state.awaiting = 'correct';
      return { reply: '¿Qué dato quieres corregir?', suggestions: correctionChips() };
    }
    return { reply: 'Responde "Sí" para finalizar el registro o elige "Corregir un dato".', suggestions: CONFIRM_CHIPS };
  }

  const field = FIELD_BY_KEY[state.awaiting] || pendingFields(state)[0];
  if (!field) return askNext(state);

  const { errors } = applyUpdates(state, { [field.key]: text });
  if (errors.length) {
    const e = errors[0];
    const suggestions = e.suggestions
      ? e.suggestions.map((s) => (typeof s === 'string' ? { label: s, value: s } : s))
      : suggestionsFor(state, field.key);
    state.awaiting = field.key;
    return { reply: e.error, suggestions };
  }
  return askNext(state);
}
