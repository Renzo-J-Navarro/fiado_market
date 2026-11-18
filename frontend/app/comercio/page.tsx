'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';

type Profile = { email: string; comercio: string; giro: string; tipoDocumento: 'DNI' | 'RUC'; documento: string; ownerDni: string | null };
const actions = [
  ['/admin/clientes', 'Gestionar clientes', 'Registra clientes y administra sus líneas de crédito.'],
  ['/admin/productos', 'Productos y servicios', 'Configura los precios y las modalidades de pago.'],
  ['/admin/pos', 'Registrar una venta', 'Genera ventas a crédito y consulta el cronograma.'],
  ['/estado-cuenta', 'Cobros y estados de cuenta', 'Consulta deudas y registra pagos recibidos.'],
];

export default function Comercio() {
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => { api<Profile>('/me').then(setProfile); }, []);
  return (
    <Shell role="ADMIN" title="Panel de tu comercio">
      <section className="dashboard-card mb-6">
        <p className="eyebrow">CUENTA COMERCIAL</p>
        <h2 className="mt-2 text-xl font-semibold">{profile?.comercio ?? 'Tu negocio'}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {profile ? `${profile.giro} · RUC ${profile.documento}${profile.ownerDni ? ` · Titular DNI ${profile.ownerDni}` : ''}` : 'Cargando datos del comercio…'}
        </p>
        {profile && <p className="mt-2 text-xs text-slate-500">{profile.email}</p>}
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        {actions.map(([href, title, description]) => (
          <article key={href} className="dashboard-card flex flex-col items-start gap-3">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="flex-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
            <Link href={href} className="dashboard-link">Abrir</Link>
          </article>
        ))}
      </section>
    </Shell>
  );
}
