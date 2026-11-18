const API = process.env.NEXT_PUBLIC_API ?? 'http://localhost:4000/api';
export type Session = {
  token: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'CLIENTE';
  customerId?: number | null;
  storeId?: number | null;
  tipoDocumento?: 'DNI' | 'RUC' | null;
  platformAdmin?: boolean;
};
export const getSession = (): Session | null => { try { return JSON.parse(localStorage.getItem('session') || 'null'); } catch { return null; } };
export const setSession = (s: Session) => localStorage.setItem('session', JSON.stringify(s));
export const logout = () => { localStorage.removeItem('session'); window.location.href = '/login'; };
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const t = getSession()?.token;
  const r = await fetch(API + path, { ...init, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...init.headers } });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && t) { logout(); }
  if (!r.ok) throw new Error(j.error ?? 'Error de red');
  return j as T;
}
export const post = <T,>(p: string, body: unknown) => api<T>(p, { method: 'POST', body: JSON.stringify(body) });
export const money = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const today = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
