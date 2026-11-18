Object.assign(process.env, { JWT_SECRET: 'test-secret-test-secret', DB_HOST: '127.0.0.1', DB_PORT: '1', DB_USER: 'x', DB_NAME: 'x_test', LOGIN_MAX: '4', CORS_ORIGINS: 'http://localhost:3000' });
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const cp = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const app = require('../src/app');
let srv, base;
before(() => new Promise(resolve => {
  srv = app.listen(0, () => { base = `http://127.0.0.1:${srv.address().port}/api`; resolve(); });
}));
after(() => srv.close());
const token = payload => jwt.sign(payload, process.env.JWT_SECRET);
const client = token({ id: 2, storeId: 1, role: 'CLIENTE', customerId: 5 });
const admin = token({ id: 1, storeId: 1, role: 'ADMIN' });
const root = token({ id: 1, storeId: null, role: 'SUPERADMIN' });
const call = async (method, endpoint, body, bearer, headers = {}) => {
  const response = await fetch(base + endpoint, { method,
    headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...headers },
    body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json().catch(() => null), headers: response.headers };
};

test('sin token, token inválido o firmado con otra clave → 401', async () => {
  for (const [method, endpoint] of [['GET', '/me'], ['GET', '/customers'], ['POST', '/customers'], ['POST', '/sales'], ['POST', '/payments'], ['GET', '/statement/1']]) {
    assert.equal((await call(method, endpoint, {})).status, 401, method + endpoint);
    assert.equal((await call(method, endpoint, {}, 'basura')).status, 401);
  }
  const forged = jwt.sign({ id: 1, storeId: 1, role: 'ADMIN' }, 'otra-clave-distinta-123');
  assert.equal((await call('GET', '/customers', null, forged)).status, 401);
});
test('solo SUPERADMIN accede a las rutas globales', async () => {
  for (const [method, endpoint] of [['GET', '/platform/stores'], ['GET', '/platform/accounts'], ['PATCH', '/platform/accounts/1'], ['DELETE', '/platform/accounts/1']]) {
    assert.equal((await call(method, endpoint, {}, client)).status, 403);
    assert.equal((await call(method, endpoint, {}, admin)).status, 403);
  }
});
test('CLIENTE no puede registrar clientes, productos, ventas ni pagos', async () => {
  for (const [method, endpoint] of [['POST', '/customers'], ['POST', '/sales'], ['POST', '/sales/preview'], ['POST', '/payments'], ['POST', '/products']]) {
    assert.equal((await call(method, endpoint, {}, client)).status, 403);
  }
});
test('registro valida el documento, giro, email, contraseña y DNI del titular', async () => {
  const valid = { tipoDocumento: 'RUC', documento: '20123456789', dniPersonal: '12345678',
    nombre: 'Bodega', giro: 'Bodega', email: 'a@b.pe', password: 'Clave-segura-1' };
  for (const patch of [
    { documento: '2012345678' }, { documento: '2012345678a' }, { tipoDocumento: 'DNI', documento: '1234567' },
    { tipoDocumento: 'NIE' }, { email: 'x' }, { password: 'corta' }, { nombre: '' }, { giro: 'No válido' },
    { dniPersonal: '1234567' }, { dniPersonal: undefined },
  ]) {
    assert.equal((await call('POST', '/auth/register-store', { ...valid, ...patch })).status, 400);
  }
  const personal = { tipoDocumento: 'DNI', documento: '12345678', nombre: 'Negocio personal',
    giro: 'Bazar', email: 'persona@test.pe', password: 'Clave-segura-1' };
  assert.equal((await call('POST', '/auth/register-store', personal)).status, 500);
});
test('login por email valida los datos y limita intentos', async () => {
  for (const body of [{}, { email: 'mal', password: 'Clave-segura-1' }, { email: 'a@b.pe', password: '' }]) {
    assert.equal((await call('POST', '/auth/login', body)).status, 400);
  }
  assert.notEqual((await call('POST', '/auth/login', {})).status, 429);
  assert.equal((await call('POST', '/auth/login', {})).status, 429);
});
test('login de clientes valida nombre del negocio y DNI personal', async () => {
  for (const body of [
    { nombreNegocio: '', dni: '12345678', password: 'Clave-segura-1' },
    { nombreNegocio: 'Bodega', dni: '1234567', password: 'Clave-segura-1' },
    { nombreNegocio: 'Bodega', dni: '12345678' },
  ]) {
    assert.equal((await call('POST', '/auth/customer-login', body)).status, 400);
  }
});
test('CORS solo permite orígenes configurados', async () => {
  const allowed = await call('GET', '/me', null, null, { Origin: 'http://localhost:3000' });
  const denied = await call('GET', '/me', null, null, { Origin: 'http://evil.example' });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});
test('arranque falla sin JWT_SECRET ni configuración de BD', () => {
  const result = cp.spawnSync(process.execPath, ['-e', `require(${JSON.stringify(path.resolve(__dirname, '../src/config'))})`],
    { cwd: os.tmpdir(), env: { PATH: process.env.PATH }, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Faltan: JWT_SECRET, DB_HOST, DB_USER, DB_NAME/);
});
