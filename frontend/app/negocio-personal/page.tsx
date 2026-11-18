'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import { api } from '@/lib/api';

type Profile = { email: string; comercio: string; giro: string; tipoDocumento: 'DNI' | 'RUC'; documento: string };
const actions = [
  ['/admin/clientes', 'Personas fiadas', 'Registra y consulta las personas a quienes vendes a crédito.'],
  ['/admin/productos', 'Productos y servicios', 'Organiza los productos o servicios de tu negocio.'],
  ['/admin/pos', 'Registrar una venta', 'Anota una venta y calcula sus cuotas.'],
  ['/estado-cuenta', 'Cobros', 'Revisa saldos y registra los pagos recibidos.'],
];

export default function NegocioPersonal() {
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => { api<Profile>('/me').then(setProfile); }, []);
  return (
    <Shell role="ADMIN" title="Panel de mi negocio">
      <section className="dashboard-card mb-6 border-l-4 border-l-emerald-500">
        <p className="eyebrow text-emerald-700 dark:text-emerald-400">PERSONA NATURAL CON NEGOCIO</p>
        <h2 className="mt-2 text-xl font-semibold">{profile?.comercio ?? 'Mi negocio'}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {profile ? `${profile.giro} · DNI ${profile.documento}` : 'Cargando datos de tu negocio…'}
        </p>
        {profile && <p className="mt-2 text-xs text-slate-500">{profile.email}</p>}
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        {actions.map(([href, title, description]) => (
          <article key={href} className="dashboard-card flex flex-col items-start gap-3">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="flex-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
            <Link href={href} className="dashboard-link bg-emerald-700 hover:bg-emerald-600">Abrir</Link>
          </article>
        ))}
      </section>
    </Shell>
  );
}
