import {
  TIPOS_DOCUMENTO, GENEROS, SI_NO, CANALES, MEDIOS_CONTACTO,
  DEPARTAMENTOS, DEPARTAMENTO_ALIASES, DEPARTAMENTOS_FRECUENTES,
  CIIU, CIIU_FRECUENTES, LINKS,
} from './catalogs.js';

// ---------- utilidades de texto ----------

export const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[¡!¿?.,;:"']/g, ' ').replace(/\s+/g, ' ').trim();

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SKIP_WORDS = ['omitir', 'saltar', 'prefiero no responder', 'prefiero no decir', 'no quiero responder', 'paso'];
export const SKIP = '__omitir__';

const ok = (value) => ({ ok: true, value });
const fail = (error, suggestions) => ({ ok: false, error, suggestions });

export function parseYesNo(input) {
  if (typeof input === 'boolean') return input;
  const t = norm(input);
  if (/^(no|nop|nope|negativo|n)\b/.test(t)) return false;
  if (/^(si|sip|claro|correcto|afirmativo|yes|s|por supuesto|acepto|de acuerdo|ok|okay|dale|listo|confirmo|esta bien)\b/.test(t)) return true;
  return null;
}

export function matchOption(input, options) {
  const t = norm(input);
  if (!t) return null;
  for (const o of options) {
    if ([o.value, ...(o.aliases || [])].map(norm).includes(t)) return o.value;
  }
  const hits = options.filter((o) => [o.value, ...(o.aliases || [])].map(norm)
    .some((k) => (t.length >= 3 && k.startsWith(t)) || new RegExp(`(^| )${escapeRe(k)}( |$)`).test(t)));
  return hits.length === 1 ? hits[0].value : null;
}

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
function titleCase(s) {
  return s.toLowerCase().split(' ').map((w, i) => (i > 0 && PARTICULAS.has(w))
    ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ---------- parsers por tipo ----------

function parseName(input, _data, field) {
  const s = String(input ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return fail(`Necesito tu ${field.label.toLowerCase()}.`);
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{2,40}$/.test(s)) {
    return fail(`El ${field.label.toLowerCase()} solo puede tener letras (entre 2 y 40).`);
  }
  if (s.split(' ').length > 3) return fail(`Escribe solo tu ${field.label.toLowerCase()}, no el nombre completo.`);
  return ok(titleCase(s));
}

function parseOption(options, errorText) {
  return (input) => {
    const v = matchOption(input, options);
    return v ? ok(v) : fail(errorText, options.map((o) => o.value));
  };
}

function cleanDocument(input) {
  return String(input ?? '').toUpperCase().replace(/[\s.\-]/g, '');
}

function parseDocumento(input, data) {
  const v = cleanDocument(input);
  const tipo = data.tipoDocumento;
  if (tipo === 'PASAPORTE') {
    return /^[A-Z0-9]{5,15}$/.test(v) ? ok(v) : fail('El pasaporte debe tener entre 5 y 15 letras o números.');
  }
  if (!/^\d+$/.test(v)) return fail('El número de documento solo puede tener números, sin puntos ni espacios.');
  if (tipo === 'CÉDULA DE CIUDADANÍA' && (v.length < 5 || v.length > 10)) {
    return fail('La cédula de ciudadanía debe tener entre 5 y 10 dígitos.');
  }
  if (v.length < 5 || v.length > 12) return fail('El número de documento debe tener entre 5 y 12 dígitos.');
  return ok(v);
}

function parseConfirmacion(input, data) {
  if (!data.numeroDocumento) return fail('Primero necesito el número de documento.');
  const v = cleanDocument(input);
  return v === data.numeroDocumento
    ? ok(v)
    : fail('Los números no coinciden. Revisa y escríbelo de nuevo exactamente igual.');
}

function parseCelular(input) {
  let d = String(input ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2);
  return /^3\d{9}$/.test(d) ? ok(d) : fail('El celular debe tener 10 dígitos y empezar por 3, por ejemplo 3001234567.');
}

function parseCorreo(input) {
  const v = String(input ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? ok(v) : fail('Ese correo no parece válido. Revisa que tenga el formato nombre@dominio.com.');
}

export function findDepartamento(input) {
  const t = norm(input);
  if (!t) return null;
  const names = Object.keys(DEPARTAMENTOS);
  const exact = names.find((n) => norm(n) === t) || DEPARTAMENTO_ALIASES[t];
  if (exact) return exact;
  const partial = names.filter((n) => norm(n).startsWith(t) || new RegExp(`(^| )${escapeRe(norm(n))}( |$)`).test(t));
  if (partial.length === 1) return partial[0];
  const alias = Object.keys(DEPARTAMENTO_ALIASES).find((a) => new RegExp(`(^| )${escapeRe(a)}( |$)`).test(t));
  return alias ? DEPARTAMENTO_ALIASES[alias] : null;
}

function parseDepartamento(input) {
  const v = findDepartamento(input);
  return v ? ok(v) : fail('No reconocí ese departamento de Colombia. Escríbelo de nuevo, por ejemplo "Valle del Cauca".', DEPARTAMENTOS_FRECUENTES);
}

function parseCiudad(input, data) {
  const s = String(input ?? '').replace(/\s+/g, ' ').trim();
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ .'-]{2,50}$/.test(s)) {
    return fail('Escribe el nombre del municipio o ciudad, solo con letras.', data.departamento ? DEPARTAMENTOS[data.departamento] : undefined);
  }
  const known = data.departamento && DEPARTAMENTOS[data.departamento].find((c) => norm(c) === norm(s));
  return ok((known || s).toUpperCase());
}

export function searchCiiu(input) {
  const t = norm(input);
  const code = t.match(/\b(\d{4})\b/);
  if (code) {
    const hit = CIIU.find((c) => c.codigo === code[1]);
    return hit ? [hit] : [{ codigo: code[1], descripcion: `Código CIIU ${code[1]}`, corto: `Código ${code[1]}` }];
  }
  const words = t.split(' ').filter((w) => w.length >= 4 && !['venta', 'vendo', 'negocio', 'tengo', 'hago', 'para', 'otros', 'productos', 'servicio', 'servicios'].includes(w));
  if (!words.length) return [];
  const scored = CIIU.map((c) => {
    const hay = norm(`${c.descripcion} ${c.corto} ${c.palabras}`);
    const score = words.reduce((acc, w) => acc + (new RegExp(`(^| )${escapeRe(w)}`).test(hay) ? 1 : 0), 0);
    return { c, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length) return [];
  const top = scored[0].score;
  return scored.filter((x) => x.score === top).map((x) => x.c);
}

export const ciiuLabel = (c) => `${c.codigo} - ${c.descripcion}`;
const ciiuChip = (c) => ({ label: c.corto, value: `${c.codigo} - ${c.corto}` });

function parseActividad(input) {
  const hits = searchCiiu(input);
  if (hits.length === 1) return ok(ciiuLabel(hits[0]));
  if (hits.length > 1) {
    return fail('Encontré varias actividades parecidas. ¿Cuál describe mejor tu negocio?', hits.slice(0, 5).map(ciiuChip));
  }
  return fail('No encontré esa actividad. Descríbela con otras palabras (por ejemplo "tienda de barrio" o "restaurante") o escribe el código CIIU de 4 dígitos que aparece en tu RUT o Cámara de Comercio.',
    CIIU_FRECUENTES.map((code) => ciiuChip(CIIU.find((c) => c.codigo === code))));
}

export function aniosVentas(now = new Date()) {
  const y = now.getFullYear();
  return [String(y - 1), String(y - 2)];
}

function parseAnio(input) {
  const years = aniosVentas();
  const m = String(input ?? '').match(/\b(20\d{2})\b/);
  return m && years.includes(m[1]) ? ok(m[1]) : fail(`El año de ventas debe ser ${years.join(' o ')}.`, years);
}

export function parseMoney(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input) : null;
  let t = String(input ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\$/g, ' ').replace(/\s+/g, ' ').replace(/\b(cop|pesos|de pesos|aprox|aproximadamente|mas o menos|unos|como)\b/g, ' ').trim();
  let mult = 1;
  if (/\bmil millones\b/.test(t)) mult = 1e9;
  else if (/(\d\s*(millones|millon|mill|mm|m)\b)/.test(t)) mult = 1e6;
  else if (/(\d\s*(mil|k)\b)/.test(t)) mult = 1e3;
  const m = t.match(/\d[\d.,]*/);
  if (!m) return null;
  let num = m[0].replace(/[.,]$/, '');
  const seps = num.match(/[.,]/g) || [];
  const decimal = seps.length === 1 && /[.,]\d{1,2}$/.test(num);
  num = decimal ? num.replace(',', '.') : num.replace(/[.,]/g, '');
  const value = Number(num) * mult;
  return Number.isFinite(value) ? Math.round(value) : null;
}

function parseVentas(input) {
  const v = parseMoney(input);
  if (v === null) return fail('Escribe el valor de las ventas en pesos, por ejemplo 10.000.000 o "10 millones".');
  if (v < 10000) return fail('Esa cifra parece muy baja para las ventas de un año. Escribe el valor completo en pesos, por ejemplo 10.000.000 o "10 millones".');
  if (v > 1e12) return fail('Ese valor es demasiado alto. Revisa la cifra de ventas anuales en pesos.');
  return ok(v);
}

function parseConsent(label) {
  return (input) => {
    const yes = parseYesNo(input);
    if (yes === true) return ok(true);
    if (yes === false) return fail(`Sin aceptar ${label} no es posible finalizar el registro. Si cambias de opinión, responde "Acepto".`, ['Acepto']);
    return fail(`Responde "Acepto" para aceptar ${label}.`, ['Acepto', 'No acepto']);
  };
}

export const formatCOP = (n) => `$${Number(n).toLocaleString('es-CO')}`;

// ---------- definición del formulario ----------

export const STEPS = {
  1: 'Información general',
  2: 'Información financiera',
};

export const FIELDS = [
  { key: 'primerNombre', label: 'Primer nombre', step: 1, required: true, parse: parseName,
    ask: () => '¿Cuál es tu primer nombre?' },
  { key: 'primerApellido', label: 'Primer apellido', step: 1, required: true, parse: parseName,
    ask: (d) => `Mucho gusto, ${d.primerNombre}. ¿Cuál es tu primer apellido?` },
  { key: 'tipoDocumento', label: 'Tipo de documento', step: 1, required: true, options: TIPOS_DOCUMENTO,
    parse: parseOption(TIPOS_DOCUMENTO, 'Elige uno de los tipos de documento disponibles.'),
    ask: () => '¿Qué tipo de documento de identidad tienes?' },
  { key: 'numeroDocumento', label: 'Número de documento', step: 1, required: true, parse: parseDocumento,
    ask: () => 'Escribe tu número de documento, sin puntos ni espacios.' },
  { key: 'confirmacionDocumento', label: 'Confirma tu número de documento', step: 1, required: true, parse: parseConfirmacion,
    ask: () => 'Para evitar errores, escribe de nuevo tu número de documento.' },
  { key: 'genero', label: 'Género', step: 1, required: true, options: GENEROS,
    parse: parseOption(GENEROS, 'Elige una de las opciones: masculino, femenino u otro.'),
    ask: () => '¿Cuál es tu género?' },
  { key: 'celular', label: 'Número de celular', step: 1, required: true, parse: parseCelular,
    ask: () => '¿Cuál es tu número de celular? Son 10 dígitos, por ejemplo 3001234567.' },
  { key: 'correo', label: 'Correo electrónico', step: 1, required: true, parse: parseCorreo,
    ask: () => '¿Cuál es tu correo electrónico?' },
  { key: 'tieneRut', label: '¿Tiene RUT?', step: 1, required: false, options: SI_NO,
    parse: parseOption(SI_NO, 'Responde sí o no.'),
    ask: () => '¿Tienes RUT (Registro Único Tributario)?' },
  { key: 'comoSeEntero', label: '¿Cómo te enteraste de neocrédito?', step: 1, required: false, options: CANALES,
    parse: parseOption(CANALES, 'Elige una de las opciones o escribe "Otro".'),
    ask: () => '¿Cómo te enteraste de Neocrédito?' },

  { key: 'departamento', label: 'Departamento donde está tu negocio', step: 2, required: true, parse: parseDepartamento,
    ask: () => 'Listo la información general. Ahora vamos con tu negocio: ¿en qué departamento está?' },
  { key: 'ciudad', label: 'Ciudad donde está tu negocio', step: 2, required: true, parse: parseCiudad,
    ask: (d) => `¿En qué ciudad o municipio de ${d.departamento} está tu negocio?` },
  { key: 'medioContacto', label: '¿Cómo deseas ser contactado?', step: 2, required: true, options: MEDIOS_CONTACTO,
    parse: parseOption(MEDIOS_CONTACTO, 'Elige WhatsApp, llamada o correo electrónico.'),
    ask: () => '¿Cómo prefieres que te contacten?' },
  { key: 'perteneceMinoria', label: '¿Pertenece a alguna minoría?', step: 2, required: false, options: SI_NO,
    parse: parseOption(SI_NO, 'Responde sí o no.'),
    ask: () => '¿Perteneces a alguna minoría (por ejemplo, grupo étnico o población víctima)? Esta pregunta es opcional.' },
  { key: 'actividadEconomica', label: 'Actividad económica', step: 2, required: true, parse: parseActividad,
    ask: () => '¿A qué se dedica tu negocio? Cuéntamelo con tus palabras, o escribe el código CIIU si lo conoces.' },
  { key: 'anioVentas', label: 'Año de ventas', step: 2, required: true, parse: parseAnio,
    ask: () => '¿De qué año son las ventas que vas a reportar?' },
  { key: 'ventasUltimoAnio', label: 'Ventas del último año', step: 2, required: true, parse: parseVentas,
    ask: (d) => `¿Cuánto vendió tu negocio en ${d.anioVentas || 'ese año'}? Escribe la cifra en pesos, por ejemplo 10.000.000 o "10 millones".` },
  { key: 'aceptaPoliticaDatos', label: 'Acepta la política de tratamiento de datos personales', step: 2, required: true,
    parse: parseConsent('la política de tratamiento de datos personales'),
    ask: () => `Casi terminamos. ¿Aceptas la [política de tratamiento de datos personales](${LINKS.politicaDatos})?` },
  { key: 'aceptaTerminos', label: 'Acepta los términos y condiciones', step: 2, required: true,
    parse: parseConsent('los términos y condiciones'),
    ask: () => `¿Y aceptas los [términos y condiciones](${LINKS.terminos}) de Neocrédito?` },
];

export const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

// Si cambia un campo, estos dependientes dejan de ser válidos.
const DEPENDENTS = {
  tipoDocumento: ['numeroDocumento', 'confirmacionDocumento'],
  numeroDocumento: ['confirmacionDocumento'],
  departamento: ['ciudad'],
  anioVentas: [],
};

export function emptyState() {
  return { data: {}, skipped: [], awaiting: FIELDS[0].key, readyToConfirm: false, finalized: false, radicado: null };
}

// Revalida el estado recibido del navegador: nunca se confía en él.
export function sanitizeState(raw) {
  const state = emptyState();
  if (!raw || typeof raw !== 'object') return state;
  const inData = raw.data && typeof raw.data === 'object' ? raw.data : {};
  for (const f of FIELDS) {
    if (inData[f.key] === undefined || inData[f.key] === null) continue;
    const value = f.key === 'actividadEconomica' ? String(inData[f.key]).slice(0, 4) : inData[f.key];
    const r = f.parse(value, state.data, f);
    if (r.ok) state.data[f.key] = r.value;
  }
  state.skipped = Array.isArray(raw.skipped)
    ? raw.skipped.filter((k) => FIELD_BY_KEY[k] && !FIELD_BY_KEY[k].required && state.data[k] === undefined) : [];
  state.readyToConfirm = Boolean(raw.readyToConfirm) && pendingFields(state).length === 0;
  state.finalized = Boolean(raw.finalized) && pendingFields(state).length === 0;
  state.radicado = state.finalized && typeof raw.radicado === 'string' ? raw.radicado.slice(0, 40) : null;
  const awaiting = typeof raw.awaiting === 'string' ? raw.awaiting : null;
  state.awaiting = awaiting && (FIELD_BY_KEY[awaiting] || ['confirm', 'correct', 'done'].includes(awaiting))
    ? awaiting : (pendingFields(state)[0]?.key || 'confirm');
  return state;
}

/**
 * Aplica actualizaciones {campo: valor} en el orden del formulario.
 * Devuelve { saved: [...], errors: [{key, error, suggestions}] }.
 */
export function applyUpdates(state, updates, { blockSameBatchConfirmation = false } = {}) {
  const saved = [];
  const errors = [];
  for (const f of FIELDS) {
    if (!(f.key in updates)) continue;
    const raw = updates[f.key];
    if (f.key === 'confirmacionDocumento' && blockSameBatchConfirmation && 'numeroDocumento' in updates) {
      errors.push({ key: f.key, error: 'La confirmación debe escribirla el usuario en un mensaje aparte. Pídesela.' });
      continue;
    }
    if (raw === null || raw === SKIP || SKIP_WORDS.includes(norm(raw))) {
      if (f.required) errors.push({ key: f.key, error: `${f.label} es obligatorio y no se puede omitir.` });
      else {
        delete state.data[f.key];
        if (!state.skipped.includes(f.key)) state.skipped.push(f.key);
        saved.push(f.key);
      }
      continue;
    }
    const r = f.parse(raw, state.data, f);
    if (!r.ok) { errors.push({ key: f.key, error: r.error, suggestions: r.suggestions }); continue; }
    const changed = state.data[f.key] !== r.value;
    state.data[f.key] = r.value;
    state.skipped = state.skipped.filter((k) => k !== f.key);
    if (changed) for (const dep of DEPENDENTS[f.key] || []) delete state.data[dep];
    saved.push(f.key);
  }
  if (Object.keys(updates).length) state.readyToConfirm = false;
  return { saved, errors };
}

export function pendingFields(state) {
  return FIELDS.filter((f) => state.data[f.key] === undefined && !state.skipped.includes(f.key));
}

export function missingRequired(state) {
  return FIELDS.filter((f) => f.required && state.data[f.key] === undefined);
}

export function currentStep(state) {
  return pendingFields(state)[0]?.step ?? 2;
}

export function displayValue(key, value) {
  if (value === undefined || value === null) return '';
  if (key === 'ventasUltimoAnio') return formatCOP(value);
  if (key === 'aceptaPoliticaDatos' || key === 'aceptaTerminos') return value ? 'Sí' : 'No';
  return String(value);
}

export function summaryText(state) {
  const lines = [];
  for (const step of [1, 2]) {
    lines.push(`**${STEPS[step]}**`);
    for (const f of FIELDS.filter((x) => x.step === step && !x.key.startsWith('acepta') && x.key !== 'confirmacionDocumento')) {
      const v = state.data[f.key];
      lines.push(`${f.label}: ${v === undefined ? 'Sin responder' : displayValue(f.key, v)}`);
    }
  }
  return lines.join('\n');
}

export function suggestionsFor(state, fieldKey) {
  const f = FIELD_BY_KEY[fieldKey];
  if (!f) return [];
  let chips = [];
  if (f.options) chips = f.options.map((o) => o.value);
  else if (f.key === 'departamento') chips = DEPARTAMENTOS_FRECUENTES;
  else if (f.key === 'ciudad' && state.data.departamento) chips = DEPARTAMENTOS[state.data.departamento];
  else if (f.key === 'actividadEconomica') chips = CIIU_FRECUENTES.map((code) => ciiuChip(CIIU.find((c) => c.codigo === code)));
  else if (f.key === 'anioVentas') chips = aniosVentas();
  else if (f.key.startsWith('acepta')) chips = ['Acepto', 'No acepto'];
  if (!f.required) chips = [...chips, 'Omitir'];
  return chips.map((c) => (typeof c === 'string' ? { label: c, value: c } : c));
}

export function publicState(state) {
  const visible = FIELDS.filter((f) => f.key !== 'confirmacionDocumento');
  const pending = new Set(pendingFields(state).map((f) => f.key));
  return {
    ...state,
    step: currentStep(state),
    progress: { done: visible.filter((f) => !pending.has(f.key)).length, total: visible.length },
  };
}

export function generarRadicado(now = new Date()) {
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `NEO-${ymd}-${rand}`;
}

export function buildSubmission(state) {
  const d = state.data;
  return {
    tipoPersona: 'persona natural',
    informacionGeneral: {
      primerNombre: d.primerNombre,
      primerApellido: d.primerApellido,
      tipoDocumento: d.tipoDocumento,
      numeroDocumento: d.numeroDocumento,
      genero: d.genero,
      celular: d.celular,
      correo: d.correo,
      tieneRut: d.tieneRut ?? null,
      comoSeEntero: d.comoSeEntero ?? null,
    },
    informacionFinanciera: {
      departamento: d.departamento,
      ciudad: d.ciudad,
      medioContacto: d.medioContacto,
      perteneceMinoria: d.perteneceMinoria ?? null,
      actividadEconomica: d.actividadEconomica,
      anioVentas: d.anioVentas,
      ventasUltimoAnio: d.ventasUltimoAnio,
    },
    aceptaPoliticaDatos: d.aceptaPoliticaDatos === true,
    aceptaTerminos: d.aceptaTerminos === true,
  };
}
