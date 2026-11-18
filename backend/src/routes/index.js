const r = require('express').Router(); const db = require('../db'); const svc = require('../services/creditService');
const jwt = require('jsonwebtoken'); const config = require('../config');
const { wrap, auth } = require('../middleware'); const V = require('../validate'); const { issue } = require('../services/tokens'); const ADMIN = auth(['ADMIN']);
const id = (v, n = 'id') => V.num(v, n, { min: 1, int: true });

r.get('/me', auth(['SUPERADMIN', 'ADMIN', 'CLIENTE']), wrap(async (q, s) => {
  if (q.user.role === 'SUPERADMIN') {
    const [[u]] = await db.query('SELECT email,tipo_documento,documento FROM platform_admins WHERE id=?', [q.user.id]);
    return s.json({ role: q.user.role, email: u.email, tipoDocumento: u.tipo_documento, documento: u.documento });
  }
  if (q.user.platformAdmin) {
    const [[u]] = await db.query(`SELECT u.email,s.nombre_comercial,s.tipo_documento,s.documento,s.giro,s.owner_dni
      FROM stores s JOIN users u ON u.store_id=s.id AND u.role='ADMIN' WHERE s.id=?`, [q.user.storeId]);
    if (!u) throw new V.HttpError(404, 'Negocio no encontrado');
    return s.json({ role: 'ADMIN', platformAdmin: true, storeId: q.user.storeId, email: u.email,
      comercio: u.nombre_comercial, giro: u.giro, ownerDni: u.owner_dni, tipoDocumento: u.tipo_documento, documento: u.documento });
  }
  const [[u]] = await db.query(`SELECT u.email,s.nombre_comercial,s.tipo_documento,s.documento,s.giro,s.owner_dni
    FROM users u JOIN stores s ON s.id=u.store_id WHERE u.id=? AND s.id=?`, [q.user.id, q.user.storeId]);
  s.json({ role: q.user.role, storeId: q.user.storeId, customerId: q.user.customerId,
    email: u.email, comercio: u.nombre_comercial, giro: u.giro, ownerDni: u.owner_dni,
    tipoDocumento: u.tipo_documento, documento: u.documento });
}));
 r.get('/platform/stores', auth(['SUPERADMIN']), wrap(async (q, s) => {
  const [stores] = await db.query(`SELECT s.id,s.nombre_comercial,s.giro,s.tipo_documento,s.documento,
    s.owner_dni,s.contact_email,s.status,u.email,u.active,COUNT(DISTINCT c.id) clientes
    FROM stores s LEFT JOIN users u ON u.store_id=s.id AND u.role='ADMIN'
    LEFT JOIN customers c ON c.store_id=s.id
    GROUP BY s.id,s.nombre_comercial,s.giro,s.tipo_documento,s.documento,s.owner_dni,s.contact_email,s.status,u.email,u.active
    ORDER BY s.nombre_comercial`);
  s.json(stores);
}));
r.post('/platform/stores/:id/assume', auth(['SUPERADMIN']), wrap(async (q, s) => {
  const storeId = id(q.params.id);
  const [[account]] = await db.query(`SELECT s.tipo_documento,u.id FROM stores s
    JOIN users u ON u.store_id=s.id AND u.role='ADMIN' WHERE s.id=?`, [storeId]);
  if (!account) throw new V.HttpError(404, 'Negocio sin cuenta de acceso');
  const token = jwt.sign({
    id: q.user.id, storeAdminId: account.id, storeId, role: 'ADMIN', platformAdmin: true, tipoDocumento: account.tipo_documento,
  }, config.jwtSecret, { expiresIn: '1h', algorithm: 'HS256' });
  s.json({ token, role: 'ADMIN', storeId, tipoDocumento: account.tipo_documento, platformAdmin: true });
}));
r.get('/platform/accounts', auth(['SUPERADMIN']), wrap(async (q, s) => {
  const [accounts] = await db.query(`SELECT u.id,u.store_id,s.id storeId,
    IFNULL(c.nombre,s.nombre_comercial) nombre,s.nombre_comercial comercio,
    IF(u.role='CLIENTE','DNI',s.tipo_documento) tipo_documento,
    IF(u.role='CLIENTE',c.dni,s.documento) documento,s.owner_dni,s.giro,u.email,u.role,u.active,s.status comercio_estado,
    (u.password_hash IS NOT NULL) accesoActivo,
    (SELECT COUNT(*) FROM customers customer_count WHERE customer_count.store_id=s.id) clientes
    FROM users u JOIN stores s ON s.id=u.store_id LEFT JOIN customers c ON c.user_id=u.id
    ORDER BY s.nombre_comercial`);
  s.json(accounts);
}));
r.patch('/platform/accounts/:id', auth(['SUPERADMIN']), wrap(async (q, s) => {
  const accountId = id(q.params.id), b = q.body || {};
  if (typeof b.active !== 'boolean') throw V.bad('active debe ser verdadero o falso');
  if (b.role !== undefined) throw V.bad('El rol de la cuenta no se puede cambiar desde este endpoint');
  const [result] = await db.query('UPDATE users SET active=? WHERE id=? AND role IN ("ADMIN","CLIENTE")', [b.active, accountId]);
  if (!result.affectedRows) throw new V.HttpError(404, 'Cuenta no encontrada');
  const [[account]] = await db.query('SELECT store_id,role FROM users WHERE id=?', [accountId]);
  if (account.role === 'ADMIN') await db.query('UPDATE stores SET status=? WHERE id=?', [b.active ? 'ACTIVE' : 'DISABLED', account.store_id]);
  s.json({ ok: true, active: b.active, role: account.role });
}));
r.patch('/platform/stores/:id', auth(['SUPERADMIN']), wrap(async (q, s) => {
  const storeId = id(q.params.id), b = q.body || {};
  const [[store]] = await db.query('SELECT id,tipo_documento,documento,owner_dni,status FROM stores WHERE id=?', [storeId]);
  if (!store) throw new V.HttpError(404, 'Comercio no encontrado');
  const status = b.status === undefined ? store.status : V.oneOf(b.status, 'estado', ['PENDING', 'ACTIVE', 'DISABLED']);
  let doc = { tipo: store.tipo_documento, numero: store.documento };
  if (b.tipoDocumento !== undefined || b.documento !== undefined) {
    if (b.tipoDocumento === undefined || b.documento === undefined) throw V.bad('Envía tipoDocumento y documento juntos');
    doc = { tipo: V.oneOf(b.tipoDocumento, 'tipo de documento', ['DNI', 'RUC']),
      numero: V.str(b.documento, 'documento', { re: b.tipoDocumento === 'RUC' ? /^\d{11}$/ : /^\d{8}$/,
        msg: `${b.tipoDocumento} debe tener ${b.tipoDocumento === 'RUC' ? 11 : 8} dígitos` }) };
  }
  const [[reserved]] = await db.query('SELECT id FROM platform_admins WHERE tipo_documento=? AND documento=?', [doc.tipo, doc.numero]);
  if (reserved) throw new V.HttpError(409, 'El documento está reservado para el administrador global');
  const ownerDni = doc.tipo === 'DNI' ? doc.numero : store.tipo_documento === 'DNI' ? store.documento : store.owner_dni;
  await db.query('UPDATE stores SET tipo_documento=?,documento=?,owner_dni=?,ruc=?,status=? WHERE id=?',
    [doc.tipo, doc.numero, ownerDni, doc.tipo === 'RUC' ? doc.numero : null, status, storeId]);
  s.json({ id: storeId, tipoDocumento: doc.tipo, documento: doc.numero, status });
}));
r.delete('/platform/stores/:id', auth(['SUPERADMIN']), wrap(async (q, s) => {
  const storeId = id(q.params.id);
  const [[activity]] = await db.query(`SELECT
    EXISTS(SELECT 1 FROM sales WHERE store_id=?) AS sales,
    EXISTS(SELECT 1 FROM payments p JOIN customers c ON c.id=p.customer_id WHERE c.store_id=?) AS payments`,
  [storeId, storeId]);
  if (activity.sales || activity.payments) throw new V.HttpError(409, 'El negocio tiene movimientos financieros; desactívalo para conservar el historial');
  await db.tx(async c => {
    await c.query('DELETE FROM password_tokens WHERE user_id IN (SELECT id FROM users WHERE store_id=?)', [storeId]);
    await c.query('DELETE FROM users WHERE id IN (SELECT user_id FROM customers WHERE store_id=? AND user_id IS NOT NULL)', [storeId]);
    await c.query('DELETE FROM customers WHERE store_id=?', [storeId]);
    await c.query('DELETE FROM products WHERE store_id=?', [storeId]);
    await c.query('DELETE FROM users WHERE store_id=?', [storeId]);
    const [result] = await c.query('DELETE FROM stores WHERE id=?', [storeId]);
    if (!result.affectedRows) throw new V.HttpError(404, 'Negocio no encontrado');
  });
  s.json({ ok: true });
}));
r.delete('/platform/accounts/:id', auth(['SUPERADMIN']), wrap(async (q, s) => {
  const accountId = id(q.params.id);
  const [[account]] = await db.query('SELECT id,store_id,role FROM users WHERE id=? AND role IN ("ADMIN","CLIENTE")', [accountId]);
  if (!account) throw new V.HttpError(404, 'Cuenta no encontrada');
  if (account.role === 'CLIENTE') {
    const [[activity]] = await db.query(`SELECT
      EXISTS(SELECT 1 FROM sales WHERE customer_id IN (SELECT id FROM customers WHERE user_id=?)) AS sales,
      EXISTS(SELECT 1 FROM payments WHERE customer_id IN (SELECT id FROM customers WHERE user_id=?)) AS payments`,
    [accountId, accountId]);
    if (activity.sales || activity.payments) throw new V.HttpError(409, 'La cuenta tiene movimientos financieros; desactívala para conservar el historial');
    await db.tx(async c => {
      await c.query('DELETE FROM password_tokens WHERE user_id=?', [accountId]);
      await c.query('DELETE FROM customers WHERE user_id=?', [accountId]);
      await c.query('DELETE FROM users WHERE id=?', [accountId]);
    });
  } else {
    const [[activity]] = await db.query(`SELECT
      EXISTS(SELECT 1 FROM sales WHERE store_id=?) AS sales,
      EXISTS(SELECT 1 FROM payments p JOIN customers c ON c.id=p.customer_id WHERE c.store_id=?) AS payments`,
    [account.store_id, account.store_id]);
    if (activity.sales || activity.payments) throw new V.HttpError(409, 'El negocio tiene movimientos financieros; desactiva la cuenta para conservar el historial');
    await db.tx(async c => {
      await c.query('DELETE FROM password_tokens WHERE user_id IN (SELECT user_id FROM customers WHERE store_id=? AND user_id IS NOT NULL) OR user_id=?', [account.store_id, accountId]);
      await c.query('DELETE FROM users WHERE id IN (SELECT user_id FROM customers WHERE store_id=? AND user_id IS NOT NULL)', [account.store_id]);
      await c.query('DELETE FROM customers WHERE store_id=?', [account.store_id]);
      await c.query('DELETE FROM products WHERE store_id=?', [account.store_id]);
      await c.query('DELETE FROM users WHERE id=?', [accountId]);
      await c.query('DELETE FROM stores WHERE id=?', [account.store_id]);
    });
  }
  s.json({ ok: true });
}));

r.post('/customers', ADMIN, wrap(async (q, s) => { const b = q.body || {};
  const dni = V.str(b.dni, 'DNI', { re: /^\d{8}$/, msg: 'DNI debe tener 8 dígitos' }), nombre = V.str(b.nombre, 'nombre');
  const lmc = V.num(b.lmc, 'LMC', { min: 0.01, max: 500 }), corte = V.num(b.diaCorte, 'día de corte', { min: 1, max: 30, int: true });
  const pago = V.num(b.diaPago, 'día de pago', { min: corte, max: 30, int: true }), tipo = V.oneOf(b.tipoTasa, 'tipo de tasa', ['TEA', 'TNA']);
  const tasa = V.num(b.tasa, 'tasa pactada', { min: 0.0001, max: 114.13 }), mora = V.num(b.tasaMora, 'tasa moratoria', { min: 0, max: 15 });
  const moneda = V.oneOf(b.moneda ?? 'PEN', 'moneda', ['PEN', 'USD']), plazo = V.num(b.plazoMax, 'plazo máximo', { min: 1, max: 60, int: true });
  const [[existing]] = await db.query('SELECT id FROM customers WHERE store_id=? AND dni=?', [q.user.storeId, dni]);
  if (existing) throw new V.HttpError(409, 'Ya existe un cliente de esta tienda con ese DNI');
  const out = await db.tx(async c => {
    const [u] = await c.query('INSERT INTO users(store_id,email,password_hash,role) VALUES(?,?,NULL,"CLIENTE")', [q.user.storeId, `${dni}.${q.user.storeId}@cliente.local`]);
    const [k] = await c.query('INSERT INTO customers(store_id,user_id,nombre,dni,lmc,dia_corte,dia_pago,tipo_tasa,tasa,tasa_mora,moneda,plazo_max) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', [q.user.storeId, u.insertId, nombre, dni, lmc, corte, pago, tipo, tasa, mora, moneda, plazo]);
    return { id: k.insertId, setupToken: await issue(c, u.insertId) }; });
  s.status(201).json(out); }));
// Recuperación: el comercio emite un nuevo enlace (el cliente no tiene email).
r.post('/customers/:id/reset-token', ADMIN, wrap(async (q, s) => {
  const [[c]] = await db.query('SELECT user_id FROM customers WHERE id=? AND store_id=?', [id(q.params.id), q.user.storeId]);
  if (!c) throw new V.HttpError(404, 'Cliente no encontrado'); s.json({ setupToken: await db.tx(cn => issue(cn, c.user_id)) }); }));
r.get('/customers', ADMIN, wrap(async (q, s) => s.json((await db.query(`SELECT c.id,c.nombre,c.dni,c.lmc,c.dia_corte,c.dia_pago,c.tipo_tasa,c.tasa,c.tasa_mora,c.moneda,c.plazo_max,
  COALESCE(used.capital_usado,0) creditoUsado,GREATEST(c.lmc-COALESCE(used.capital_usado,0),0) disponible,
  (u.password_hash IS NOT NULL) AS accesoActivo
  FROM customers c JOIN users u ON u.id=c.user_id
  LEFT JOIN (SELECT sa.customer_id,SUM(i.capital-i.paid_capital) capital_usado FROM sales sa
    JOIN installments i ON i.sale_id=sa.id GROUP BY sa.customer_id) used ON used.customer_id=c.id
  WHERE c.store_id=? ORDER BY c.nombre`, [q.user.storeId]))[0])));

r.post('/products', ADMIN, wrap(async (q, s) => { const b = q.body || {};
  const contado = V.num(b.precioContado, 'precio al contado', { min: 0.01, max: 1e6 }), lista = V.num(b.precioLista, 'precio de lista', { min: contado, max: 1e6 });
  const img = b.imagenUrl ? V.str(b.imagenUrl, 'imagen', { max: 255, re: /^https?:\/\//, msg: 'La imagen debe ser una URL http(s)' }) : null;
  const fin = b.finMes ?? true, cuo = b.cuotas ?? true; if (typeof fin !== 'boolean' || typeof cuo !== 'boolean' || !(fin || cuo)) throw V.bad('Debe permitir al menos una modalidad');
  const [p] = await db.query('INSERT INTO products(store_id,nombre,imagen_url,precio_contado,precio_lista,permite_fin_mes,permite_cuotas) VALUES(?,?,?,?,?,?,?)', [q.user.storeId, V.str(b.nombre, 'nombre'), img, contado, lista, fin, cuo]);
  s.status(201).json({ id: p.insertId }); }));
r.get('/products', auth(['ADMIN', 'CLIENTE']), wrap(async (q, s) => s.json((await db.query('SELECT * FROM products WHERE store_id=?', [q.user.storeId]))[0])));

r.get('/sales/recent', ADMIN, wrap(async (q, s) => {
  const limit = q.query.limit === undefined ? 8 : V.num(q.query.limit, 'límite', { min: 1, max: 30, int: true });
  const [sales] = await db.query(`SELECT sa.id,sa.fecha_compra fechaCompra,sa.cantidad,sa.monto,sa.plazo,
    sa.fecha_pago_pactada fechaPagoPactada,c.nombre cliente,c.moneda,p.nombre producto
    FROM sales sa JOIN customers c ON c.id=sa.customer_id JOIN products p ON p.id=sa.product_id
    WHERE sa.store_id=? ORDER BY sa.id DESC LIMIT ?`, [q.user.storeId, limit]);
  s.json(sales);
}));

r.post('/sales/preview', ADMIN, wrap(async (q, s) => {
  const b = q.body || {};
  const sale = {
    customerId: id(b.customerId, 'customerId'), productId: id(b.productId, 'productId'),
    fechaCompra: V.date(b.fechaCompra, 'fecha de compra'),
    plazo: V.num(b.plazo, 'plazo', { min: 1, max: 60, int: true }),
    cantidad: V.num(b.cantidad ?? 1, 'cantidad', { min: 1, max: 9999, int: true }),
  };
  s.json(await svc.cotizarVenta(q.user.storeId, sale));
}));

r.post('/sales', ADMIN, wrap(async (q, s) => { const b = q.body || {};
  const v = {
    customerId: id(b.customerId, 'customerId'), productId: id(b.productId, 'productId'),
    fechaCompra: V.date(b.fechaCompra, 'fecha de compra'),
    plazo: V.num(b.plazo, 'plazo', { min: 1, max: 60, int: true }),
    cantidad: V.num(b.cantidad ?? 1, 'cantidad', { min: 1, max: 9999, int: true }),
  };
  if (v.fechaCompra > V.today()) throw V.bad('La fecha de compra no puede ser posterior a hoy');
  s.status(201).json(await svc.registrarVenta(q.user.storeId, v)); }));

r.post('/payments', ADMIN, wrap(async (q, s) => { const b = q.body || {};
  const v = { customerId: id(b.customerId, 'customerId'), fecha: V.date(b.fecha, 'fecha de pago'), monto: V.num(b.monto, 'monto', { min: 0.01, max: 1e6 }) };
  if (v.fecha > V.today()) throw V.bad('La fecha de pago no puede ser posterior a hoy');
  s.status(201).json(await svc.registrarPago(q.user.storeId, v)); }));

// ADMIN: cualquier cliente de SU tienda. CLIENTE: solo el propio (o "me"). Con ?pago= es vista previa.
r.get('/statement/:customerId', auth(['ADMIN', 'CLIENTE']), wrap(async (q, s) => {
  const fecha = q.query.fecha === undefined ? V.today() : V.date(q.query.fecha, 'fecha'), pago = q.query.pago === undefined ? 0 : V.num(q.query.pago, 'pago', { min: 0, max: 1e6 });
  let cid; if (q.user.role === 'CLIENTE') { cid = q.user.customerId;
    if (q.params.customerId !== 'me' && String(q.params.customerId) !== String(cid)) throw new V.HttpError(403, 'No autorizado'); } else cid = id(q.params.customerId, 'customerId');
  s.json(await svc.estadoCuenta(q.user.storeId, cid, fecha, pago)); }));
module.exports = r;
