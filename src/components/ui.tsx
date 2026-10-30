import type { ReactNode } from "react";

import type { PagamentoStatus, RifaStatus } from "@prisma/client";

import { cn } from "@/lib/cn";
import {
  PAGAMENTO_LABEL,
  PAGAMENTO_STYLE,
  RIFA_STATUS_LABEL,
  RIFA_STATUS_STYLE,
} from "@/lib/status";

export function RifaStatusBadge({ status }: { status: RifaStatus }) {
  return <span className={cn("badge", RIFA_STATUS_STYLE[status])}>{RIFA_STATUS_LABEL[status]}</span>;
}

export function PagamentoBadge({ status }: { status: PagamentoStatus }) {
  return <span className={cn("badge", PAGAMENTO_STYLE[status])}>{PAGAMENTO_LABEL[status]}</span>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h1 className="display-title truncate">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-ink-500 sm:text-[15px]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  tone?: "neutral" | "brand" | "amber" | "violet" | "sky";
}) {
  const tones = {
    neutral: "bg-ink-100 text-ink-700",
    brand: "bg-brand-100 text-brand-800",
    amber: "bg-amber-100 text-amber-800",
    violet: "bg-violet-100 text-violet-800",
    sky: "bg-sky-100 text-sky-800",
  };

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tones[tone])}>{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-ink-950">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2.5 w-full overflow-hidden rounded-full bg-ink-100", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all duration-500"
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-ink-100 text-ink-500">{icon}</div> : null}
      <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-brand-500/15 ring-1 ring-brand-400/30">
        <span className="h-5 w-5 rounded-full border-2 border-brand-300" />
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-400" />
      </span>
      {!compact ? (
        <span className="font-display text-xl font-semibold tracking-tight text-white">
          Rifas<span className="text-brand-400">.</span>
        </span>
      ) : null}
    </span>
  );
}

export function Alert({ type = "error", children }: { type?: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-brand-200 bg-brand-50 text-brand-800",
    info: "border-sky-200 bg-sky-50 text-sky-800",
  };
  return (
    <div role={type === "error" ? "alert" : "status"} className={cn("rounded-xl border px-3.5 py-2.5 text-sm", styles[type])}>
      {children}
    </div>
  );
}
