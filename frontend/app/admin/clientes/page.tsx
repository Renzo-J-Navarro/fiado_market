'use client';
import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Users, Wallet } from 'lucide-react';
import Shell from '@/components/Shell';
import Field, { btnCls, Msg } from '@/components/Field';
import { api, post, money } from '@/lib/api';

type Customer = {
  id: number;
  nombre: string;
  dni: string;
  lmc: number;
  creditoUsado: number;
  disponible: number;
  dia_corte: number;
  dia_pago: number;
  tipo_tasa: 'TEA' | 'TNA';
  tasa: number;
  tasa_mora: number;
  moneda: string;
  plazo_max: number;
  accesoActivo: boolean;
};

type Invite = { name: string; url: string };

const formatCurrency = (amount: number, currency = 'PEN') =>
  `${currency === 'PEN' ? 'S/' : currency} ${money(Number(amount) || 0)}`;

export default function Clientes() {
  const [list, setList] = useState<Customer[]>([]);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [invite, setInvite] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await api<Customer[]>('/customers'));
      setErr('');
    } catch (error) {
      setErr((error as Error).message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function showInvite(token: string, name: string) {
    setInvite({ name, url: `${window.location.origin}/activar?token=${encodeURIComponent(token)}` });
    setCopied(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErr(''); setNotice(''); setInvite(null); setBusy(true);
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (Number(values.diaPago) < Number(values.diaCorte)) {
      setErr('El día de pago debe ser igual o posterior al día de corte.');
      setBusy(false);
      return;
    }
    try {
      const result = await post<{ setupToken: string }>('/customers', values);
      const name = String(values.nombre);
      showInvite(result.setupToken, name);
      setNotice(`${name} ya está en tu lista. Comparte el enlace para que cree su contraseña.`);
      form.reset();
      await load();
    } catch (error) {
      setErr((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resetAccess(customer: Customer) {
    setErr(''); setNotice(''); setInvite(null); setBusy(true);
    try {
      const result = await post<{ setupToken: string }>(`/customers/${customer.id}/reset-token`, {});
      showInvite(result.setupToken, customer.nombre);
      setNotice(customer.accesoActivo
        ? `Se generó un enlace nuevo para que ${customer.nombre} actualice su contraseña.`
        : `Comparte el enlace con ${customer.nombre} para que cree su contraseña.`);
    } catch (error) {
      setErr((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      setErr('');
    } catch {
      setErr('No se pudo copiar automáticamente. Selecciona y copia el enlace manualmente.');
    }
  }

  const activeAccess = list.filter(customer => customer.accesoActivo).length;
  const availableTotals = list.reduce<Record<string, number>>((totals, customer) => {
    totals[customer.moneda] = (totals[customer.moneda] ?? 0) + Number(customer.disponible);
    return totals;
  }, {});
  const availableText = Object.entries(availableTotals)
    .map(([currency, amount]) => formatCurrency(amount, currency))
    .join(' · ') || 'S/ 0.00';

  return (
    <Shell role="ADMIN" title="Gestión de clientes">
      <div className="workspace-page">
        <p className="workspace-intro">Registra a las personas a quienes les fías, define sus condiciones y comparte un enlace seguro para que creen su acceso.</p>

        <div className="workspace-stats">
          <div className="workspace-stat"><span className="workspace-stat-icon"><Users size={18} /></span><span><small>Clientes</small><strong>{list.length}</strong></span></div>
          <div className="workspace-stat"><span className="workspace-stat-icon"><KeyRound size={18} /></span><span><small>Accesos activados</small><strong>{activeAccess} / {list.length}</strong></span></div>
          <div className="workspace-stat"><span className="workspace-stat-icon"><Wallet size={18} /></span><span><small>Crédito disponible</small><strong>{availableText}</strong></span></div>
        </div>

        <Msg err={err} ok={notice} />
        {invite && <section className="workspace-invite" aria-label="Enlace de acceso del cliente">
          <div>
            <h2>Enlace para {invite.name}</h2>
            <p>Envíale este enlace para crear su contraseña. Es personal, de un solo uso y vence en 48 horas. Luego podrá ingresar con el documento de tu negocio, su DNI y la contraseña que cree.</p>
            <code>{invite.url}</code>
          </div>
          <div className="workspace-invite-actions">
            <button type="button" className="workspace-secondary-button" onClick={copyInvite}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copiado' : 'Copiar enlace'}</button>
            <a className="workspace-secondary-button" href={`https://wa.me/?text=${encodeURIComponent(`Hola ${invite.name}, crea tu contraseña para consultar tu crédito aquí: ${invite.url}`)}`} target="_blank" rel="noreferrer">Compartir por WhatsApp</a>
          </div>
        </section>}

        <div className="workspace-grid workspace-customer-grid">
          <form onSubmit={submit} className="workspace-card workspace-form">
            <div className="workspace-card-heading"><span className="workspace-step">01</span><div><h2>Nuevo cliente</h2><p>Registra sus datos y acuerda su línea de crédito.</p></div></div>
            <div className="workspace-form-grid">
              <Field label="Nombre completo" name="nombre" required maxLength={120} autoComplete="name" help="Nombre y apellidos de la persona." />
              <Field label="DNI" name="dni" type="text" inputMode="numeric" autoComplete="off" minLength={8} maxLength={8} pattern="[0-9]{8}" required
                onChange={event => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '').slice(0, 8); }}
                help="DNI de 8 dígitos; también se usa para iniciar sesión." />
              <Field label="Línea de crédito" name="lmc" type="number" step="0.01" min="0.01" max="500" required help="Monto máximo de deuda: S/ 500.00." />
              <div className="workspace-form-pair">
                <Field label="Día de corte" name="diaCorte" type="number" min="1" max="30" step="1" defaultValue="20" required help="Último día del ciclo de compras." />
                <Field label="Día de pago" name="diaPago" type="number" min="1" max="30" step="1" defaultValue="26" required help="Debe ser igual o posterior al corte." />
              </div>
              <div className="workspace-form-pair">
                <Field label="Tipo de tasa" name="tipoTasa" options={['TEA', 'TNA']} help="Tasa efectiva o nominal anual." />
                <Field label="Tasa pactada (%)" name="tasa" type="number" step="0.01" min="0.01" max="114.13" required help="Tope legal: 114.13% anual." />
              </div>
              <Field label="Tasa moratoria anual (%)" name="tasaMora" type="number" step="0.01" min="0" max="15" defaultValue="0" required help="Se aplica por atraso; máximo 15%." />
              <div className="workspace-form-pair">
                <Field label="Moneda" name="moneda" options={['PEN', 'USD']} help="Moneda de la línea y de los créditos." />
                <Field label="Plazo máximo (meses)" name="plazoMax" type="number" min="1" max="60" step="1" defaultValue="12" required help="Máximo de cuotas mensuales que puede elegir." />
              </div>
            </div>
            <p className="workspace-form-note">Al guardar, Fiado crea el perfil del cliente y prepara un enlace para que establezca su propia contraseña.</p>
            <button className={`${btnCls} workspace-primary-button`} disabled={busy}>{busy ? 'Guardando…' : 'Guardar cliente y crear acceso'}</button>
          </form>

          <section className="workspace-card workspace-list-card">
            <div className="workspace-card-heading"><span className="workspace-step">02</span><div><h2>Mis clientes</h2><p>Línea, saldo disponible y estado de acceso.</p></div></div>
            {list.length === 0 ? <div className="workspace-empty"><Users size={30} /><strong>Aún no registras clientes</strong><span>Cuando guardes el primero, aparecerá aquí.</span></div> : (
              <div className="workspace-table-wrap">
                <table className="workspace-table">
                  <thead><tr><th>Cliente</th><th>Línea / disponible</th><th>Corte / pago</th><th>Tasa</th><th>Acceso</th><th aria-label="Acciones" /></tr></thead>
                  <tbody>{list.map(customer => <tr key={customer.id}>
                    <td><strong>{customer.nombre}</strong><small>DNI {customer.dni}</small></td>
                    <td><strong>{formatCurrency(customer.lmc, customer.moneda)}</strong><small>Disponible {formatCurrency(customer.disponible, customer.moneda)}</small></td>
                    <td>{customer.dia_corte} / {customer.dia_pago}<small>Día de corte / pago</small></td>
                    <td>{customer.tipo_tasa} {Number(customer.tasa)}%<small>Mora {Number(customer.tasa_mora)}%</small></td>
                    <td><span className={customer.accesoActivo ? 'workspace-access workspace-access-active' : 'workspace-access'}>{customer.accesoActivo ? 'Activo' : 'Pendiente'}</span></td>
                    <td><button type="button" disabled={busy} onClick={() => resetAccess(customer)} className="workspace-text-button">{customer.accesoActivo ? 'Restablecer clave' : 'Crear acceso'}</button></td>
                  </tr>)}</tbody>
                </table>
              </div>
            )}
            {list.length > 0 && <p className="workspace-list-note">La persona inicia sesión desde <strong>Acceso para clientes</strong> con el RUC o DNI de tu negocio, su DNI y la contraseña que cree.</p>}
          </section>
        </div>
      </div>
    </Shell>
  );
}
