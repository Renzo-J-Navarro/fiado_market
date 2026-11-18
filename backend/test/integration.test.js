// Requiere MySQL y una BD *_test: `npm run test:integration` usa .env.test y recrea la BD.
const { test, before, after } = require('node:test'); const assert = require('node:assert/strict');
assert.ok(/_test$/.test(process.env.DB_NAME || ''), 'Solo se ejecuta contra una BD *_test');
const bcrypt = require('bcrypt'); const app = require('../src/app'); const db = require('../src/db'); const V = require('../src/validate');
let srv, base; const S = {};
before(async () => {
  const hash = await bcrypt.hash('Platform-test-password-9', 4);
  await db.query("INSERT INTO platform_admins(id,tipo_documento,documento,email,password_hash) VALUES(1,'DNI','87654321','platform@test.pe',?)", [hash]);
  await new Promise(resolve => { srv = app.listen(0, () => { base = `http://127.0.0.1:${srv.address().port}/api`; resolve(); }); });
});
after(async () => { srv.close(); await db.end(); });
const call = async (method, path, body, token) => {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: body && method !== 'GET' ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json().catch(() => null) };
};
const registration = (tipoDocumento, documento, email, extra = {}) => ({
  tipoDocumento, documento, nombre: `Negocio ${email}`, giro: 'Bodega', email,
  password: 'Clave-segura-1', ...(tipoDocumento === 'RUC' ? { dniPersonal: '12345678' } : {}), ...extra,
});
const customer = (dni, overrides = {}) => ({
  nombre: `Cliente ${dni}`, dni, lmc: 500, diaCorte: 30, diaPago: 30, tipoTasa: 'TEA',
  tasa: 60, tasaMora: 10, moneda: 'PEN', plazoMax: 3, ...overrides,
});

test('registro RUC y DNI crea cuentas activas con correo y contraseña', async () => {
  const ruc = await call('POST', '/auth/register-store', registration('RUC', '20100000001', 'ruc@test.pe'));
  assert.equal(ruc.status, 201); assert.equal(ruc.body.role, 'ADMIN'); assert.equal(ruc.body.tipoDocumento, 'RUC'); S.RUC = ruc.body.token;
  const dni = await call('POST', '/auth/register-store', registration('DNI', '12345678', 'dni@test.pe'));
  assert.equal(dni.status, 201); assert.equal(dni.body.role, 'ADMIN'); assert.equal(dni.body.tipoDocumento, 'DNI'); S.DNI = dni.body.token;
  assert.equal((await call('POST', '/auth/login', { email: 'ruc@test.pe', password: 'Clave-segura-1' })).status, 200);
  const personalLogin = await call('POST', '/auth/login', { email: 'dni@test.pe', password: 'Clave-segura-1' });
  assert.equal(personalLogin.status, 200); assert.equal(personalLogin.body.tipoDocumento, 'DNI');
  assert.equal((await call('POST', '/auth/register-store', registration('RUC', '20100000001', 'otra@test.pe'))).status, 409);
  assert.equal((await call('POST', '/auth/register-store', registration('RUC', '20100000002', 'ruc@test.pe'))).status, 409);
});
test('validaciones de registro requieren contraseña y DNI del titular con RUC', async () => {
  const valid = registration('RUC', '20100000003', 'valid@test.pe');
  for (const patch of [{ password: 'corta' }, { giro: 'No listado' }, { documento: '2010000000a' }, { dniPersonal: '1234567' }]) {
    assert.equal((await call('POST', '/auth/register-store', { ...valid, ...patch })).status, 400);
  }
});
test('el usuario comercial puede gestionar clientes, productos, ventas y cobros', async () => {
  const who = await call('GET', '/me', null, S.RUC);
  assert.equal(who.status, 200); assert.equal(who.body.email, 'ruc@test.pe'); assert.equal(who.body.ownerDni, '12345678');
  const madeCustomer = await call('POST', '/customers', customer('33333333'), S.RUC);
  assert.equal(madeCustomer.status, 201); S.CUSTOMER = madeCustomer.body.id;
  assert.equal((await call('POST', '/customers', customer('33333333'), S.RUC)).status, 409);
  const customers = await call('GET', '/customers', null, S.RUC);
  assert.equal(customers.status, 200); assert.equal(Number(customers.body[0].disponible), 500);
  assert.equal((await call('POST', '/auth/set-password', { token: madeCustomer.body.setupToken, password: 'Clave-cliente-7' })).status, 200);
  assert.equal((await call('POST', '/auth/set-password', { token: madeCustomer.body.setupToken, password: 'Otra-clave-8' })).status, 400);
  const client = await call('POST', '/auth/customer-login', {
    nombreNegocio: 'Negocio ruc@test.pe', dni: '33333333', password: 'Clave-cliente-7',
  });
  assert.equal(client.status, 200); assert.equal(client.body.role, 'CLIENTE'); S.CLIENT = client.body.token;
  assert.equal((await call('POST', '/auth/customer-login', {
    tipoDocumento: 'RUC', documento: '20100000001', dni: '33333333', password: 'Clave-cliente-7',
  })).status, 400);
  const duplicateStore = await call('POST', '/auth/register-store',
    registration('RUC', '20100000005', 'duplicate@test.pe', { nombre: 'Negocio ruc@test.pe' }));
  assert.equal(duplicateStore.status, 201);
  const duplicateCustomer = await call('POST', '/customers', customer('33333333'), duplicateStore.body.token);
  assert.equal(duplicateCustomer.status, 201);
  assert.equal((await call('POST', '/auth/set-password', {
    token: duplicateCustomer.body.setupToken, password: 'Clave-cliente-7',
  })).status, 200);
  assert.equal((await call('POST', '/auth/customer-login', {
    nombreNegocio: 'Negocio ruc@test.pe', dni: '33333333', password: 'Clave-cliente-7',
  })).status, 409);
  const product = await call('POST', '/products', { nombre: 'Arroz', precioContado: 10, precioLista: 12 }, S.RUC);
  assert.equal(product.status, 201); S.PRODUCT = product.body.id;
  const preview = await call('POST', '/sales/preview', {
    customerId: S.CUSTOMER, productId: S.PRODUCT, fechaCompra: V.today(), plazo: 1, cantidad: 2,
  }, S.RUC);
  assert.equal(preview.status, 200); assert.equal(preview.body.amount, 24); assert.equal(preview.body.quantity, 2);
  assert.equal((await call('POST', '/sales/preview', {
    customerId: S.CUSTOMER, productId: S.PRODUCT, fechaCompra: V.today(), plazo: 1, cantidad: 42,
  }, S.RUC)).status, 422);
  const sale = await call('POST', '/sales', { customerId: S.CUSTOMER, productId: S.PRODUCT, fechaCompra: V.today(), plazo: 1, cantidad: 2 }, S.RUC);
  assert.equal(sale.status, 201);
  const recent = await call('GET', '/sales/recent', null, S.RUC);
  assert.equal(recent.status, 200); assert.equal(recent.body[0].cantidad, 2); assert.equal(recent.body[0].producto, 'Arroz');
  const statement = await call('GET', `/statement/${S.CUSTOMER}`, null, S.RUC);
  assert.equal(statement.status, 200); assert.equal(statement.body.totales.capital, 24);
  assert.equal(statement.body.detalle[0].cantidad, 2); assert.equal(statement.body.detalle[0].producto, 'Arroz');
  assert.ok('totalFecha' in statement.body.totales);
  assert.equal(statement.body.totales.totalFecha,
    Number((statement.body.totales.deudaExigible + statement.body.totales.moraFecha).toFixed(2)));
  assert.equal((await call('GET', '/statement/me', null, S.CLIENT)).status, 200);
  assert.equal((await call('POST', '/payments', { customerId: S.CUSTOMER, fecha: V.today(), monto: 1 }, S.CLIENT)).status, 403);
});
test('el administrador global lista, desactiva y no puede borrar historiales financieros', async () => {
  const admin = await call('POST', '/auth/login', { email: 'platform@test.pe', password: 'Platform-test-password-9' });
  assert.equal(admin.status, 200); assert.equal(admin.body.role, 'SUPERADMIN'); S.ROOT = admin.body.token;
  const accounts = await call('GET', '/platform/accounts', null, S.ROOT);
  assert.equal(accounts.status, 200);
  const commerce = accounts.body.find(account => account.email === 'ruc@test.pe');
  assert.ok(commerce); assert.equal(commerce.documento, '20100000001'); assert.equal(commerce.owner_dni, '12345678');
  const preview = await call('POST', `/platform/stores/${commerce.storeId}/assume`, {}, S.ROOT);
  assert.equal(preview.status, 200); assert.equal(preview.body.platformAdmin, true);
  const previewProfile = await call('GET', '/me', null, preview.body.token);
  assert.equal(previewProfile.status, 200); assert.equal(previewProfile.body.platformAdmin, true);
  assert.equal((await call('GET', '/customers', null, preview.body.token)).status, 200);
  assert.equal((await call('DELETE', `/platform/accounts/${commerce.id}`, null, S.ROOT)).status, 409);
  assert.equal((await call('PATCH', `/platform/accounts/${commerce.id}`, { active: false }, S.ROOT)).status, 200);
  assert.equal((await call('POST', '/auth/login', { email: 'ruc@test.pe', password: 'Clave-segura-1' })).status, 401);
  assert.equal((await call('GET', '/customers', null, preview.body.token)).status, 401);
  assert.equal((await call('PATCH', `/platform/accounts/${commerce.id}`, { active: true }, S.ROOT)).status, 200);
  assert.equal((await call('GET', '/customers', null, preview.body.token)).status, 200);
  assert.equal((await call('POST', '/auth/login', { email: 'ruc@test.pe', password: 'Clave-segura-1' })).status, 200);
  const changed = await call('PATCH', `/platform/stores/${commerce.storeId}`, {
    tipoDocumento: 'RUC', documento: '20100000004',
  }, S.ROOT);
  assert.equal(changed.status, 200);
  assert.equal((await call('POST', '/auth/login', { email: 'ruc@test.pe', password: 'Clave-segura-1' })).status, 200);
});
test('el administrador global elimina una cuenta sin movimientos y bloquea roles no autorizados', async () => {
  const accounts = await call('GET', '/platform/accounts', null, S.ROOT);
  const personal = accounts.body.find(account => account.email === 'dni@test.pe');
  assert.ok(personal);
  assert.equal((await call('PATCH', `/platform/accounts/${personal.id}`, { active: false, role: 'SUPERADMIN' }, S.ROOT)).status, 400);
  assert.equal((await call('DELETE', `/platform/accounts/${personal.id}`, null, S.ROOT)).status, 200);
  assert.equal((await call('POST', '/auth/login', { email: 'dni@test.pe', password: 'Clave-segura-1' })).status, 401);
});
