'use client';
import { useState } from 'react';
import Link from 'next/link';
import { post, setSession, Session } from '@/lib/api';
import Field, { btnCls, Msg, inputCls } from '@/components/Field';
import AuthLayout from '@/components/AuthLayout';

export default function LoginCliente() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setBusy(true);
    try {
      const session = await post<Session>('/auth/customer-login', Object.fromEntries(new FormData(event.currentTarget)));
      setSession(session);
      window.location.href = '/estado-cuenta';
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  return (
    <AuthLayout title="Acceso para clientes" description="Consulta el crédito que tienes en un negocio." variant="customer">
      <form method="post" onSubmit={submit} autoComplete="on" className="auth-fields">
        <Field label="Nombre del negocio" name="nombreNegocio" type="text" autoComplete="organization"
          maxLength={120} required help="Escribe el nombre del negocio donde tienes el crédito." />
        <Field label="Tu DNI personal" name="dni" type="text" inputMode="numeric" minLength={8} maxLength={8}
          pattern="[0-9]{8}" required onChange={event => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '').slice(0, 8); }}
          help="DNI con el que el negocio registró tu crédito." />
        <Field label="Contraseña" name="password" type="password" autoComplete="current-password" required help="Si todavía no configuraste tu clave, solicita al negocio el enlace de activación." />
        <Msg err={error} />
        <button className={`${btnCls} w-full`} disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
        <p className="auth-footer"><Link href="/login">Volver a inicio de sesión</Link></p>
      </form>
    </AuthLayout>
  );
}
