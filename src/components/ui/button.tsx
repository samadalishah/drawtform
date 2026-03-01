import * as React from "react";

type Variant = "default" | "outline" | "destructive";

function variantClass(variant: Variant): string {
  if (variant === "outline") {
    return "border border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";
  }
  if (variant === "destructive") {
    return "border border-rose-200 bg-rose-50/70 text-rose-700 shadow-sm hover:bg-rose-100/70 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/30";
  }
  return "border border-cyan-700 bg-cyan-600 text-white shadow-sm hover:bg-cyan-500 dark:border-cyan-300 dark:bg-cyan-300 dark:text-slate-900 dark:hover:bg-cyan-200";
}

export function Button({
  className = "",
  variant = "default",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50 ${variantClass(variant)} ${className}`}
      {...props}
    />
  );
}
