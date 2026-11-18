import './globals.css';
export const metadata = { title: 'Fiado · créditos barriales' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">{children}</body></html>;
}
