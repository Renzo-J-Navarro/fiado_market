'use client';
import { useState } from 'react';
import Link from 'next/link';
import { post, setSession, Session } from '@/lib/api';
import Field, { btnCls, Msg } from '@/components/Field';
import AuthLayout from '@/components/AuthLayout';

const destination = (session: Session) => session.role === 'SUPERADMIN'
  ? '/superadmin/comercios'
  : session.role === 'ADMIN' ? session.tipoDocumento === 'DNI' ? '/negocio-personal' : '/comercio' : '/estado-cuenta';

export default function Login() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const session = await post<Session>('/auth/login', form);
      setSession(session);
      window.location.href = destination(session);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <AuthLayout title="Iniciar sesión" description="Ingresa a tu cuenta de negocio o de administrador.">
      <form method="post" onSubmit={submit} autoComplete="on" className="auth-fields">
        <Field label="Correo electrónico" name="email" type="email" autoComplete="username" required help="Usa el correo que registraste." />
        <Field label="Contraseña" name="password" type="password" autoComplete="current-password" required help="Escribe la contraseña de tu cuenta." />
        <Msg err={error} />
        <button className={`${btnCls} w-full`} disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
        <p className="auth-footer">¿Aún no tienes cuenta? <Link href="/registro">Registrarme</Link></p>
        <p className="auth-footer"><Link href="/login/cliente">Acceso para clientes con crédito</Link></p>
      </form>
    </AuthLayout>
  );
}
