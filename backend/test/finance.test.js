// Resultados esperados documentados (cálculo manual / identidades matemáticas). Año comercial 30/360.
const { test } = require('node:test'); const assert = require('node:assert/strict'); const F = require('../src/services/finance');
const near = (a, b, e = 1e-8) => assert.ok(Math.abs(a - b) <= e, `${a} ≠ ${b}`);

test('días 30/360 y fechas límite', () => {
  assert.equal(F.days360('2026-10-01', '2026-10-01'), 0);
  assert.equal(F.days360('2026-12-15', '2027-01-15'), 30);       // cambio de año
  assert.equal(F.days360('2026-01-31', '2026-03-01'), 31);       // 31 cuenta como 30
  assert.equal(F.days360('2026-01-30', '2026-01-31'), 0);
  assert.equal(F.days360('2026-02-28', '2026-03-01'), 3);        // febrero
  assert.equal(F.days360('2026-10-25', '2026-10-20'), -5);
  assert.equal(F.days360('2026-01-01', '2027-01-01'), 360);
});
test('TNA→TEA y tasas derivadas (TEA/TNA)', () => {
  near(F.tnaToTea(0.12, 12).toNumber(), 0.126825030132);          // 12% TNA mensual → 12.6825% TEA
  near(F.tnaToTea(0.12, 360).toNumber(), 0.12747, 1e-5);          // capitalización diaria
  const t = F.rates('TEA', 100); near(t.tem.toNumber(), 0.0594630944);   // 2^(1/12)-1
  near(F.rates('TEA', 60).ted.plus(1).pow(360).toNumber(), 1.6, 1e-9);   // (1+TED)^360 = 1+TEA
  near(F.rates('TNA', 12).tea.toNumber(), F.tnaToTea(0.12).toNumber(), 1e-12);
});
test('redondeo a 2 decimales (half-up exacto)', () => {
  assert.equal(F.r2(1.005), 1.01); assert.equal(F.r2(2.675), 2.68); assert.equal(F.r2(0.004), 0); assert.equal(F.r2('10.555'), 10.56);
});
test('fecha de pago pactada', () => {
  assert.equal(F.fechaPagoPactada('2026-10-05', 15, 25), '2026-10-25');   // antes del corte
  assert.equal(F.fechaPagoPactada('2026-10-16', 15, 25), '2026-11-25');   // después del corte
  assert.equal(F.fechaPagoPactada('2026-12-20', 15, 25), '2027-01-25');   // cambio de año
  assert.equal(F.fechaPagoPactada('2027-02-01', 30, 30), '2027-02-28');   // día 30 en febrero
});
test('fin de mes (plazo 1): interés = M·((1+TED)^días−1)', () => {
  const s = F.buildSchedule({ monto: 100, compra: '2026-10-05', pagoDate: '2026-10-25', plazo: 1, tipo: 'TEA', tasa: 60, diaPago: 25 });
  assert.deepEqual(s, [{ n: 1, due: '2026-10-25', capital: 100, interes: 2.65, total: 102.65 }]); // 100·(1.6^(20/360)−1)
  assert.equal(F.buildSchedule({ monto: 100, compra: '2026-10-25', pagoDate: '2026-10-25', plazo: 1, tipo: 'TEA', tasa: 60, diaPago: 25 })[0].interes, 0);
});
test('cuotas (método francés): cuota fija, cierre en 0.00 y capital exacto', () => {
  const s = F.buildSchedule({ monto: 100, compra: '2026-10-05', pagoDate: '2026-10-25', plazo: 3, tipo: 'TEA', tasa: 60, diaPago: 25 });
  assert.deepEqual(s.map(x => x.total), [36.98, 36.98, 36.99]);   // 102.6455·TEM/(1−(1+TEM)^−3)
  assert.deepEqual(s.map(x => x.due), ['2026-11-25', '2026-12-25', '2027-01-25']);
  assert.equal(F.r2(s.reduce((a, x) => a + x.capital, 0)), 100);
  for (const n of [2, 6, 12]) { const q = F.buildSchedule({ monto: 333.33, compra: '2026-10-01', pagoDate: '2026-10-20', plazo: n, tipo: 'TNA', tasa: 80, diaPago: 20 });
    assert.equal(q.length, n); assert.equal(F.r2(q.reduce((a, x) => a + x.capital, 0)), 333.33); assert.ok(q.every(x => x.capital > 0 && x.interes >= 0)); }
});
test('mora: M·((1+TEDmora)^días−1), solo si hay atraso', () => {
  assert.deepEqual(F.mora(100, '2026-10-25', '2026-11-25', 15), { dias: 30, mora: 1.17 });   // 1.15^(30/360)−1
  assert.equal(F.mora(100, '2026-10-25', '2026-11-24', 15).mora, 1.13);
  assert.equal(F.mora(100, '2026-10-25', '2026-10-25', 15).mora, 0);   // a tiempo
  assert.equal(F.mora(100, '2026-10-25', '2026-10-01', 15).mora, 0);   // adelantado
  assert.equal(F.mora(100, '2026-10-25', '2026-11-25', 0).mora, 0);    // tasa 0
});
const cuotas = () => [{ id: 1, sale_id: 1, n: 1, due: '2026-10-25', capital: 50, interes: 5, paid_interes: 0, paid_capital: 0 },
                      { id: 2, sale_id: 1, n: 2, due: '2026-11-25', capital: 50, interes: 3, paid_interes: 0, paid_capital: 0 }];
test('liquidación: orden mora → interés → capital y pagos parciales', () => {
  const [a, b] = F.liquidar(cuotas(), '2026-11-24', 15, 10);  // mora c1 = 55·(1.15^(29/360)−1) = 0.62
  assert.equal(a.mora, 0.62); assert.deepEqual(a.imputado, { mora: 0.62, interes: 5, capital: 4.38 });
  assert.deepEqual(b.imputado, { mora: 0, interes: 0, capital: 0 }); assert.equal(b.mora, 0); assert.equal(a.saldoCapitalTras, 45.62);
  assert.deepEqual(F.liquidar(cuotas(), '2026-11-24', 15, 0.3)[0].imputado, { mora: 0.3, interes: 0, capital: 0 }); // pago < mora
});
test('liquidación de varias cuotas y pago total', () => {
  const l = F.liquidar(cuotas(), '2026-11-24', 15, 0), exigible = F.r2(l.reduce((a, x) => a + x.totalExigible, 0)); assert.equal(exigible, 108.62);
  const p = F.liquidar(cuotas(), '2026-11-24', 15, exigible); assert.ok(p.every(x => x.saldoCapitalTras === 0));
  const sobra = F.liquidar(cuotas(), '2026-11-24', 15, 1000); assert.equal(sobra.reduce((a, x) => a + x.imputado.capital, 0), 100); // no imputa de más
});
test('pagos inválidos se rechazan', () => {
  for (const bad of [-1, -0.01, NaN, Infinity, '5', null]) assert.throws(() => F.liquidar(cuotas(), '2026-11-24', 15, bad), RangeError);
  assert.throws(() => F.liquidar(cuotas(), 'no-es-fecha', 15, 1), RangeError);
});
