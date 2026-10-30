import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  Ticket,
  Trophy,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { obterRifaParaSorteio } from "@/server/queries";
import { DrawPanel } from "@/components/draw-panel";
import { RifaTabs } from "@/components/rifa-tabs";
import { Alert, PageHeader, RifaStatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Sorteio" };
export const dynamic = "force-dynamic";

export default async function SorteioPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const rifa = await obterRifaParaSorteio(id);
  if (!rifa) notFound();

  const elegiveis = rifa.numeros.filter((item) => item.reserva.statusPagamento === "PAGO");
  const pendentes = rifa.numeros.length - elegiveis.length;
  const podeSortear =
    !rifa.sorteio &&
    rifa.status !== "RASCUNHO" &&
    rifa.status !== "SORTEADA" &&
    elegiveis.length > 0;

  return (
    <>
      <PageHeader
        eyebrow="Sorteio"
        title="Sorteio da rifa"
        description={`${rifa.titulo} · ${formatDate(rifa.dataSorteio)}`}
        actions={<RifaStatusBadge status={rifa.status} />}
      />
      <RifaTabs rifaId={rifa.id} />

      {rifa.sorteio ? (
        <section className="overflow-hidden rounded-3xl border border-amber-300 bg-white shadow-card">
          <div className="relative overflow-hidden bg-gradient-to-br from-amber-200 via-amber-100 to-brand-50 p-7 text-center sm:p-10">
            <div
              className="absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(120,53,15,.25) 1px, transparent 0)",
                backgroundSize: "20px 20px",
              }}
              aria-hidden
            />
            <div className="relative">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-400 text-white shadow-lift">
                <Trophy className="h-8 w-8" aria-hidden />
              </span>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.25em] text-amber-800">Número vencedor</p>
              <p className="mt-1 font-display text-7xl font-semibold tracking-tight text-ink-950 sm:text-8xl">
                {formatNumber(rifa.sorteio.numeroVencedor)}
              </p>
              <p className="mt-3 font-display text-2xl font-semibold text-ink-950">{rifa.sorteio.participante.nome}</p>
              <p className="mt-1 text-sm text-ink-600">
                Sorteado em {formatDateTime(rifa.sorteio.dataHoraSorteio)} · {rifa.sorteio.quantidadeElegivel} números
                elegíveis
              </p>
              <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-brand-900 ring-1 ring-brand-200">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Resultado registrado e protegido
              </div>
            </div>
          </div>

          <div className="border-t border-amber-200 p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="section-title">Conjunto elegível registrado</h2>
                <p className="mt-0.5 text-xs text-ink-500">
                  Estes eram os números que concorreram no momento do sorteio. O registro é permanente.
                </p>
              </div>
              <Link href="/historico" className="btn-secondary btn-sm">
                Ver histórico
              </Link>
            </div>
            <details className="mt-3 rounded-xl border border-ink-100 bg-ink-50/60 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-ink-700">
                Exibir {rifa.sorteio.numerosElegiveis.length} números elegíveis
              </summary>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {rifa.sorteio.numerosElegiveis.map((numero) => (
                  <span
                    key={numero}
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                      numero === rifa.sorteio?.numeroVencedor
                        ? "bg-amber-400 text-ink-950"
                        : "bg-white text-ink-700 ring-1 ring-ink-200",
                    )}
                  >
                    {formatNumber(numero)}
                  </span>
                ))}
              </div>
            </details>
          </div>
        </section>
      ) : (
        <>
          {rifa.status === "RASCUNHO" ? (
            <div className="mb-4">
              <Alert type="info">
                Esta rifa está em rascunho. Abra a rifa antes de realizar o sorteio.
              </Alert>
            </div>
          ) : null}
          {elegiveis.length === 0 ? (
            <div className="mb-4">
              <Alert type="error">
                Não há números pagos. O sorteio só pode ser realizado quando existir pelo menos uma reserva paga.
              </Alert>
            </div>
          ) : null}
          {pendentes > 0 ? (
            <div className="mb-4">
              <Alert type="info">
                {pendentes} número(s) reservado(s) com pagamento pendente não concorrem. Confirme o pagamento antes do
                sorteio para incluí-los.
              </Alert>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-4">
              <p className="text-[11px] uppercase tracking-wide text-ink-500">Rifa</p>
              <p className="mt-1 line-clamp-2 font-semibold text-ink-950">{rifa.titulo}</p>
            </div>
            <div className="card p-4">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-500">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Data prevista
              </p>
              <p className="mt-1 font-semibold text-ink-950">{formatDateTime(rifa.dataSorteio)}</p>
            </div>
            <div className="card p-4">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-500">
                <Ticket className="h-3.5 w-3.5" aria-hidden /> Números elegíveis
              </p>
              <p className="mt-1 text-2xl font-bold text-ink-950">{elegiveis.length}</p>
              <p className="text-[11px] text-ink-500">{formatPercent((elegiveis.length / rifa.quantidadeNumeros) * 100)} da rifa</p>
            </div>
            <div className="card p-4">
              <p className="text-[11px] uppercase tracking-wide text-ink-500">Pagamentos</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 font-semibold text-brand-800">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {elegiveis.length} pago(s)
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden /> {pendentes} pendente(s), fora do sorteio
                </span>
              </p>
            </div>
          </div>

          {podeSortear ? (
            <div className="mt-4">
              <DrawPanel rifaId={rifa.id} titulo={rifa.titulo} elegiveis={elegiveis.length} />
            </div>
          ) : null}

          {elegiveis.length > 0 ? (
            <section className="card mt-4 p-4 sm:p-5" aria-labelledby="participantes-sorteio">
              <h2 id="participantes-sorteio" className="font-display text-xl font-semibold text-ink-950">
                Números participantes
              </h2>
              <p className="mt-0.5 text-xs text-ink-500">
                Somente números de reservas pagas concorrem.
              </p>
              <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
                {elegiveis.map((item) => (
                  <div
                    key={item.numero}
                    title={`${formatNumber(item.numero)} · ${item.reserva.participante.nome}`}
                    className="rounded-xl border border-brand-300 bg-brand-50 px-1.5 py-2 text-center"
                  >
                    <p className="text-sm font-bold tabular-nums text-ink-950">{formatNumber(item.numero)}</p>
                    <p className="mt-0.5 truncate text-[9px] text-ink-500">{item.reserva.participante.nome.split(" ")[0]}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <p className="mt-5 flex items-start gap-2 px-1 text-[11px] leading-relaxed text-ink-400">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        O sorteio é executado em transação no servidor, com bloqueio da rifa e registro do conjunto elegível na auditoria.
        O navegador não envia nem escolhe o número vencedor.
      </p>
    </>
  );
}
