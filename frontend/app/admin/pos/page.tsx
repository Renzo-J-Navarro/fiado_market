'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, ReceiptText } from 'lucide-react';
import Shell from '@/components/Shell';
import Field, { btnCls, Msg } from '@/components/Field';
import { api, post, money, today } from '@/lib/api';

type Customer = { id: number; nombre: string; dni: string; moneda: string; disponible: number; plazo_max: number };
type Product = {
  id: number; nombre: string; precio_lista: number;
  permite_fin_mes: boolean | number; permite_cuotas: boolean | number;
};
type Quote = {
  customerName: string; currency: string; available: number; remainingAvailable: number;
  productName: string; unitPrice: number; quantity: number; amount: number; date: string;
  daysToPayment: number; interest: number; total: number; firstPayment: number; firstDue: string;
  schedule: { n: number; due: string; capital: number; interes: number; total: number }[];
};
type Sale = { id: number; fechaCompra: string; cantidad: number; monto: number; plazo: number; cliente: string; producto: string; moneda: string };
type Mode = 'endOfMonth' | 'installments';

const isAllowed = (value: boolean | number) => Boolean(value);
const displayDate = (value: string) => {
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('es-PE');
};

export default function POS() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recent, setRecent] = useState<Sale[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [productId, setProductId] = useState('');
  const [date, setDate] = useState(today());
  const [quantity, setQuantity] = useState(1);
  const [mode, setMode] = useState<Mode>('endOfMonth');
  const [months, setMonths] = useState(3);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedProduct = useMemo(() => products.find(product => String(product.id) === productId), [products, productId]);
  const selectedCustomer = useMemo(() => customers.find(customer => String(customer.id) === customerId), [customers, customerId]);
  const term = mode === 'endOfMonth' ? 1 : months;

  const loadRecent = useCallback(async () => setRecent(await api<Sale[]>('/sales/recent?limit=8')), []);
  useEffect(() => {
    Promise.all([api<Customer[]>('/customers'), api<Product[]>('/products'), api<Sale[]>('/sales/recent?limit=8')])
      .then(([nextCustomers, nextProducts, nextSales]) => {
        setCustomers(nextCustomers); setProducts(nextProducts); setRecent(nextSales);
        setCustomerId(nextCustomers[0] ? String(nextCustomers[0].id) : '');
        setProductId(nextProducts[0] ? String(nextProducts[0].id) : '');
        if (nextCustomers[0]) setMonths(Math.min(3, Number(nextCustomers[0].plazo_max)));
        if (nextProducts[0] && !isAllowed(nextProducts[0].permite_fin_mes) && isAllowed(nextProducts[0].permite_cuotas)) setMode('installments');
      })
      .catch(cause => setError((cause as Error).message));
  }, []);

  useEffect(() => {
    setQuote(null);
    if (!customerId || !productId || !date || !Number.isInteger(quantity) || quantity < 1 || term < 1) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const next = await post<Quote>('/sales/preview', {
          customerId: Number(customerId), productId: Number(productId),
          fechaCompra: date, cantidad: quantity, plazo: term,
        });
        if (active) { setQuote(next); setError(''); }
      } catch (cause) {
        if (active) { setQuote(null); setError((cause as Error).message); }
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [customerId, productId, date, quantity, term]);

  function chooseProduct(value: string) {
    setProductId(value);
    const product = products.find(item => String(item.id) === value);
    if (product && !isAllowed(product.permite_fin_mes) && isAllowed(product.permite_cuotas)) setMode('installments');
    else if (product && isAllowed(product.permite_fin_mes) && !isAllowed(product.permite_cuotas)) setMode('endOfMonth');
  }

  function chooseCustomer(value: string) {
    setCustomerId(value);
    const customer = customers.find(item => String(item.id) === value);
    if (customer) {
      if (Number(customer.plazo_max) < 2) setMode('endOfMonth');
      setMonths(current => Math.min(Math.max(2, current), Number(customer.plazo_max)));
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setNotice('');
    if (!quote) { setError('Espera a que se calcule una vista previa válida antes de registrar.'); return; }
    setBusy(true);
    try {
      const result = await post<{ saleId: number }>('/sales', {
        customerId: Number(customerId), productId: Number(productId),
        fechaCompra: date, cantidad: quantity, plazo: term,
      });
      setNotice(`Compra #${result.saleId} registrada para ${quote.customerName}.`);
      setQuantity(1);
      await loadRecent();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell role="ADMIN" title="Punto de venta">
      <div className="workspace-page">
        <p className="workspace-intro">Asigna una compra a la cuenta de un cliente. Revisa el crédito disponible y el cronograma antes de confirmar.</p>
        <Msg err={error} ok={notice} />
        {(customers.length === 0 || products.length === 0) && <div className="workspace-prerequisite">
          Para registrar una venta necesitas al menos un <Link href="/admin/clientes">cliente</Link> y un <Link href="/admin/productos">producto</Link>.
        </div>}
        <div className="workspace-grid workspace-pos-grid">
          <form onSubmit={submit} className="workspace-card workspace-form">
            <div className="workspace-card-heading"><span className="workspace-step"><ShoppingCart size={18} /></span><div><h2>Registrar compra</h2><p>Elige cliente, producto y forma de pago.</p></div></div>
            <div className="workspace-form-grid">
              <div className="workspace-field">
                <label htmlFor="sale-customer">Cliente</label>
                <select id="sale-customer" value={customerId} onChange={event => chooseCustomer(event.target.value)} required disabled={!customers.length}>
                  {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.nombre} · DNI {customer.dni}</option>)}
                </select>
              </div>
              <div className="workspace-field">
                <label htmlFor="sale-product">Producto</label>
                <select id="sale-product" value={productId} onChange={event => chooseProduct(event.target.value)} required disabled={!products.length}>
                  {products.map(product => <option key={product.id} value={product.id}>{product.nombre} · {selectedCustomer?.moneda ?? 'PEN'} {money(Number(product.precio_lista))}</option>)}
                </select>
              </div>
              <div className="workspace-form-pair">
                <Field label="Cantidad" name="cantidad" type="number" min="1" max="9999" step="1" value={quantity}
                  onChange={event => setQuantity(Number(event.target.value))} required help="Unidades del producto. El total se calcula con el precio de lista." />
                <Field label="Fecha de compra" name="fechaCompra" type="date" max={today()} value={date}
                  onChange={event => setDate(event.target.value)} required help="No puede ser posterior a hoy." />
              </div>
              <fieldset className="workspace-options">
                <legend>Forma de pago</legend>
                <label className={!selectedProduct || isAllowed(selectedProduct.permite_fin_mes) ? '' : 'option-disabled'}>
                  <input type="radio" name="mode" checked={mode === 'endOfMonth'} disabled={!selectedProduct || !isAllowed(selectedProduct.permite_fin_mes)}
                    onChange={() => setMode('endOfMonth')} />
                  Fin de mes · 1 pago
                </label>
                <label className={!selectedProduct || !selectedCustomer || Number(selectedCustomer.plazo_max) < 2 || !isAllowed(selectedProduct.permite_cuotas) ? 'option-disabled' : ''}>
                  <input type="radio" name="mode" checked={mode === 'installments'} disabled={!selectedProduct || !selectedCustomer || Number(selectedCustomer.plazo_max) < 2 || !isAllowed(selectedProduct.permite_cuotas)}
                    onChange={() => setMode('installments')} />
                  Cuotas mensuales
                </label>
              </fieldset>
              {mode === 'installments' && <Field label="Número de meses" name="plazo" type="number" min="2"
                max={selectedCustomer?.plazo_max ?? 60} value={months}
                onChange={event => setMonths(Number(event.target.value))} required help="Máximo según el plazo acordado con el cliente." />}
            </div>

            {quote && <section className="workspace-quote" aria-label="Vista previa de compra">
              <h3>Vista previa</h3>
              <div><span>Compra</span><strong>{quote.quantity} × {quote.productName}</strong></div>
              <div><span>Crédito disponible</span><strong>{quote.currency} {money(quote.available)}</strong></div>
              <div><span>Días hasta el primer vencimiento</span><strong>{quote.daysToPayment}</strong></div>
              <div><span>Interés estimado</span><strong>{quote.currency} {money(quote.interest)}</strong></div>
              <div><span>{term === 1 ? 'Total a fin de mes' : `Cuota mensual estimada (${term} meses)`}</span><strong>{quote.currency} {money(term === 1 ? quote.total : quote.firstPayment)}</strong></div>
              <div><span>Primer vencimiento</span><strong>{displayDate(quote.firstDue)}</strong></div>
              <div className="workspace-quote-total"><span>{quote.currency} {money(quote.amount)} · disponible después</span><strong>{quote.currency} {money(quote.remainingAvailable)}</strong></div>
            </section>}
            <button className={`${btnCls} workspace-primary-button`} disabled={busy || !quote || !customers.length || !products.length}>
              {busy ? 'Registrando…' : 'Confirmar compra'}
            </button>
          </form>

          <section className="workspace-card workspace-list-card">
            <div className="workspace-card-heading"><span className="workspace-step"><ReceiptText size={18} /></span><div><h2>Últimas compras</h2><p>Ventas a crédito registradas recientemente.</p></div></div>
            {recent.length === 0 ? <div className="workspace-empty"><ReceiptText size={30} /><strong>Aún no hay compras</strong><span>Las ventas confirmadas aparecerán aquí.</span></div> : (
              <div className="workspace-table-wrap"><table className="workspace-table">
                <thead><tr><th>Fecha</th><th>Cliente</th><th>Producto</th><th>Monto</th><th>Pago</th></tr></thead>
                <tbody>{recent.map(sale => <tr key={sale.id}>
                  <td>{displayDate(sale.fechaCompra)}</td>
                  <td>{sale.cliente}</td>
                  <td>{sale.cantidad} × {sale.producto}</td>
                  <td><strong>{sale.moneda} {money(Number(sale.monto))}</strong></td>
                  <td>{sale.plazo === 1 ? 'Fin de mes' : `${sale.plazo} cuotas`}</td>
                </tr>)}</tbody>
              </table></div>
            )}
          </section>
        </div>
      </div>
    </Shell>
  );
}
