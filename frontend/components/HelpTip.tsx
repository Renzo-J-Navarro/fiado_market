import { Info } from 'lucide-react';
export default function HelpTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group align-middle ml-1">
      <button type="button" aria-label={text} className="text-slate-400 hover:text-indigo-500 focus:outline-none"><Info size={14} /></button>
      <span role="tooltip" className="pointer-events-none absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-1 w-56 rounded-md bg-slate-900 dark:bg-slate-100 px-2 py-1 text-xs font-normal normal-case text-white dark:text-slate-900 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition">{text}</span>
    </span>
  );
}
