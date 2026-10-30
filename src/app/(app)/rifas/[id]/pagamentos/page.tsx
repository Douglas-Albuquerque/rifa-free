import { Banknote, CheckCircle2, ChevronRight, Clock3, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatCurrency, formatDateTime, formatNumber, formatPhone } from "@/lib/format";
import { listarReservas, obterRifaSimples } from "@/server/queries";
import { PagamentoQuickToggle } from "@/components/pagamento-quick-toggle";
import { RifaTabs } from "@/components/rifa-tabs";
import { EmptyState, PageHeader, PagamentoBadge, StatCard } from "@/components/ui";

export const metadata: Metadata = { title: "Pagamentos" };
export const dynamic = "force-dynamic";

const FILTROS = [
  { value: "TODOS", label: "Todos" },
  { value: "PENDENTE", label: "Pendentes" },
  { value: "PAGO", label: "Pagos" },
] as const;

export default async function PagamentosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const { status = "TODOS" } = await searchParams;
  const rifa = await obterRifaSimples(id);
  if (!rifa) notFound();

  const todas = await listarReservas({ rifaId: id });
  const pagas = todas.filter((reserva) => reserva.statusPagamento === "PAGO");
  const pendentes = todas.filter((reserva) => reserva.statusPagamento === "PENDENTE");
  const arrecadado = pagas.reduce((acc, reserva) => acc + reserva.valorCobrado, 0);
  const aReceber = pendentes.reduce((acc, reserva) => acc + reserva.valorCobrado, 0);
  const numerosPagos = pagas.reduce((acc, reserva) => acc + reserva.numeros.length, 0);
  const numerosPendentes = pendentes.reduce((acc, reserva) => acc + reserva.numeros.length, 0);

  const filtroValido = FILTROS.some((item) => item.value === status) ? status : "TODOS";
  const lista = filtroValido === "TODOS" ? todas : todas.filter((reserva) => reserva.statusPagamento === filtroValido);

  return (
    <>
      <PageHeader
        eyebrow="Pagamentos"
        title="Controle de pagamentos"
        description="Confirme pagamentos manualmente. Reservas pendentes continuam ocupando os números."
        actions={
          <Link href={`/rifas/${rifa.id}`} className="btn-secondary">
            <ChevronRight className="h-4 w-4" aria-hidden />
            Ver grade
          </Link>
        }
      />
      <RifaTabs rifaId={rifa.id} />

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4" aria-label="Resumo financeiro">
        <StatCard label="Total arrecadado" value={formatCurrency(arrecadado)} hint={`${pagas.length} reserva(s)`} icon={<Banknote className="h-4 w-4" />} tone="brand" />
        <StatCard label="A receber" value={formatCurrency(aReceber)} hint={`${pendentes.length} reserva(s)`} icon={<Wallet className="h-4 w-4" />} tone="amber" />
        <StatCard label="Números pagos" value={String(numerosPagos)} icon={<CheckCircle2 className="h-4 w-4" />} tone="brand" />
        <StatCard label="Números pendentes" value={String(numerosPendentes)} icon={<Clock3 className="h-4 w-4" />} tone="amber" />
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 rounded-full border border-ink-200 bg-white p-1">
          {FILTROS.map((filtro) => (
            <Link
              key={filtro.value}
              href={`/rifas/${rifa.id}/pagamentos${filtro.value === "TODOS" ? "" : `?status=${filtro.value}`}`}
              aria-current={filtroValido === filtro.value ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                filtroValido === filtro.value ? "bg-ink-950 text-white" : "text-ink-600 hover:bg-ink-50",
              )}
            >
              {filtro.label}
              <span className="ml-1.5 opacity-60">
                {filtro.value === "TODOS" ? todas.length : filtro.value === "PAGO" ? pagas.length : pendentes.length}
              </span>
            </Link>
          ))}
        </div>
        <p className="text-xs text-ink-500">Pagamentos são confirmados manualmente pelo organizador.</p>
      </div>

      {lista.length === 0 ? (
        <div className="card mt-4">
          <EmptyState
            icon={<Wallet className="h-6 w-6" />}
            title={todas.length === 0 ? "Nenhuma reserva ainda" : "Nenhuma reserva neste filtro"}
            description={todas.length === 0 ? "As reservas e os pagamentos aparecerão aqui." : "Troque o filtro para visualizar outras reservas."}
            action={
              <Link href={`/rifas/${rifa.id}`} className="btn-primary">
                Abrir grade de números
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {lista.map((reserva) => (
            <div key={reserva.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                    reserva.statusPagamento === "PAGO" ? "bg-brand-100 text-brand-800" : "bg-amber-100 text-amber-800",
                  )}
                >
                  {reserva.statusPagamento === "PAGO" ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : <Clock3 className="h-5 w-5" aria-hidden />}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/rifas/${rifa.id}/participantes/${reserva.id}`}
                      className="font-semibold text-ink-950 hover:text-brand-800"
                    >
                      {reserva.participante.nome}
                    </Link>
                    <PagamentoBadge status={reserva.statusPagamento} />
                  </div>
                  <p className="text-xs text-ink-500">
                    {formatPhone(reserva.participante.telefone)} · {reserva.numeros.length} número(s):{" "}
                    {reserva.numeros.map((item) => formatNumber(item.numero)).join(", ")}
                  </p>
                  {reserva.pagoEm ? <p className="mt-0.5 text-[11px] text-ink-400">Pago em {formatDateTime(reserva.pagoEm)}</p> : null}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-3 sm:justify-end sm:border-0 sm:pt-0">
                <p className="text-base font-bold text-ink-950">{formatCurrency(reserva.valorCobrado)}</p>
                <div className="flex items-center gap-1.5">
                  <PagamentoQuickToggle reservaId={reserva.id} status={reserva.statusPagamento} compact />
                  <Link
                    href={`/rifas/${rifa.id}/participantes/${reserva.id}`}
                    className="btn-ghost btn-sm"
                    aria-label={`Abrir reserva de ${reserva.participante.nome}`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
