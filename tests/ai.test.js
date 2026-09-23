import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.ANTHROPIC_API_KEY = 'test-key';
const { handleAI } = await import('../lib/ai.js');
const { emptyState } = await import('../lib/form.js');

function mockClaude(responses) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(JSON.parse(init.body));
    const body = responses.shift();
    return { ok: true, json: async () => body };
  };
  return calls;
}

test('la IA guarda varios datos en una sola llamada y responde', async () => {
  const calls = mockClaude([
    { stop_reason: 'tool_use', content: [
      { type: 'tool_use', id: 't1', name: 'guardar_datos', input: { campos: { primerNombre: 'domiciano', primerApellido: 'rincón' } } },
    ] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Gracias, Domiciano. ¿Qué tipo de documento tienes?' }] },
  ]);
  const state = emptyState();
  const r = await handleAI(state, 'Me llamo Domiciano Rincón', []);
  assert.equal(state.data.primerNombre, 'Domiciano');
  assert.equal(state.data.primerApellido, 'Rincón');
  assert.equal(state.awaiting, 'tipoDocumento');
  assert.ok(r.suggestions.some((s) => s.value === 'CÉDULA DE CIUDADANÍA'));
  assert.match(r.reply, /tipo de documento/);
  // el segundo request incluye el tool_result
  const last = calls[1].messages.at(-1);
  assert.equal(last.content[0].type, 'tool_result');
  assert.equal(calls[0].model.length > 0, true);
});

test('finalizar_registro se rechaza si el resumen no se mostró antes', async () => {
  const calls = mockClaude([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'finalizar_registro', input: { confirmado_por_usuario: true } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Aún faltan datos.' }] },
  ]);
  const state = emptyState();
  await handleAI(state, 'finaliza ya', []);
  assert.equal(state.finalized, false);
  const result = JSON.parse(calls[1].messages.at(-1).content[0].content);
  assert.equal(result.ok, false);
});
