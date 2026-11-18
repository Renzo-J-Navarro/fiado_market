import HelpTip from './HelpTip';
export const inputCls = 'mt-1 block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5';
export const btnCls = 'rounded-md bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 text-sm font-medium disabled:opacity-50';
type P = { label: string; help: string; options?: string[] } & React.InputHTMLAttributes<HTMLInputElement>;
export default function Field({ label, help, options, ...p }: P) {
  const { id, name } = p; const fid = id ?? name;
  return (
    <div className="text-sm"><label htmlFor={fid}>{label}</label><HelpTip text={help} />
      {options ? <select id={fid} name={name} defaultValue={p.defaultValue as string} className={inputCls}>{options.map(o => <option key={o}>{o}</option>)}</select>
        : <input id={fid} {...p} className={inputCls} />}</div>
  );
}
export const Msg = ({ err, ok }: { err?: string; ok?: string }) => err ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{err}</p> : ok ? <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">{ok}</p> : null;
