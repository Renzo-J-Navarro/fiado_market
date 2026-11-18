const F = require('./finance'); const assert = require('assert');
const s = F.buildSchedule({ monto: 100, compra: '2026-10-05', pagoDate: '2026-10-25', plazo: 3, tipo: 'TEA', tasa: 60, diaPago: 25 });
console.table(s);
assert.strictEqual(s.reduce((a, x) => a + x.capital, 0).toFixed(2), '100.00');
assert.strictEqual(F.days360('2026-01-31', '2026-03-01'), 31);
console.log('mora ejemplo:', F.mora(100, '2026-10-25', '2026-11-24', 15));
console.log('OK');
