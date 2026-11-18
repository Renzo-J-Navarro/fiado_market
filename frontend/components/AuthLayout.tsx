import type { ReactNode } from 'react';

type AuthLayoutProps = {
  children: ReactNode;
  title: string;
  description: string;
  variant?: 'login' | 'register' | 'customer';
  wide?: boolean;
};

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none">
        <path d="M8 13.5h22a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3v-15a3 3 0 0 1 3-3h18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.5 17h25.2v8.5H7.5z" fill="currentColor" fillOpacity=".18" />
        <path d="M27 21.3h.1" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        <path d="m13 8 4 4 7-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function LedgerIllustration() {
  return (
    <svg className="auth-illustration" viewBox="0 0 320 230" fill="none" aria-hidden="true">
      <rect x="64" y="34" width="190" height="156" rx="18" fill="white" fillOpacity=".16" stroke="white" strokeOpacity=".5" strokeWidth="2" />
      <path d="M93 77h82M93 99h131M93 121h82M93 143h111" stroke="white" strokeOpacity=".83" strokeWidth="8" strokeLinecap="round" />
      <circle cx="221" cy="63" r="31" fill="#F6FEFF" />
      <path d="M221 48v30m-10-22c0-4 4-7 10-7s10 3 10 7-4 7-10 7-10 3-10 7 4 7 10 7 10-3 10-7" stroke="#159BCB" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="78" cy="177" r="26" fill="#B9F5F1" fillOpacity=".88" />
      <path d="m68 178 7 7 14-16" stroke="#087F8C" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AuthLayout({ children, title, description, variant = 'login', wide = false }: AuthLayoutProps) {
  const greeting = variant === 'register' ? 'Tu negocio, más organizado.' : variant === 'customer' ? 'Tu cuenta, siempre a la mano.' : 'Qué bueno verte de nuevo.';
  const support = variant === 'register'
    ? 'Registra tus ventas, organiza tus clientes y lleva tus cuentas desde un solo lugar.'
    : variant === 'customer'
      ? 'Consulta la información de tu crédito de forma sencilla y segura.'
      : 'Administra tus ventas al fiado y mantén el control de tu negocio.';

  return (
    <main className="auth-page">
      <section className={`auth-card${wide ? ' auth-card-wide' : ''}`}>
        <div className="auth-form">
          <div className="auth-brand">
            <BrandMark />
            <span><strong>Fiado</strong><small>GESTIÓN PARA TU NEGOCIO</small></span>
          </div>
          <div className="auth-heading">
            <p className="eyebrow">{variant === 'register' ? 'EMPIEZA EN FIADO' : 'BIENVENIDO A FIADO'}</p>
            <h1>{title}</h1>
            <p className="muted">{description}</p>
          </div>
          {children}
        </div>
        <aside className="auth-aside">
          <span className="auth-orbit auth-orbit-one" />
          <span className="auth-orbit auth-orbit-two" />
          <div className="auth-aside-content">
            <p className="auth-aside-kicker">CRÉDITOS BARRIALES, MÁS SIMPLES</p>
            <LedgerIllustration />
            <h2>{greeting}</h2>
            <p>{support}</p>
            <div className="auth-aside-points">
              <span><i /> Clientes y créditos</span>
              <span><i /> Ventas y cobros</span>
              <span><i /> Todo en un solo lugar</span>
            </div>
          </div>
          <span className="auth-aside-footer">Cuentas claras. Negocios que avanzan.</span>
        </aside>
      </section>
    </main>
  );
}
