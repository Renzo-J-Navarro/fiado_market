'use client';
import { useState } from 'react';
import Link from 'next/link';
import { post, setSession, Session } from '@/lib/api';
import Field, { btnCls, Msg, inputCls } from '@/components/Field';
import AuthLayout from '@/components/AuthLayout';

const businessTypes = ['Bodega', 'Carnicería', 'Peluquería', 'Bazar', 'Minimarket', 'Ferretería', 'Restaurante', 'Otro'];

export default function Registro() {
  const [tipoDocumento, setTipoDocumento] = useState<'RUC' | 'DNI'>('RUC');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const form = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    if (form.password !== form.confirmarPassword) {
      setError('Las contraseñas no coinciden.');
      setBusy(false);
      return;
    }
    delete form.confirmarPassword;
    try {
      const session = await post<Session>('/auth/register-store', form);
      setSession(session);
      window.location.href = session.tipoDocumento === 'DNI' ? '/negocio-personal' : '/comercio';
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const label = tipoDocumento === 'RUC' ? 'Nombre del comercio' : 'Nombre de tu negocio';
  return (
    <AuthLayout title="Registrarme" description="Crea tu cuenta para empezar a gestionar tu negocio." variant="register" wide>
      <form method="post" onSubmit={submit} autoComplete="on" className="auth-fields">
        <fieldset className="account-choice">
          <legend>¿Cómo vas a registrar tu negocio?</legend>
          <label className={tipoDocumento === 'RUC' ? 'choice selected' : 'choice'}>
            <input type="radio" name="tipoDocumentoChoice" checked={tipoDocumento === 'RUC'} onChange={() => setTipoDocumento('RUC')} />
            <span><strong>Tengo RUC</strong><small>Registro como comercio</small></span>
          </label>
          <label className={tipoDocumento === 'DNI' ? 'choice selected' : 'choice'}>
            <input type="radio" name="tipoDocumentoChoice" checked={tipoDocumento === 'DNI'} onChange={() => setTipoDocumento('DNI')} />
            <span><strong>Tengo DNI</strong><small>Persona natural con negocio</small></span>
          </label>
        </fieldset>
        <input type="hidden" name="tipoDocumento" value={tipoDocumento} />
        <Field label={tipoDocumento} name="documento" type="text" inputMode="numeric" autoComplete="off"
          minLength={tipoDocumento === 'RUC' ? 11 : 8} maxLength={tipoDocumento === 'RUC' ? 11 : 8}
          pattern={tipoDocumento === 'RUC' ? '[0-9]{11}' : '[0-9]{8}'} required
          onChange={event => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '').slice(0, tipoDocumento === 'RUC' ? 11 : 8); }}
          help={tipoDocumento === 'RUC' ? 'Ingresa los 11 dígitos del RUC.' : 'Ingresa los 8 dígitos de tu DNI.'} />
        {tipoDocumento === 'RUC' && <Field label="DNI personal del titular" name="dniPersonal" type="text" inputMode="numeric"
          autoComplete="off" minLength={8} maxLength={8} pattern="[0-9]{8}" required
          onChange={event => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '').slice(0, 8); }}
          help="DNI de la persona responsable del comercio." />}
        <Field label={label} name="nombre" required help="Nombre con el que identificarás tu negocio." />
        <div className="auth-select-field"><label htmlFor="giro">Tipo de negocio</label>
          <select id="giro" name="giro" required defaultValue="" className={inputCls}>
            <option value="" disabled>Selecciona un rubro</option>
            {businessTypes.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <Field label="Email de contacto" name="email" type="email" autoComplete="email" required help="Este correo también será tu usuario para iniciar sesión." />
        <Field label="Contraseña" name="password" type="password" autoComplete="new-password" minLength={8} required help="Usa al menos 8 caracteres." />
        <Field label="Confirmar contraseña" name="confirmarPassword" type="password" autoComplete="new-password" minLength={8} required help="Vuelve a escribir tu contraseña." />
        <Msg err={error} />
        <button className={`${btnCls} w-full`} disabled={busy}>{busy ? 'Creando cuenta…' : 'Crear mi cuenta'}</button>
        <p className="auth-footer">¿Ya tienes una cuenta? <Link href="/login">Iniciar sesión</Link></p>
      </form>
    </AuthLayout>
  );
}
