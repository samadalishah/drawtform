"use client";

import type { ThumbnailKey } from "@/lib/thumbnails";

const THUMBNAIL_COLORS: Record<
  string,
  { bg: string; border: string; icon: string }
> = {
  env: { bg: "bg-slate-100/90", border: "border-slate-300", icon: "text-slate-700" },
  module: { bg: "bg-amber-50", border: "border-amber-300", icon: "text-amber-700" },
  provider: { bg: "bg-cyan-50", border: "border-cyan-300", icon: "text-cyan-700" },
  "aws-rds": { bg: "bg-orange-50", border: "border-orange-400", icon: "text-orange-700" },
  "aws-ec2": { bg: "bg-orange-50", border: "border-orange-400", icon: "text-orange-700" },
  "aws-s3": { bg: "bg-orange-50", border: "border-orange-400", icon: "text-orange-600" },
  "aws-lambda": { bg: "bg-orange-50", border: "border-orange-400", icon: "text-orange-700" },
  "aws-vpc": { bg: "bg-orange-50", border: "border-orange-400", icon: "text-orange-600" },
  "gcp-cloud-sql": { bg: "bg-blue-50", border: "border-blue-400", icon: "text-blue-700" },
  "gcp-gke": { bg: "bg-blue-50", border: "border-blue-400", icon: "text-blue-700" },
  "gcp-compute": { bg: "bg-blue-50", border: "border-blue-400", icon: "text-blue-600" },
  "gcp-storage": { bg: "bg-blue-50", border: "border-blue-400", icon: "text-blue-600" },
  "azure-sql": { bg: "bg-cyan-50", border: "border-cyan-400", icon: "text-cyan-700" },
  "azure-vm": { bg: "bg-cyan-50", border: "border-cyan-400", icon: "text-cyan-700" },
  terraform: { bg: "bg-slate-100", border: "border-slate-400", icon: "text-slate-700" },
  default: { bg: "bg-zinc-50", border: "border-zinc-300", icon: "text-zinc-600" },
};

const ICON_SVG: Record<string, React.ReactNode> = {
  env: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  ),
  module: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  provider: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  ),
  "aws-rds": (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
      <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l6.9 3.45L12 11.09 5.1 7.63 12 4.18zM4 8.82l7 3.5v7.36l-7-3.5V8.82zm9 10.86v-7.36l7-3.5v7.36l-7 3.5z" />
    </svg>
  ),
  "gcp-cloud-sql": (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
      <path d="M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2zm2 2v12h8V6H8zm2 2h4v4h-4V8zm0 6h4v2h-4v-2z" />
    </svg>
  ),
  "aws-ec2": (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path fill="none" stroke="currentColor" strokeWidth="1.5" d="M8 8h8v8H8z" />
    </svg>
  ),
  "gcp-compute": (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
      <rect x="5" y="6" width="14" height="12" rx="1" />
      <path d="M8 10h8v2H8v-2zm0 4h5v2H8v-2z" fill="white" fillOpacity="0.9" />
    </svg>
  ),
  terraform: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
      <path d="M4 2L2 5v14l2 3 2-3V8l12 6v8l2-3 2 3V11L4 5V2zm0 3l2 1v2L4 7V5zm16 9l-2-1v-2l2 1v2z" />
    </svg>
  ),
  default: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  ),
};

export function ResourceThumbnail({
  thumbnailKey,
  label,
  kind,
  className = "",
}: {
  thumbnailKey?: ThumbnailKey | string | null;
  label: string;
  kind?: string;
  className?: string;
}) {
  const key = thumbnailKey || (kind === "env" ? "env" : kind === "module" ? "module" : kind === "provider" ? "provider" : "default");
  const style = THUMBNAIL_COLORS[key] || THUMBNAIL_COLORS.default;
  const icon = ICON_SVG[key] || ICON_SVG.default;

  return (
    <div
      className={`
        flex flex-col items-center justify-center rounded-xl border p-3 min-w-[110px] max-w-[150px]
        ${style.bg} ${style.border} ${className}
      `}
    >
      <div className={style.icon}>{icon}</div>
      <span className="mt-1.5 text-center text-xs font-semibold tracking-tight break-words text-slate-800" title={label}>
        {label.length > 14 ? `${label.slice(0, 12)}…` : label}
      </span>
    </div>
  );
}
