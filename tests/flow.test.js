import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, applyUpdates, parseMoney, sanitizeState, pendingFields, findDepartamento, searchCiiu, aniosVentas,
} from '../lib/form.js';
import { handleGuided } from '../lib/guided.js';

test('parseMoney entiende formatos colombianos', () => {
  assert.equal(parseMoney('10.000.000'), 10000000);
  assert.equal(parseMoney('10,000,000'), 10000000);
  assert.equal(parseMoney('$ 10 millones'), 10000000);
  assert.equal(parseMoney('2,5 millones'), 2500000);
  assert.equal(parseMoney('800 mil'), 800000);
  assert.equal(parseMoney('15M'), 15000000);
  assert.equal(parseMoney('1.200 millones'), 1200000000);
});

test('validaciones de datos generales', () => {
  const s = emptyState();
  const { errors } = applyUpdates(s, {
    tipoDocumento: 'cc', numeroDocumento: '110.367.969', celular: '+57 333 724 8489', correo: 'Correo@Ejemplo.com',
  });
  assert.deepEqual(errors, []);
  assert.equal(s.data.tipoDocumento, 'CÉDULA DE CIUDADANÍA');
  assert.equal(s.data.numeroDocumento, '110367969');
  assert.equal(s.data.celular, '3337248489');
  assert.equal(s.data.correo, 'correo@ejemplo.com');

  assert.equal(applyUpdates(s, { confirmacionDocumento: '110367968' }).errors.length, 1);
  assert.equal(applyUpdates(s, { confirmacionDocumento: '110367969' }).errors.length, 0);
  // cambiar el número invalida la confirmación
  applyUpdates(s, { numeroDocumento: '12345678' });
  assert.equal(s.data.confirmacionDocumento, undefined);
  assert.equal(applyUpdates(s, { celular: '6021234567' }).errors.length, 1);
});

test('la IA no puede llenar la confirmación en la misma llamada', () => {
  const s = emptyState();
  const r = applyUpdates(s, { numeroDocumento: '12345678', confirmacionDocumento: '12345678' }, { blockSameBatchConfirmation: true });
  assert.equal(r.errors[0].key, 'confirmacionDocumento');
});

test('catálogos: departamentos y CIIU', () => {
  assert.equal(findDepartamento('valle'), 'Valle del Cauca');
  assert.equal(findDepartamento('Bogota'), 'Bogotá D.C.');
  assert.equal(searchCiiu('tengo una tienda de barrio')[0].codigo, '4711');
  assert.equal(searchCiiu('2620')[0].codigo, '2620');
  assert.equal(searchCiiu('peluquería')[0].codigo, '9602');
});

test('sanitizeState descarta datos manipulados', () => {
  const s = sanitizeState({ data: { correo: 'no-es-correo', celular: '3001234567', aceptaTerminos: 'tal vez' }, finalized: true, radicado: 'X' });
  assert.equal(s.data.correo, undefined);
  assert.equal(s.data.celular, '3001234567');
  assert.equal(s.data.aceptaTerminos, undefined);
  assert.equal(s.finalized, false);
});

test('flujo guiado completo hasta el radicado', async () => {
  const state = emptyState();
  const year = aniosVentas()[0];
  const answers = [
    'Domiciano', 'Rincon', 'Cédula de ciudadanía', '110367969', '110367969', 'Masculino',
    '3337248489', 'persona@ejemplo.com', 'No', 'Eventos',
    'Valle', 'Cali', 'WhatsApp', 'No', '2620', year, '10.000.000', 'Acepto', 'Acepto',
  ];
  for (const a of answers) {
    const before = state.awaiting;
    const r = await handleGuided(state, a);
    assert.notEqual(state.awaiting, before, `no avanzó con "${a}": ${r.reply}`);
  }
  assert.equal(pendingFields(state).length, 0);
  assert.equal(state.awaiting, 'confirm');
  assert.equal(state.data.ciudad, 'CALI');
  assert.match(state.data.actividadEconomica, /^2620 - Fabricación de computadoras/);

  // corrección antes de finalizar
  let r = await handleGuided(state, 'Corregir correo electrónico');
  assert.equal(state.awaiting, 'correo');
  r = await handleGuided(state, 'nuevo@ejemplo.com');
  assert.equal(state.awaiting, 'confirm');

  r = await handleGuided(state, 'Sí, finalizar registro');
  assert.ok(state.finalized);
  assert.match(state.radicado, /^NEO-\d{8}-[A-Z0-9]+$/);
  assert.match(r.reply, /radicado/);
});

test('campos opcionales se pueden omitir, obligatorios no', async () => {
  const s = emptyState();
  assert.equal(applyUpdates(s, { comoSeEntero: 'Omitir' }).errors.length, 0);
  assert.ok(s.skipped.includes('comoSeEntero'));
  assert.equal(applyUpdates(s, { correo: 'omitir' }).errors.length, 1);
});
