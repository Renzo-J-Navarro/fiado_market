'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { api, getSession, setSession, Session } from '@/lib/api';
import { inputCls } from '@/components/Field';

type Account = {
  id: number;
  storeId: number;
  nombre: string;
  comercio: string;
  tipo_documento: 'DNI' | 'RUC';
  documento: string;
  owner_dni: string | null;
  giro: string;
  email: string;
  role: 'ADMIN' | 'CLIENTE';
  active: boolean | number;
  comercio_estado: 'ACTIVE' | 'DISABLED' | 'PENDING';
  clientes: number;
};
type Store = {
  id: number;
  nombre_comercial: string;
  tipo_documento: 'DNI' | 'RUC';
  documento: string;
  status: 'ACTIVE' | 'DISABLED' | 'PENDING';
  email: string | null;
};

export default function Usuarios() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [nextAccounts, nextStores] = await Promise.all([
      api<Account[]>('/platform/accounts'), api<Store[]>('/platform/stores'),
    ]);
    setAccounts(nextAccounts);
    setStores(nextStores);
  }, []);
  useEffect(() => { load().catch(e => setError(e.message)); }, [load]);

  async function toggle(account: Account) {
    const active = !Boolean(account.active);
    setError(''); setNotice(''); setBusy(`account:${account.id}`);
    try {
      await api(`/platform/accounts/${account.id}`, { method: 'PATCH', body: JSON.stringify({ active }) });
      await load();
      setNotice(`${account.nombre}: cuenta ${active ? 'activada' : 'desactivada'}.`);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }
  async function removeAccount(account: Account) {
    if (!window.confirm(`¿Eliminar la cuenta de ${account.nombre}? Si tiene movimientos financieros, tendrás que desactivarla.`)) return;
    setError(''); setNotice(''); setBusy(`account:${account.id}`);
    try {
      await api(`/platform/accounts/${account.id}`, { method: 'DELETE' });
      await load();
      setNotice(`Se eliminó la cuenta de ${account.nombre}.`);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }
  async function saveDocument(account: Account, tipoDocumento: 'DNI' | 'RUC', documento: string) {
    setError(''); setNotice(''); setBusy(`document:${account.storeId}`);
    try {
      await api(`/platform/stores/${account.storeId}`, {
        method: 'PATCH', body: JSON.stringify({ tipoDocumento, documento }),
      });
      await load();
      setNotice(`Se actualizó el documento de ${account.nombre}.`);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }
  async function removeOrphan(store: Store) {
    if (!window.confirm(`Este registro no tiene una cuenta de acceso. ¿Eliminarlo para que el usuario pueda registrarse de nuevo?`)) return;
    setError(''); setNotice(''); setBusy(`orphan:${store.id}`);
    try {
      await api(`/platform/stores/${store.id}`, { method: 'DELETE' });
      await load();
      setNotice(`Se eliminó el registro incompleto de ${store.nombre_comercial}.`);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }
  async function assumeStore(account: Account) {
    setError(''); setNotice(''); setBusy(`assume:${account.storeId}`);
    try {
      const session = await api<Session>(`/platform/stores/${account.storeId}/assume`, { method: 'POST' });
      const globalSession = getSession();
      if (!globalSession || globalSession.role !== 'SUPERADMIN') throw new Error('La sesión de administrador global ya no está disponible.');
      localStorage.setItem('superadmin-session', JSON.stringify(globalSession));
      setSession(session);
      window.location.href = session.tipoDocumento === 'DNI' ? '/negocio-personal' : '/comercio';
    } catch (e) { setError((e as Error).message); setBusy(null); }
  }

  const orphanStores = stores.filter(store => !store.email);
  const activeCount = accounts.filter(account => Boolean(account.active) && account.comercio_estado === 'ACTIVE').length;
  const disabledCount = accounts.length - activeCount;

  return (
    <Shell role="SUPERADMIN" title="Usuarios y negocios">
      <p className="mb-5 text-sm leading-6 text-slate-600 dark:text-slate-300">
        Panel del administrador global. Aquí puedes revisar las cuentas registradas, cambiar documentos, activar o desactivar accesos y eliminar cuentas sin historial financiero. También puedes abrir un panel de negocio para probarlo; los cambios que hagas ahí sí se guardan.
      </p>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{notice}</p>}

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="dashboard-card"><p className="text-sm text-slate-500">Cuentas registradas</p><p className="mt-1 text-3xl font-bold">{accounts.length}</p></div>
        <div className="dashboard-card"><p className="text-sm text-slate-500">Activas</p><p className="mt-1 text-3xl font-bold text-emerald-700 dark:text-emerald-400">{activeCount}</p></div>
        <div className="dashboard-card"><p className="text-sm text-slate-500">Desactivadas o negocio inactivo</p><p className="mt-1 text-3xl font-bold text-amber-700 dark:text-amber-400">{disabledCount}</p></div>
      </section>

      <section className="dashboard-card overflow-hidden p-0">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="font-semibold">Cuentas de usuario</h2>
        </div>
        {accounts.length === 0 ? <p className="p-4 text-sm">Todavía no hay cuentas registradas.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950"><tr>
                <th className="px-3 py-3">Cuenta</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Documento</th>
                <th className="px-3 py-3">Email</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Acciones</th>
              </tr></thead>
              <tbody>{accounts.map(account => {
                const active = Boolean(account.active) && account.comercio_estado === 'ACTIVE';
                return <AccountRow key={`${account.role}:${account.id}`} account={account} active={active} busy={busy}
                  onToggle={() => toggle(account)} onDelete={() => removeAccount(account)}
                  onSaveDocument={(type, number) => saveDocument(account, type, number)}
                  onAssume={() => assumeStore(account)} />;
              })}</tbody>
            </table>
          </div>
        )}
      </section>

      {orphanStores.length > 0 && <section className="dashboard-card mt-6">
        <h2 className="font-semibold">Registros sin cuenta de acceso</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Son registros anteriores que no tienen correo y contraseña. Elimínalos para que la persona pueda registrarse correctamente.</p>
        <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
          {orphanStores.map(store => <li key={store.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
            <span className="font-medium">{store.nombre_comercial}</span>
            <span>{store.tipo_documento} {store.documento}</span>
            <span className="text-slate-500">{store.status}</span>
            <button disabled={busy === `orphan:${store.id}`} onClick={() => removeOrphan(store)}
              className="ml-auto rounded-lg border border-red-300 px-3 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300">
              Eliminar registro
            </button>
          </li>)}
        </ul>
      </section>}
    </Shell>
  );
}

function AccountRow({ account, active, busy, onToggle, onDelete, onSaveDocument, onAssume }: {
  account: Account;
  active: boolean;
  busy: string | null;
  onToggle: () => void;
  onDelete: () => void;
  onSaveDocument: (type: 'DNI' | 'RUC', number: string) => void;
  onAssume: () => void;
}) {
  const [type, setType] = useState<'DNI' | 'RUC'>(account.tipo_documento);
  const [number, setNumber] = useState(account.documento);
  const accountBusy = busy === `account:${account.id}`;
  const docBusy = busy === `document:${account.storeId}`;
  return (
    <tr className="border-t border-slate-200 align-top dark:border-slate-800">
      <td className="px-3 py-3"><strong>{account.nombre}</strong><p className="text-xs text-slate-500">{account.comercio}</p></td>
      <td className="px-3 py-3">{account.role === 'ADMIN' ? account.tipo_documento === 'RUC' ? 'Comercio con RUC' : 'Negocio personal' : 'Cliente'}</td>
      <td className="px-3 py-3">
        {account.role === 'ADMIN' ? <div className="flex min-w-48 gap-1">
          <select aria-label={`Tipo documento ${account.nombre}`} value={type} onChange={event => {
            const next = event.target.value as 'DNI' | 'RUC'; setType(next); setNumber('');
          }} className={inputCls}>
            <option value="RUC">RUC</option><option value="DNI">DNI</option>
          </select>
          <input aria-label={`Número documento ${account.nombre}`} value={number} maxLength={type === 'RUC' ? 11 : 8}
            onChange={event => setNumber(event.target.value.replace(/\D/g, '').slice(0, type === 'RUC' ? 11 : 8))}
            className={inputCls} />
          <button aria-label={`Guardar documento ${account.nombre}`} disabled={docBusy} onClick={() => onSaveDocument(type, number)}
            className="rounded-lg border border-slate-300 px-2 text-xs hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">Guardar</button>
        </div> : <>{account.tipo_documento} {account.documento}</>}
        {account.role === 'ADMIN' && account.tipo_documento === 'RUC' && account.owner_dni && <p className="mt-1 text-xs text-slate-500">Titular DNI {account.owner_dni}</p>}
      </td>
      <td className="px-3 py-3">{account.email}</td>
      <td className="px-3 py-3"><span className={active ? 'status-pill status-active' : 'status-pill status-disabled'}>{active ? 'Activa' : 'Desactivada'}</span></td>
      <td className="px-3 py-3"><div className="flex gap-2">
        {account.role === 'ADMIN' && <button disabled={!active || busy === `assume:${account.storeId}`} onClick={onAssume}
          title={!active ? 'Activa la cuenta antes de abrir el panel' : undefined}
          className="text-emerald-700 underline underline-offset-2 disabled:opacity-50 dark:text-emerald-300">Probar panel</button>}
        <button disabled={accountBusy} onClick={onToggle} className="text-indigo-700 underline underline-offset-2 disabled:opacity-50 dark:text-indigo-300">
          {active ? 'Desactivar' : 'Activar'}
        </button>
        <button disabled={accountBusy} onClick={onDelete} className="text-red-700 underline underline-offset-2 disabled:opacity-50 dark:text-red-300">Eliminar</button>
      </div></td>
    </tr>
  );
}
