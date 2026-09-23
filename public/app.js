const STORAGE_KEY = 'neocredito-chat-v1';
const API = '/api/chat';

const $ = (id) => document.getElementById(id);
const els = {
  messages: $('messages'), chips: $('chips'), composer: $('composer'), input: $('input'), send: $('send'),
  reset: $('reset'), mode: $('mode'), steps: $('steps'), radicado: $('radicado'),
  progressText: $('progressText'), progressFill: $('progressFill'),
  progressTextMobile: $('progressTextMobile'), progressFillMobile: $('progressFillMobile'),
  panel: $('formPanel'), toggle: $('progressToggle'), panelClose: $('panelClose'),
};

if (new URLSearchParams(location.search).has('embed')) document.body.classList.add('embed');

let session = null; // { state, form, display, history, suggestions, mode }
let busy = false;

// ---------- utilidades ----------

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Markdown mínimo y seguro: **negrita**, [texto](https://...), saltos de línea.
function renderText(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n/g, '<br>');
}

function save() {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch { /* sin almacenamiento */ }
}
function load() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

async function api(body) {
  const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No hubo respuesta del servidor.');
  return data;
}

// ---------- mensajes ----------

function scrollToEnd() {
  requestAnimationFrame(() => { els.messages.scrollTop = els.messages.scrollHeight; });
}

function addMessage(role, text, animate = true) {
  const div = document.createElement('div');
  div.className = `msg ${role}${animate ? ' new' : ''}`;
  div.innerHTML = renderText(text);
  els.messages.append(div);
  els.messages.scrollTop = els.messages.scrollHeight;
  return div;
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'msg bot typing';
  div.setAttribute('aria-label', 'El asistente está escribiendo');
  div.innerHTML = '<span></span><span></span><span></span>';
  els.messages.append(div);
  els.messages.scrollTop = els.messages.scrollHeight;
  return div;
}

function renderChips(suggestions = []) {
  els.chips.replaceChildren(...suggestions.map((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    if (/finalizar/i.test(s.label)) b.classList.add('primary');
    b.textContent = s.label;
    b.title = s.label;
    b.addEventListener('click', () => (s.action === 'reset' ? reset() : send(s.value)));
    return b;
  }));
}

// Teclado adecuado según el dato que se está pidiendo.
function tuneInput(awaiting) {
  const numeric = ['numeroDocumento', 'confirmacionDocumento', 'celular'];
  els.input.type = awaiting === 'correo' ? 'email' : 'text';
  els.input.inputMode = numeric.includes(awaiting) ? 'numeric' : awaiting === 'ventasUltimoAnio' ? 'decimal' : 'text';
  els.input.autocomplete = awaiting === 'correo' ? 'email' : awaiting === 'celular' ? 'tel' : 'off';
}

function setBusy(value) {
  busy = value;
  els.input.disabled = value;
  els.send.disabled = value;
  els.chips.querySelectorAll('button').forEach((b) => { b.disabled = value; });
  if (!value) els.input.focus({ preventScroll: true });
}

// ---------- panel del formulario ----------

function renderPanel() {
  if (!session?.form) return;
  const { state, form, display } = session;
  const current = state.awaiting === 'confirmacionDocumento' ? 'numeroDocumento' : state.awaiting;
  const { done, total } = state.progress;
  const pct = `${Math.round((done / total) * 100)}%`;
  els.progressText.textContent = state.finalized ? 'Registro enviado' : `${done} de ${total} datos`;
  els.progressTextMobile.textContent = state.finalized ? 'Registro enviado' : `Tu formulario: ${done} de ${total}`;
  els.progressFill.style.width = pct;
  els.progressFillMobile.style.width = pct;

  els.radicado.hidden = !state.finalized;
  if (state.finalized) els.radicado.innerHTML = `Radicado de tu solicitud<strong>${escapeHtml(state.radicado)}</strong>`;

  els.steps.replaceChildren(...Object.entries(form.steps).map(([num, title]) => {
    const fields = form.fields.filter((f) => String(f.step) === num);
    const complete = fields.every((f) => display[f.key] !== undefined || state.skipped.includes(f.key));
    const section = document.createElement('section');
    section.className = `step${complete ? ' done' : ''}${String(state.step) === num && !complete ? ' active' : ''}`;
    section.innerHTML = `<h3><span class="step-num">${num}</span>${escapeHtml(title)}</h3>`;
    const ul = document.createElement('ul');
    ul.className = 'fields';
    for (const f of fields) {
      const li = document.createElement('li');
      const value = display[f.key];
      const skipped = state.skipped.includes(f.key);
      li.className = `field ${value !== undefined ? 'filled' : 'empty'}${f.key === current ? ' current' : ''}`;
      const shown = value !== undefined
        ? (f.key.startsWith('acepta') ? 'Aceptado' : value)
        : skipped ? 'Omitido' : f.key === current ? 'Respondiendo…' : 'Pendiente';
      li.innerHTML = `<span class="field-label">${escapeHtml(f.label)}${f.required ? ' <span class="req" aria-label="obligatorio">*</span>' : ''}</span>
        <span class="field-value">${escapeHtml(String(shown))}</span>`;
      ul.append(li);
    }
    section.append(ul);
    return section;
  }));

  const row = els.steps.querySelector('.field.current');
  if (row && !els.panel.classList.contains('open')) {
    els.panel.scrollTop = Math.max(0, row.offsetTop - els.panel.clientHeight / 2);
  }

  els.mode.hidden = false;
  els.mode.textContent = session.mode === 'ia' ? 'Con IA' : 'Modo guiado';
  tuneInput(state.awaiting);
}

function togglePanel(open) {
  els.panel.classList.toggle('open', open);
  els.toggle.setAttribute('aria-expanded', String(open));
  if (open) els.panelClose.focus();
}

// ---------- flujo ----------

function applyResponse(data) {
  session.state = data.state;
  session.display = data.display || {};
  session.suggestions = data.suggestions || [];
  session.mode = data.mode;
  if (data.form) session.form = data.form;
  session.history.push({ role: 'assistant', text: data.reply });
  addMessage('bot', data.reply);
  renderChips(session.suggestions);
  renderPanel();
  scrollToEnd();
  save();
}

async function start() {
  els.messages.replaceChildren();
  renderChips([]);
  session = { state: null, form: null, display: {}, history: [], suggestions: [], mode: null };
  setBusy(true);
  const typing = showTyping();
  try {
    const data = await api({ action: 'start' });
    typing.remove();
    applyResponse(data);
  } catch (err) {
    typing.remove();
    addMessage('error', `${err.message} Recarga la página para intentarlo de nuevo.`);
  } finally {
    setBusy(false);
  }
}

async function send(text) {
  const message = String(text || '').trim();
  if (!message || busy || !session?.state) return;
  addMessage('user', message);
  const history = session.history.slice();
  session.history.push({ role: 'user', text: message });
  els.input.value = '';
  renderChips([]);
  setBusy(true);
  const typing = showTyping();
  try {
    const data = await api({ message, state: session.state, history });
    typing.remove();
    applyResponse(data);
  } catch (err) {
    typing.remove();
    session.history.pop();
    addMessage('error', `${err.message} Tu mensaje no se envió.`);
    renderChips([{ label: 'Reintentar', value: message }, ...session.suggestions]);
  } finally {
    setBusy(false);
  }
}

function reset() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* nada */ }
  togglePanel(false);
  start();
}

function restore(saved) {
  session = saved;
  for (const h of session.history) addMessage(h.role === 'user' ? 'user' : 'bot', h.text, false);
  renderChips(session.suggestions);
  renderPanel();
  scrollToEnd();
}

// ---------- eventos ----------

els.composer.addEventListener('submit', (e) => {
  e.preventDefault();
  send(els.input.value);
});
els.reset.addEventListener('click', reset);
els.toggle.addEventListener('click', () => togglePanel(!els.panel.classList.contains('open')));
els.panelClose.addEventListener('click', () => { togglePanel(false); els.toggle.focus(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && els.panel.classList.contains('open')) togglePanel(false); });

const saved = load();
if (saved?.state && saved?.form && Array.isArray(saved.history)) restore(saved);
else start();
