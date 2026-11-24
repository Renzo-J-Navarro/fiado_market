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
  if (!c.activo) throw new HttpError(409, 'El cliente está dado de baja; reactívalo para venderle al crédito');
  if (!p.activo) throw new HttpError(409, 'El producto está dado de baja');
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 9999) throw new HttpError(400, 'La cantidad debe ser un entero entre 1 y 9999');
  if (plazo > c.plazo_max) throw new HttpError(400, `Plazo máximo del cliente: ${c.plazo_max} meses`);
  if ((plazo === 1 && !p.permite_fin_mes) || (plazo > 1 && !p.permite_cuotas)) throw new HttpError(400, 'Modalidad no permitida para este producto');
  const disponible = F.r2(c.lmc - await creditoUsado(c.id, conn));
  const monto = F.r2(Number(p.precio_lista) * cantidad);
  if (monto > disponible) throw new HttpError(422, `Excede la línea disponible (S/ ${disponible.toFixed(2)})`);
  const pagoDate = F.fechaPagoPactada(fechaCompra, c.dia_corte, c.dia_pago);
  const rows = F.buildSchedule({ monto, compra: fechaCompra, pagoDate, plazo, tipo: c.tipo_tasa, tasa: c.tasa, diaPago: c.dia_pago, capDias: c.capitalizacion });
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

const opcionesMora = c => ({ tipoMora: c.tipo_tasa_mora || 'TEA', capDias: c.capitalizacion || 1 });
const sum = (rows, key) => F.r2(rows.reduce((a, x) => a + Number(x[key]), 0));

// Listado de pago del ciclo: cuotas que vencen hasta la fecha de pago del ciclo consultado
// (incluye las vencidas de ciclos anteriores, que generan mora).
function liquidarCiclo(c, cuotas, efectiva, pago = 0) {
  const ciclo = F.cicloDePago(efectiva, c.dia_corte, c.dia_pago);
  const det = F.liquidar(cuotas, efectiva, c.tasa_mora, pago, opcionesMora(c));
  const delCiclo = det.filter(row => String(row.due).slice(0, 10) <= ciclo.pago);
  return { ciclo, det, delCiclo, totalCiclo: sum(delCiclo, 'totalExigible') };
}

// VISTA PREVIA: no persiste nada. El pago real se confirma solo con registrarPago().
async function estadoCuenta(storeId, customerId, efectiva, pago = 0) {
  const [[c]] = await db.query('SELECT * FROM customers WHERE id=? AND store_id=?', [customerId, storeId]);
  if (!c) throw new HttpError(404, 'Cliente no encontrado');
  const [cuotas] = await db.query(sel, [customerId]);
  const { ciclo, det: base, delCiclo, totalCiclo } = liquidarCiclo(c, cuotas, efectiva, pago);
  const det = base.map(row => ({
    ...row,
    delCiclo: String(row.due).slice(0, 10) <= ciclo.pago,
    diasTranscurridos: Math.max(0, F.days360(row.fechaCompra, String(row.due).slice(0, 10) < efectiva ? row.due : efectiva)),
    montoCuota: F.r2(Number(row.capital) + Number(row.interes)),
  }))
    // lista de compras ordenada por fecha de compra (y número de cuota)
    .sort((a, b) => String(a.fechaCompra).localeCompare(String(b.fechaCompra)) || a.sale_id - b.sale_id || a.n - b.n);
  // intereses por mora como ítem separado del listado
  const itemsMora = det.filter(row => row.mora > 0).map(row => ({
    concepto: 'Intereses por mora', saleId: row.sale_id, cuota: row.n, producto: row.producto, vencimiento: row.due,
    diasMora: row.diasMora, base: F.r2(Number(row.pendInteres) + Number(row.pendCapital)), mora: row.mora,
    tasa: Number(c.tasa_mora), tipoTasa: c.tipo_tasa_mora || 'TEA',
  }));
  const totalRestante = sum(det, 'totalExigible');
  return {
    cliente: { nombre: c.nombre, lmc: c.lmc, moneda: c.moneda, activo: !!c.activo, disponible: F.r2(c.lmc - await creditoUsado(c.id)) },
    fechaEfectiva: efectiva, vistaPrevia: pago > 0, fechaCorteReporte: ciclo.corte, fechaPagoCiclo: ciclo.pago,
    detalle: det, itemsMora,
    totales: {
      mora: sum(det, 'mora'), interes: sum(det, 'pendInteres'), capital: sum(det, 'pendCapital'),
      deudaExigible: F.r2(sum(delCiclo, 'pendInteres') + sum(delCiclo, 'pendCapital')),
      interesFecha: sum(delCiclo, 'pendInteres'), moraFecha: sum(delCiclo, 'mora'),
      totalFecha: totalCiclo, pendienteFuturo: F.r2(totalRestante - totalCiclo), exigible: totalRestante,
    },
  };
}

// PAGO CONFIRMADO: el enunciado no permite pagos parciales. El monto debe ser exactamente el total
// a pagar del ciclo (cuotas vencidas + mora). Imputa mora → interés → capital y registra (atómico).
async function registrarPago(storeId, { customerId, fecha, monto }) {
  if (fecha > today()) throw new HttpError(400, 'La fecha de pago no puede ser posterior a hoy');
  return db.tx(async conn => {
    const [[c]] = await conn.query('SELECT * FROM customers WHERE id=? AND store_id=? FOR UPDATE', [customerId, storeId]);
    if (!c) throw new HttpError(404, 'Cliente no encontrado');
    const [cuotas] = await conn.query(sel + ' FOR UPDATE', [customerId]);
    const { totalCiclo } = liquidarCiclo(c, cuotas, fecha, 0);
    if (totalCiclo <= 0) throw new HttpError(422, 'No hay deuda por pagar en este ciclo');
    if (Math.abs(monto - totalCiclo) >= 0.005) throw new HttpError(422, `No se permiten pagos parciales: el pago debe ser exactamente ${totalCiclo.toFixed(2)}`);
    const det = F.liquidar(cuotas, fecha, c.tasa_mora, monto, opcionesMora(c));
    const aplicado = det.filter(x => x.imputado.mora || x.imputado.interes || x.imputado.capital);
    for (const x of aplicado) await conn.query('UPDATE installments SET paid_mora=paid_mora+?,paid_interes=paid_interes+?,paid_capital=paid_capital+? WHERE id=?', [x.imputado.mora, x.imputado.interes, x.imputado.capital, x.id]);
    const [p] = await conn.query('INSERT INTO payments(customer_id,fecha,monto) VALUES(?,?,?)', [c.id, fecha, monto]);
    return { paymentId: p.insertId, exigibleAntes: totalCiclo, aplicado: aplicado.map(x => ({ saleId: x.sale_id, cuota: x.n, ...x.imputado })) }; }); }
module.exports = { registrarVenta, cotizarVenta, estadoCuenta, registrarPago, creditoUsado };
