'use client';
import { Suspense, useState } from 'react'; import { useSearchParams } from 'next/navigation'; import Link from 'next/link'; import { post } from '@/lib/api'; import Field, { btnCls, Msg } from '@/components/Field'; import AuthLayout from '@/components/AuthLayout';
function Form() {
  const token = useSearchParams().get('token') ?? ''; const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(''); const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (!token) return setErr('El enlace de acceso no es válido. Pide uno nuevo al negocio.');
    if (f.password !== f.confirm) return setErr('Las contraseñas no coinciden');
    try { await post('/auth/set-password', { token, password: f.password }); setOk('Contraseña creada. Ya puedes iniciar sesión.'); } catch (x) { setErr((x as Error).message); }
  }
  return (
    <AuthLayout title="Crea tu contraseña" description="Activa tu acceso para consultar el crédito que tienes en el negocio." variant="customer">
      <form onSubmit={submit} className="auth-fields">
        <Field label="Nueva contraseña" name="password" type="password" autoComplete="new-password" minLength={8} required disabled={!token || Boolean(ok)} help="Mínimo 8 caracteres. No puede contener tu DNI." />
        <Field label="Repetir contraseña" name="confirm" type="password" autoComplete="new-password" minLength={8} required disabled={!token || Boolean(ok)} help="Escríbela de nuevo para confirmar." />
        <Msg err={err} ok={ok} />
        {!ok && <button className={`${btnCls} w-full workspace-primary-button`} disabled={!token}>Crear contraseña</button>}
        {ok && <p className="auth-footer"><Link href="/login/cliente">Ir al acceso para clientes</Link></p>}
        {!token && <p className="auth-footer">El enlace puede haber vencido o ya se utilizó. Solicita otro en tu negocio.</p>}
      </form>
    </AuthLayout>
  );
}
export default function Activar() { return <Suspense><Form /></Suspense>; }
