'use client';
import { useEffect } from 'react'; import { useRouter } from 'next/navigation'; import { getSession } from '@/lib/api';
export default function Home() {
  const r = useRouter();
  useEffect(() => {
    const s = getSession();
    r.replace(!s ? '/login' : s.role === 'SUPERADMIN' ? '/superadmin/comercios'
      : s.role === 'ADMIN' ? s.tipoDocumento === 'DNI' ? '/negocio-personal' : '/comercio' : '/estado-cuenta');
  }, [r]);
  return null;
}
