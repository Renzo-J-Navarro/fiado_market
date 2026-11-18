const r = require('express').Router(); const bcrypt = require('bcrypt'); const jwt = require('jsonwebtoken'); const rateLimit = require('express-rate-limit');
const db = require('../db'); const config = require('../config'); const { wrap } = require('../middleware'); const V = require('../validate'); const { sha } = require('../services/tokens');
const limiter = () => rateLimit({ windowMs: 15 * 60 * 1000, limit: config.loginMax, standardHeaders: true, legacyHeaders: false,
  handler: (q, s) => s.status(429).json({ error: 'Demasiados intentos. Intenta de nuevo más tarde.' }) });
const businessDocument = (type, value) => {
  const tipo = V.oneOf(type, 'tipo de documento', ['DNI', 'RUC']);
  const digits = tipo === 'RUC' ? 11 : 8;
  return { tipo, numero: V.str(value, tipo, { re: new RegExp(`^\\d{${digits}}$`), msg: `${tipo} debe tener ${digits} dígitos` }) };
};
const sign = (u, role, customerId, tipoDocumento) => jwt.sign({
  id: u.id, storeId: u.store_id ?? null, role, customerId: customerId ?? null, tipoDocumento: tipoDocumento ?? null,
}, config.jwtSecret, { expiresIn: '8h', algorithm: 'HS256' });
const DUMMY = bcrypt.hashSync('dummy-password', 10);

r.post('/register-store', wrap(async (q, s) => {
  const b = q.body || {};
  const doc = businessDocument(b.tipoDocumento, b.documento);
  const nombre = V.str(b.nombre, 'nombre', { max: 120 });
  const giro = V.oneOf(b.giro, 'giro', ['Bodega', 'Carnicería', 'Peluquería', 'Bazar', 'Minimarket', 'Ferretería', 'Restaurante', 'Otro']);
  const email = V.email(b.email);
  const password = V.password(b.password);
  const dniPersonal = doc.tipo === 'RUC'
    ? V.str(b.dniPersonal, 'DNI personal', { re: /^\d{8}$/, msg: 'El DNI personal debe tener 8 dígitos' })
    : null;
  const hash = await bcrypt.hash(password, 10);
  const result = await db.tx(async c => {
    const [[reserved]] = await c.query('SELECT id FROM platform_admins WHERE email=? OR (tipo_documento=? AND documento=?)', [email, doc.tipo, doc.numero]);
    if (reserved) throw new V.HttpError(409, 'El correo o documento ya está reservado');
    const [store] = await c.query(`INSERT INTO stores(ruc,tipo_documento,documento,owner_dni,nombre_comercial,giro,contact_email,status)
      VALUES(?,?,?,?,?,?,?,'ACTIVE')`, [doc.tipo === 'RUC' ? doc.numero : null, doc.tipo, doc.numero, dniPersonal, nombre, giro, email]);
    const [user] = await c.query('INSERT INTO users(store_id,email,password_hash,role,active) VALUES(?,?,?,"ADMIN",TRUE)',
      [store.insertId, email, hash]);
    return { userId: user.insertId, storeId: store.insertId };
  });
  const token = sign({ id: result.userId, store_id: result.storeId }, 'ADMIN', null, doc.tipo);
  s.status(201).json({ token, role: 'ADMIN', storeId: result.storeId, tipoDocumento: doc.tipo });
}));

r.post('/login', limiter(), wrap(async (q, s) => {
  const b = q.body || {};
  const email = V.email(b.email);
  const password = V.str(b.password, 'contraseña', { max: 72 });
  const [[platformAdmin]] = await db.query('SELECT id,email,password_hash FROM platform_admins WHERE email=?', [email]);
  if (platformAdmin) {
    const ok = await bcrypt.compare(password, platformAdmin.password_hash);
    if (!ok) throw new V.HttpError(401, 'Credenciales inválidas');
    return s.json({ token: sign({ id: platformAdmin.id }, 'SUPERADMIN'), role: 'SUPERADMIN' });
  }
  const [[user]] = await db.query(`SELECT u.*,s.tipo_documento FROM users u JOIN stores s ON s.id=u.store_id
    WHERE u.email=? AND u.active=TRUE AND s.status='ACTIVE'`, [email]);
  const ok = await bcrypt.compare(password, user?.password_hash || DUMMY);
  if (!user || !user.password_hash || !ok) throw new V.HttpError(401, 'Credenciales inválidas');
  s.json({ token: sign(user, user.role, user.customer_id, user.tipo_documento), role: user.role,
    customerId: user.customer_id, storeId: user.store_id, tipoDocumento: user.tipo_documento });
}));

r.post('/customer-login', limiter(), wrap(async (q, s) => {
  const b = q.body || {};
  const password = V.str(b.password, 'contraseña', { max: 72 });
  const nombreNegocio = V.str(b.nombreNegocio, 'nombre del negocio', { max: 120 });
  const dni = V.str(b.dni, 'DNI personal', { re: /^\d{8}$/, msg: 'DNI debe tener 8 dígitos' });
  const [users] = await db.query(`SELECT u.*,c.id customer_id,s.tipo_documento FROM customers c
    JOIN stores s ON s.id=c.store_id JOIN users u ON u.id=c.user_id
    WHERE s.nombre_comercial=? AND c.dni=? AND u.active=TRUE AND s.status='ACTIVE'`,
    [nombreNegocio, dni]);
  const matches = [];
  for (const user of users.length ? users : [{ password_hash: null }]) {
    if (await bcrypt.compare(password, user.password_hash || DUMMY) && user.password_hash) matches.push(user);
  }
  if (!matches.length) throw new V.HttpError(401, 'Credenciales inválidas');
  if (matches.length > 1) throw new V.HttpError(409, 'Hay más de un negocio con esos datos. Contacta al negocio para verificar el nombre.');
  const [user] = matches;
  s.json({ token: sign(user, 'CLIENTE', user.customer_id, user.tipo_documento), role: 'CLIENTE',
    customerId: user.customer_id, storeId: user.store_id, tipoDocumento: user.tipo_documento });
}));

r.post('/set-password', limiter(), wrap(async (q, s) => {
  const b = q.body || {};
  const token = V.str(b.token, 'token', { min: 64, max: 64, re: /^[0-9a-f]{64}$/, msg: 'Enlace inválido o vencido' });
  const t = (await db.query(`SELECT t.user_id,c.dni FROM password_tokens t
    JOIN customers c ON c.user_id=t.user_id JOIN users u ON u.id=t.user_id
    JOIN stores st ON st.id=u.store_id
    WHERE t.token_hash=? AND t.used_at IS NULL AND t.expires_at>NOW() AND u.active=1 AND st.status='ACTIVE'`, [sha(token)]))[0][0];
  if (!t) throw new V.HttpError(400, 'Enlace inválido o vencido');
  const hash = await bcrypt.hash(V.password(b.password, t.dni), 10);
  await db.tx(async c => {
    await c.query('UPDATE users SET password_hash=? WHERE id=?', [hash, t.user_id]);
    await c.query('UPDATE password_tokens SET used_at=NOW() WHERE user_id=? AND used_at IS NULL', [t.user_id]);
  });
  s.json({ ok: true });
}));
module.exports = r;
