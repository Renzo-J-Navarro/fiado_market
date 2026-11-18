'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, logout, Session } from '@/lib/api';

type LinkItem = readonly [string, string];
const superadminNav: LinkItem[] = [['/superadmin/comercios', 'Usuarios y negocios']];
const rucNav: LinkItem[] = [
  ['/comercio', 'Inicio'],
  ['/admin/clientes', 'Clientes'],
  ['/admin/productos', 'Productos'],
  ['/admin/pos', 'Ventas'],
  ['/estado-cuenta', 'Cobros'],
];
const dniNav: LinkItem[] = [
  ['/negocio-personal', 'Inicio'],
  ['/admin/clientes', 'Personas fiadas'],
  ['/admin/productos', 'Productos y servicios'],
  ['/admin/pos', 'Registrar venta'],
  ['/estado-cuenta', 'Cobros'],
];
const clientNav: LinkItem[] = [['/estado-cuenta', 'Mi estado de cuenta']];
const home = (session: Session) => session.role === 'SUPERADMIN'
  ? '/superadmin/comercios'
  : session.role === 'ADMIN' ? session.tipoDocumento === 'DNI' ? '/negocio-personal' : '/comercio' : '/estado-cuenta';
function returnToGlobalAdmin() {
  const saved = localStorage.getItem('superadmin-session');
  if (!saved) { localStorage.removeItem('superadmin-session'); logout(); return; }
  localStorage.setItem('session', saved);
  localStorage.removeItem('superadmin-session');
  window.location.href = '/superadmin/comercios';
}

export default function Shell({ role, title, children }: { role: Session['role']; title: string; children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSessionState] = useState<Session | null>(null);
  useEffect(() => {
    const current = getSession();
    if (!current) router.replace('/login');
    else if (current.role !== role) router.replace(home(current));
    else setSessionState(current);
  }, [role, router]);
  if (!session) return null;
  const nav = session.role === 'SUPERADMIN' ? superadminNav
    : session.role === 'ADMIN' ? session.tipoDocumento === 'DNI' ? dniNav : rucNav : clientNav;
  const endSession = () => {
    localStorage.removeItem('superadmin-session');
    logout();
  };
  return (
    <div className="min-h-screen">
      <header className="app-header">
        <Link href={home(session)} className="app-brand"><span className="brand-mini">F</span> Fiado</Link>
        <nav className="app-nav">{nav.map(([href, label]) => <Link key={href} href={href} className="nav-link">{label}</Link>)}</nav>
        <button onClick={endSession} className="logout-link">Cerrar sesión</button>
      </header>
      <main className="app-main">
        {session.platformAdmin && <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <span><strong>Modo de prueba global.</strong> Estás usando el panel de este negocio; los cambios se guardan en sus datos.</span>
          <button onClick={returnToGlobalAdmin} className="font-semibold underline underline-offset-2">Volver a gestión global</button>
        </div>}
        <h1 className="page-title">{title}</h1>
        {children}
      </main>
    </div>
  );
}
