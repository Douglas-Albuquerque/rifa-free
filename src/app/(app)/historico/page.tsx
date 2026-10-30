import { ArrowRight, CalendarClock, Hash, ShieldCheck, Ticket, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { requireSession } from "@/lib/auth";
import { formatDateTime, formatNumber } from "@/lib/format";
import { listarHistoricoSorteios } from "@/server/queries";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Histórico de sorteios" };
export const dynamic = "force-dynamic";

export default async function HistoricoPage() {
  await requireSession();
  const sorteios = await listarHistoricoSorteios();

  return (
    <>
      <PageHeader
        eyebrow="Histórico"
        title="Sorteios realizados"
        description="Registro permanente dos resultados, com data, ganhador e conjunto de números elegíveis."
      />

      {sorteios.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Trophy className="h-6 w-6" />}
            title="Nenhum sorteio realizado"
            description="Quando uma rifa for sorteada, o resultado aparecerá aqui de forma permanente."
            action={
              <Link href="/rifas" className="btn-secondary">
                Ver minhas rifas
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3 text-xs text-ink-500">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-ink-200">
              <Trophy className="h-3.5 w-3.5 text-amber-600" aria-hidden />
              {sorteios.length} sorteio(s) registrado(s)
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-ink-200">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-700" aria-hidden />
              Resultados protegidos contra sobrescrita
            </span>
          </div>

          <ol className="space-y-3">
            {sorteios.map((sorteio) => (
              <li key={sorteio.id} className="card overflow-hidden">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
                      <Trophy className="h-6 w-6" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-2xl font-semibold text-ink-950">
                          Nº {formatNumber(sorteio.numeroVencedor)}
                        </p>
                        <span className="badge bg-amber-50 text-amber-800 ring-amber-200">Vencedor</span>
                      </div>
                      <p className="mt-0.5 truncate font-semibold text-ink-900">{sorteio.participante.nome}</p>
                      <Link
                        href={`/rifas/${sorteio.rifaId}/sorteio`}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-800 hover:text-brand-950"
                      >
                        <Ticket className="h-3.5 w-3.5" aria-hidden />
                        {sorteio.rifa.titulo}
                        <ArrowRight className="h-3 w-3" aria-hidden />
                      </Link>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-ink-100 pt-3 text-xs sm:w-[300px] sm:border-0 sm:pt-0">
                    <div>
                      <p className="flex items-center gap-1 text-ink-500">
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                        Data e hora
                      </p>
                      <p className="mt-0.5 font-semibold text-ink-900">{formatDateTime(sorteio.dataHoraSorteio)}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-ink-500">
                        <Hash className="h-3.5 w-3.5" aria-hidden />
                        Elegíveis
                      </p>
                      <p className="mt-0.5 font-semibold text-ink-900">{sorteio.quantidadeElegivel} número(s)</p>
                    </div>
                  </div>
                </div>
                <details className="border-t border-ink-100 bg-ink-50/40 px-5 py-3">
                  <summary className="cursor-pointer text-xs font-semibold text-ink-600">
                    Ver conjunto elegível registrado
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {sorteio.numerosElegiveis.map((numero) => (
                      <span
                        key={numero}
                        className={
                          numero === sorteio.numeroVencedor
                            ? "rounded bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold text-ink-950"
                            : "rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-ink-600 ring-1 ring-ink-200"
                        }
                      >
                        {formatNumber(numero)}
                      </span>
                    ))}
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}
