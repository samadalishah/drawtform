import * as React from "react";

export function Select({ className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-cyan-900/40 ${className}`}
      {...props}
    />
  );
}
