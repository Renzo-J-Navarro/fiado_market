'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Printer, WalletCards } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Shell from '@/components/Shell';
import HelpTip from '@/components/HelpTip';
import { btnCls, Msg } from '@/components/Field';
import { api, post, getSession, money, today, Session } from '@/lib/api';

type Row = {
  sale_id: number; n: number; due: string; fechaCompra: string; diasTranscurridos: number;
  producto: string; cantidad: number; plazoTotal: number; montoVenta: number; montoCuota: number;
  diasMora: number; mora: number; pendInteres: number; pendCapital: number; totalExigible: number;
  imputado: { mora: number; interes: number; capital: number };
};
type Statement = {
  cliente: { nombre: string; moneda: string; lmc: number; disponible: number };
  fechaEfectiva: string; fechaCorteReporte: string; vistaPrevia: boolean; detalle: Row[];
  totales: {
    mora: number; interes: number; capital: number; deudaExigible: number;
    interesFecha: number; moraFecha: number; totalFecha: number; pendienteFuturo: number; exigible: number;
  };
};
type Customer = { id: number; nombre: string; dni: string };

const COLUMNS = [
  ['Compra / detalle', 'Producto, cantidad y número de cuota del cronograma.'],
  ['Monto', 'Monto original de esta cuota: capital más interés programado.'],
  ['Días', 'Días comerciales 30/360 desde la fecha de compra hasta la fecha consultada.'],
  ['Interés', 'Interés pendiente de esta cuota, según el cronograma calculado con la tasa pactada.'],
  ['Vence', 'Fecha de vencimiento pactada para esta cuota.'],
  ['Días mora', 'Días comerciales de atraso al día de la consulta.'],
  ['Mora', 'Interés moratorio calculado sobre la deuda vencida.'],
  ['A pagar', 'Saldo de la cuota más el interés moratorio calculado.'],
];

const formatDate = (value: string) => {
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('es-PE');
};

function Cuenta({ admin }: { admin: boolean }) {
  const query = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState(query.get('cliente') ?? '');
  const [date, setDate] = useState(today());
  const [payment, setPayment] = useState(0);
  const [data, setData] = useState<Statement | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!admin) return;
    api<Customer[]>('/customers')
      .then(items => {
        setCustomers(items);
        setCustomerId(current => current || (items[0] ? String(items[0].id) : ''));
      })
      .catch(cause => setError((cause as Error).message));
  }, [admin]);

  const load = useCallback(async () => {
    const id = admin ? customerId : 'me';
    if (!id) { setData(null); return; }
    try {
      const suffix = new URLSearchParams({ fecha: date });
      if (payment > 0) suffix.set('pago', String(payment));
      setData(await api<Statement>(`/statement/${id}?${suffix.toString()}`));
      setError('');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [admin, customerId, date, payment]);
  useEffect(() => { load(); }, [load]);

  async function confirmPayment() {
    if (!customerId || payment <= 0) return;
    setError(''); setNotice('');
    try {
      await post('/payments', { customerId: Number(customerId), fecha: date, monto: payment });
      setNotice('Pago registrado y aplicado a la deuda.');
      setPayment(0);
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  const currency = data?.cliente.moneda === 'PEN' ? 'S/' : data?.cliente.moneda ?? 'S/';

  return (
    <div className="workspace-page">
      <p className="workspace-intro">Consulta el estado de las compras, vencimientos, intereses y pagos de una persona.</p>
      <section className="workspace-card workspace-report-controls">
        {admin && <div className="workspace-field">
          <label htmlFor="statement-customer">Cliente</label>
          <select id="statement-customer" value={customerId} onChange={event => setCustomerId(event.target.value)} disabled={!customers.length}>
            {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.nombre} · DNI {customer.dni}</option>)}
          </select>
        </div>}
        <div className="workspace-field">
          <label htmlFor="statement-date">Fecha efectiva de pago <HelpTip text="Fecha a la que se calcula el saldo y la mora. No puede ser posterior a hoy." /></label>
          <input id="statement-date" type="date" max={today()} value={date} onChange={event => setDate(event.target.value)} />
        </div>
        {admin && <>
          <div className="workspace-field">
            <label htmlFor="statement-payment">Pago a registrar ({data?.cliente.moneda === 'USD' ? 'USD' : 'S/'}) <HelpTip text="Vista previa de cómo se imputará: primero mora, luego interés y finalmente capital." /></label>
            <input id="statement-payment" type="number" min="0" step="0.01" value={payment}
              onChange={event => setPayment(Math.max(0, Number(event.target.value)))} />
          </div>
          <button className={`${btnCls} workspace-primary-button`} onClick={confirmPayment} disabled={payment <= 0 || !customerId}>Registrar pago</button>
        </>}
        {data && <button className="workspace-secondary-button print-hide" onClick={() => window.print()}><Printer size={16} /> Imprimir reporte</button>}
      </section>
      <Msg err={error} ok={notice} />
      {payment > 0 && admin && <p className="workspace-report-note">Vista previa de imputación; el pago solo se registra al pulsar «Registrar pago».</p>}

      {data && <>
        <section className="workspace-card workspace-statement-heading">
          <div><span className="workspace-report-kicker">REPORTE DE CUENTA</span><h2>{data.cliente.nombre}</h2>
            <p>Corte consultado al {formatDate(date)} · Cierre del ciclo: {formatDate(data.fechaCorteReporte)}</p></div>
          <div className="workspace-credit-chip"><small>Línea disponible</small><strong>{currency} {money(Number(data.cliente.disponible))}</strong></div>
        </section>

        <section className="workspace-card workspace-list-card workspace-statement-table">
          <div className="workspace-card-heading"><span className="workspace-step"><WalletCards size={18} /></span><div><h2>Compras y cuotas</h2><p>El interés corresponde al cronograma acordado; la mora se calcula a la fecha consultada.</p></div></div>
          {data.detalle.length === 0 ? <div className="workspace-empty"><WalletCards size={30} /><strong>Sin compras pendientes</strong><span>Esta cuenta no tiene cuotas por pagar.</span></div> : (
            <div className="workspace-table-wrap"><table className="workspace-table">
              <thead><tr>{COLUMNS.map(([label, help]) => <th key={label}>{label}<HelpTip text={help} /></th>)}</tr></thead>
              <tbody>{data.detalle.map(row => <tr key={`${row.sale_id}-${row.n}`}>
                <td><strong>{formatDate(row.fechaCompra)} · {row.cantidad} × {row.producto}</strong><small>Compra #{row.sale_id} · {row.plazoTotal === 1 ? 'Pago único' : `Cuota ${row.n} de ${row.plazoTotal}`}</small></td>
                <td>{currency} {money(Number(row.montoCuota))}</td>
                <td>{row.diasTranscurridos}</td>
                <td>{currency} {money(Number(row.pendInteres))}</td>
                <td>{formatDate(row.due)}</td>
                <td>{row.diasMora > 0 ? <span className="workspace-overdue">{row.diasMora}</span> : '0'}</td>
                <td>{row.mora > 0 ? <span className="workspace-overdue">{currency} {money(Number(row.mora))}</span> : `${currency} 0.00`}</td>
                <td><strong>{currency} {money(Number(row.totalExigible))}</strong></td>
              </tr>)}</tbody>
            </table></div>
          )}
        </section>

        <section className="workspace-totals" aria-label="Totales del estado de cuenta">
          <div className="workspace-total-card"><small>Interés pendiente del ciclo</small><strong>{currency} {money(Number(data.totales.interesFecha))}</strong></div>
          <div className="workspace-total-card"><small>Interés moratorio del ciclo</small><strong className={data.totales.moraFecha > 0 ? 'workspace-overdue' : ''}>{currency} {money(Number(data.totales.moraFecha))}</strong></div>
          <div className="workspace-total-card"><small>Deuda exigible del ciclo</small><strong>{currency} {money(Number(data.totales.deudaExigible))}</strong></div>
          <div className="workspace-total-card workspace-total-highlight"><small>Total a pagar al {formatDate(date)}</small><strong>{currency} {money(Number(data.totales.totalFecha))}</strong></div>
        </section>
        {Number(data.totales.pendienteFuturo) > 0 && <p className="workspace-future-balance">Saldo pendiente de cuotas futuras: {currency} {money(Number(data.totales.pendienteFuturo))}. No está incluido en el total exigible de este ciclo.</p>}
      </>}
    </div>
  );
}

export default function EstadoCuenta() {
  const [role, setRole] = useState<Session['role']>('CLIENTE');
  useEffect(() => { const session = getSession(); if (session) setRole(session.role); }, []);
  return <Shell role={role} title="Estado de cuenta / Reporte de corte"><Suspense><Cuenta admin={role === 'ADMIN'} /></Suspense></Shell>;
}
