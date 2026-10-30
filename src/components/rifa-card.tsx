import { ArrowUpRight, CalendarClock, Ticket, Trophy } from "lucide-react";
import Link from "next/link";

import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import type { RifaListada } from "@/server/queries";

import { ProgressBar, RifaStatusBadge } from "./ui";

export function RifaCard({ rifa }: { rifa: RifaListada }) {
  const { resumo } = rifa;

  return (
    <Link
      href={`/rifas/${rifa.id}`}
      className="group card flex flex-col p-5 transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <RifaStatusBadge status={rifa.status} />
            <span className="text-[11px] text-ink-400">{formatCurrency(rifa.valorNumero)} / número</span>
          </div>
          <h3 className="mt-2.5 line-clamp-1 font-display text-xl font-semibold text-ink-950">{rifa.titulo}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-ink-500">{rifa.descricao}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink-100 text-ink-400 transition group-hover:border-brand-200 group-hover:text-brand-700">
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-ink-600">
            {resumo.reservados} de {resumo.totalNumeros} reservados
          </span>
          <span className="font-semibold text-brand-800">{formatPercent(resumo.ocupacao)}</span>
        </div>
        <ProgressBar value={resumo.ocupacao} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-brand-50/80 px-3 py-2">
          <p className="text-ink-500">Arrecadado</p>
          <p className="mt-0.5 font-semibold text-brand-900">{formatCurrency(resumo.arrecadado)}</p>
        </div>
        <div className="rounded-xl bg-amber-50/80 px-3 py-2">
          <p className="text-ink-500">A receber</p>
          <p className="mt-0.5 font-semibold text-amber-900">{formatCurrency(resumo.aReceber)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-100 pt-3 text-[11px] text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          Sorteio {formatDate(rifa.dataSorteio)}
        </span>
        {rifa.sorteio ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-violet-800">
            <Trophy className="h-3.5 w-3.5" aria-hidden />
            {String(rifa.sorteio.numeroVencedor).padStart(3, "0")} · {rifa.sorteio.participante.nome}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Ticket className="h-3.5 w-3.5" aria-hidden />
            {resumo.disponiveis} disponíveis
          </span>
        )}
      </div>
    </Link>
  );
}
