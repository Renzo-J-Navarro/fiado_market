// Motor financiero: 30/360, Decimal.js (30 dígitos), redondeo final a 2 decimales.
const D = require('decimal.js'); D.set({ precision: 30, rounding: D.ROUND_HALF_UP });
const r2 = x => new D(x).toDecimalPlaces(2).toNumber();
const utc = s => { const d = new Date(s); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };
const iso = d => d.toISOString().slice(0, 10);

// Días comerciales 30/360 (día 31 => 30)
function days360(a, b) {
  a = utc(a); b = utc(b);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 360 + (b.getUTCMonth() - a.getUTCMonth()) * 30 +
         (Math.min(b.getUTCDate(), 30) - Math.min(a.getUTCDate(), 30));
}
// a) TEA = (1 + TNA/m)^n - 1 con n = m (m = capitalizaciones por año; 360 = diaria)
const tnaToTea = (tna, m = 360) => new D(1).plus(new D(tna).div(m)).pow(m).minus(1);

// b) tasas derivadas. tasa en % (ej. 60 => 60%). capDias = días de cada periodo de capitalización
// de la tasa nominal (1 = diaria, 15 = quincenal, 30 = mensual), así m = 360 / capDias.
function rates(tipo, tasaPct, capDias = 1) {
  if (![1, 15, 30].includes(Number(capDias))) throw new RangeError('Capitalización no válida (1, 15 o 30 días)');
  const m = 360 / Number(capDias);
  const f = new D(tasaPct).div(100);
  const tea = tipo === 'TNA' ? tnaToTea(f, m) : f;
  const one = new D(1).plus(tea);
  return { tea, ted: one.pow(new D(1).div(360)).minus(1), tem: one.pow(new D(30).div(360)).minus(1) };
}
const dim = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
function dateWithDay(y, m, day) { const t = new Date(Date.UTC(y, m, 1)); const yy = t.getUTCFullYear(), mm = t.getUTCMonth(); return new Date(Date.UTC(yy, mm, Math.min(day, dim(yy, mm)))); }

// Fecha de pago pactada: compra <= corte => pago del mes corriente; si no, mes siguiente.
function fechaPagoPactada(compra, corte, pago) {
  const c = utc(compra); const off = c.getUTCDate() > corte ? 1 : 0;
  return iso(dateWithDay(c.getUTCFullYear(), c.getUTCMonth() + off, pago));
}

// c) y d) Cronograma. Cuotas: 1ª cuota vence 1 mes después de la fecha de pago pactada (supuesto).
function buildSchedule({ monto, compra, pagoDate, plazo, tipo, tasa, diaPago, capDias = 1 }) {
  const { ted, tem } = rates(tipo, tasa, capDias);
  const dias = Math.max(0, days360(compra, pagoDate));
  const M = new D(monto), g = new D(1).plus(ted).pow(dias);
  if (plazo === 1) {
    const i = r2(M.times(g.minus(1)));
    return [{ n: 1, due: pagoDate, capital: r2(M), interes: i, total: r2(M.plus(i)) }];
  }
  const deuda = M.times(g);
  const cuota = r2(deuda.times(tem.div(new D(1).minus(new D(1).plus(tem).pow(-plazo)))));
  const pd = utc(pagoDate); let saldo = deuda, capAcum = new D(0); const rows = [];
  for (let n = 1; n <= plazo; n++) {
    const intP = saldo.times(tem);
    const last = n === plazo;
    const total = last ? r2(saldo.plus(intP)) : cuota;        // última cuota cierra saldo en 0.00
    const amort = last ? saldo : new D(total).minus(intP);
    saldo = saldo.minus(amort);
    // capital original = amortización proporcional (el resto es interés, incl. gracia capitalizada)
    const capital = last ? r2(M.minus(capAcum)) : r2(amort.times(M).div(deuda));
    capAcum = capAcum.plus(capital);
    rows.push({ n, due: iso(dateWithDay(pd.getUTCFullYear(), pd.getUTCMonth() + n, diaPago)),
                capital, interes: r2(new D(total).minus(capital)), total });
  }
  return rows;
}

// e) Mora = Deuda * ((1+TEDmora)^diasMora - 1); la tasa moratoria pactada puede ser efectiva (TEA)
// o nominal (TNA, con la misma capitalización del cliente).
function mora(deuda, due, efectiva, tasaMoraPct, tipoMora = 'TEA', capDias = 1) {
  const dm = days360(due, efectiva); if (dm <= 0 || deuda <= 0) return { dias: 0, mora: 0 };
  const { ted } = rates(tipoMora, tasaMoraPct, capDias);
  return { dias: dm, mora: r2(new D(deuda).times(new D(1).plus(ted).pow(dm).minus(1))) };
}

// Orden legal de imputación: 1° mora, 2° interés compensatorio, 3° capital (cuotas por antigüedad).
function liquidar(cuotas, efectiva, tasaMora, pago = 0, { tipoMora = 'TEA', capDias = 1 } = {}) {
  if (typeof pago !== 'number' || !Number.isFinite(pago) || pago < 0) throw new RangeError('El pago debe ser un número finito >= 0');
  if (Number.isNaN(utc(efectiva).getTime())) throw new RangeError('Fecha efectiva inválida');
  let disp = new D(pago);
  return [...cuotas].sort((a, b) => a.due.localeCompare(b.due)).map(c => {
    const pi = r2(new D(c.interes).minus(c.paid_interes)), pc = r2(new D(c.capital).minus(c.paid_capital));
    const m = mora(r2(new D(pi).plus(pc)), c.due, efectiva, tasaMora, tipoMora, capDias).mora;
    const take = x => { const t = D.min(disp, x); disp = disp.minus(t); return r2(t); };
    const aM = take(new D(m)), aI = take(new D(pi)), aC = take(new D(pc));
    return { ...c, diasMora: Math.max(0, days360(c.due, efectiva)),
      pendInteres: pi, pendCapital: pc, mora: m, totalExigible: r2(new D(m).plus(pi).plus(pc)),
      imputado: { mora: aM, interes: aI, capital: aC }, saldoCapitalTras: r2(new D(pc).minus(aC)) };
  });
}
// Ciclo de facturación: la fecha de pago que corresponde a una fecha consultada y su fecha de corte.
// Si el día consultado es <= día de pago, se paga este mes; si no, el ciclo siguiente.
function cicloDePago(fecha, diaCorte, diaPago) {
  const f = utc(fecha); const off = f.getUTCDate() > diaPago ? 1 : 0;
  return { corte: iso(dateWithDay(f.getUTCFullYear(), f.getUTCMonth() + off, diaCorte)),
           pago: iso(dateWithDay(f.getUTCFullYear(), f.getUTCMonth() + off, diaPago)) };
}
module.exports = { cicloDePago, days360, tnaToTea, rates, fechaPagoPactada, buildSchedule, mora, liquidar, r2 };
