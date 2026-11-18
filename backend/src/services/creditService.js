const db = require('../db'); const F = require('./finance'); const { HttpError, today } = require('../validate');
const sel = `SELECT i.id,i.sale_id,i.n,i.due_date due,i.capital,i.interes,i.paid_mora,i.paid_interes,i.paid_capital,
  s.fecha_compra fechaCompra,s.monto montoVenta,s.cantidad,s.plazo plazoTotal,p.nombre producto
  FROM installments i JOIN sales s ON s.id=i.sale_id JOIN products p ON p.id=s.product_id
  WHERE s.customer_id=? AND (i.capital>i.paid_capital OR i.interes>i.paid_interes) ORDER BY i.due_date,i.id`;
async function creditoUsado(customerId, conn = db) {
  const [[r]] = await conn.query('SELECT COALESCE(SUM(i.capital-i.paid_capital),0) u FROM installments i JOIN sales s ON s.id=i.sale_id WHERE s.customer_id=?', [customerId]); return r.u; }

async function cotizarVenta(storeId, { customerId, productId, fechaCompra, plazo, cantidad = 1 }, conn = db, lock = false) {
  if (fechaCompra > today()) throw new HttpError(400, 'La fecha de compra no puede ser posterior a hoy');
  const [[c]] = await conn.query(`SELECT * FROM customers WHERE id=? AND store_id=?${lock ? ' FOR UPDATE' : ''}`, [customerId, storeId]);
  const [[p]] = await conn.query('SELECT * FROM products WHERE id=? AND store_id=?', [productId, storeId]);
  if (!c || !p) throw new HttpError(404, 'Cliente o producto no encontrado');
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 9999) throw new HttpError(400, 'La cantidad debe ser un entero entre 1 y 9999');
  if (plazo > c.plazo_max) throw new HttpError(400, `Plazo máximo del cliente: ${c.plazo_max} meses`);
  if ((plazo === 1 && !p.permite_fin_mes) || (plazo > 1 && !p.permite_cuotas)) throw new HttpError(400, 'Modalidad no permitida para este producto');
  const disponible = F.r2(c.lmc - await creditoUsado(c.id, conn));
  const monto = F.r2(Number(p.precio_lista) * cantidad);
  if (monto > disponible) throw new HttpError(422, `Excede la línea disponible (S/ ${disponible.toFixed(2)})`);
  const pagoDate = F.fechaPagoPactada(fechaCompra, c.dia_corte, c.dia_pago);
  const rows = F.buildSchedule({ monto, compra: fechaCompra, pagoDate, plazo, tipo: c.tipo_tasa, tasa: c.tasa, diaPago: c.dia_pago });
  return {
    customerId: c.id, customerName: c.nombre, currency: c.moneda, line: Number(c.lmc),
    available: disponible, remainingAvailable: F.r2(disponible - monto),
    productId: p.id, productName: p.nombre, unitPrice: Number(p.precio_lista), quantity: cantidad,
    amount: monto, date: fechaCompra, paymentDate: pagoDate, daysToPayment: F.days360(fechaCompra, pagoDate),
    term: plazo, interest: F.r2(rows.reduce((sum, row) => sum + row.interes, 0)),
    total: F.r2(rows.reduce((sum, row) => sum + row.total, 0)),
    firstPayment: rows[0].total, firstDue: rows[0].due, schedule: rows,
  };
}

async function registrarVenta(storeId, { customerId, productId, fechaCompra, plazo, cantidad }) {
  return db.tx(async conn => {
    const quote = await cotizarVenta(storeId, { customerId, productId, fechaCompra, plazo, cantidad }, conn, true);
    const [s] = await conn.query('INSERT INTO sales(store_id,customer_id,product_id,fecha_compra,cantidad,monto,plazo,fecha_pago_pactada) VALUES(?,?,?,?,?,?,?,?)',
      [storeId, quote.customerId, quote.productId, fechaCompra, cantidad, quote.amount, plazo, quote.paymentDate]);
    for (const r of quote.schedule) await conn.query('INSERT INTO installments(sale_id,n,due_date,capital,interes) VALUES(?,?,?,?,?)', [s.insertId, r.n, r.due, r.capital, r.interes]);
    return { saleId: s.insertId, ...quote };
  });
}

// VISTA PREVIA: no persiste nada. El pago real se confirma solo con registrarPago().
async function estadoCuenta(storeId, customerId, efectiva, pago = 0) {
  const [[c]] = await db.query('SELECT * FROM customers WHERE id=? AND store_id=?', [customerId, storeId]);
  if (!c) throw new HttpError(404, 'Cliente no encontrado');
  const [cuotas] = await db.query(sel, [customerId]);
  const det = F.liquidar(cuotas, efectiva, c.tasa_mora, pago).map(row => ({
    ...row,
    diasTranscurridos: Math.max(0, F.days360(row.fechaCompra, efectiva)),
    montoCuota: F.r2(Number(row.capital) + Number(row.interes)),
  }));
  const sum = (rows, key) => F.r2(rows.reduce((a, x) => a + Number(x[key]), 0));
  const endOfMonth = `${efectiva.slice(0, 7)}-${String(new Date(Date.UTC(
    Number(efectiva.slice(0, 4)), Number(efectiva.slice(5, 7)), 0,
  )).getUTCDate()).padStart(2, '0')}`;
  const vencidoEsteMes = det.filter(row => row.due <= endOfMonth);
  const totalRestante = sum(det, 'totalExigible');
  const totalFecha = sum(vencidoEsteMes, 'totalExigible');
  return {
    cliente: { nombre: c.nombre, lmc: c.lmc, moneda: c.moneda, disponible: F.r2(c.lmc - await creditoUsado(c.id)) },
    fechaEfectiva: efectiva, vistaPrevia: pago > 0, fechaCorteReporte: endOfMonth, detalle: det,
    totales: {
      mora: sum(det, 'mora'), interes: sum(det, 'pendInteres'), capital: sum(det, 'pendCapital'),
      deudaExigible: F.r2(sum(vencidoEsteMes, 'pendInteres') + sum(vencidoEsteMes, 'pendCapital')),
      interesFecha: sum(vencidoEsteMes, 'pendInteres'), moraFecha: sum(vencidoEsteMes, 'mora'),
      totalFecha, pendienteFuturo: F.r2(totalRestante - totalFecha), exigible: totalRestante,
    },
  };
}

// PAGO CONFIRMADO: imputa mora → interés → capital, actualiza cuotas y registra en payments (atómico).
async function registrarPago(storeId, { customerId, fecha, monto }) {
  if (fecha > today()) throw new HttpError(400, 'La fecha de pago no puede ser posterior a hoy');
  return db.tx(async conn => {
    const [[c]] = await conn.query('SELECT * FROM customers WHERE id=? AND store_id=? FOR UPDATE', [customerId, storeId]);
    if (!c) throw new HttpError(404, 'Cliente no encontrado');
    const [cuotas] = await conn.query(sel + ' FOR UPDATE', [customerId]);
    const det = F.liquidar(cuotas, fecha, c.tasa_mora, monto); const exigible = F.r2(det.reduce((a, x) => a + x.totalExigible, 0));
    if (monto > exigible) throw new HttpError(422, `El pago excede la deuda exigible (S/ ${exigible.toFixed(2)})`);
    const aplicado = det.filter(x => x.imputado.mora || x.imputado.interes || x.imputado.capital);
    for (const x of aplicado) await conn.query('UPDATE installments SET paid_mora=paid_mora+?,paid_interes=paid_interes+?,paid_capital=paid_capital+? WHERE id=?', [x.imputado.mora, x.imputado.interes, x.imputado.capital, x.id]);
    const [p] = await conn.query('INSERT INTO payments(customer_id,fecha,monto) VALUES(?,?,?)', [c.id, fecha, monto]);
    return { paymentId: p.insertId, exigibleAntes: exigible, aplicado: aplicado.map(x => ({ saleId: x.sale_id, cuota: x.n, ...x.imputado })) }; }); }
module.exports = { registrarVenta, cotizarVenta, estadoCuenta, registrarPago, creditoUsado };
