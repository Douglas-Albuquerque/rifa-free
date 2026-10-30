import { ChevronRight, Filter, Search, Ticket, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { requireSession } from "@/lib/auth";
import { formatCurrency, formatDateTime, formatNumber, formatPhone } from "@/lib/format";
import { listarReservas, listarRifasParaFiltro } from "@/server/queries";
import { PagamentoQuickToggle } from "@/components/pagamento-quick-toggle";
import { EmptyState, PageHeader, PagamentoBadge, RifaStatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Pesquisa" };
export const dynamic = "force-dynamic";

const ESTADOS = ["TODOS", "RESERVADO", "PAGO", "PENDENTE"] as const;

export default async function PesquisaPage({
  searchParams,
}: {
  searchParams: Promise<{ rifaId?: string; nome?: string; pagamento?: string; estado?: string }>;
}) {
  await requireSession();
  const {
    rifaId = "",
    nome = "",
    pagamento = "",
    estado = "TODOS",
  } = await searchParams;

  const rifas = await listarRifasParaFiltro();
  const rifaSelecionada = rifas.find((rifa) => rifa.id === rifaId);
  const estadoValido = ESTADOS.includes(estado as (typeof ESTADOS)[number])
    ? (estado as (typeof ESTADOS)[number])
    : "TODOS";
  const pagamentoValido = pagamento === "PAGO" || pagamento === "PENDENTE" ? pagamento : undefined;

  const reservas = await listarReservas({
    rifaId: rifaSelecionada?.id,
    nome,
    pagamento: pagamentoValido,
    estado: estadoValido,
  });

  const totalNumeros = reservas.reduce((acc, reserva) => acc + reserva.numeros.length, 0);
  const totalValor = reservas.reduce((acc, reserva) => acc + reserva.valorCobrado, 0);
  const temFiltro = Boolean(rifaId || nome || pagamento || estadoValido !== "TODOS");

  return (
    <>
      <PageHeader
        eyebrow="Pesquisa"
        title="Buscar participantes"
        description="Encontre reservas pelo nome ou número, filtre por rifa, pagamento e estado dos números."
      />

      <form className="card mb-4 p-4" method="get" role="search">
        <div className="grid gap-3 md:grid-cols-[1fr_200px_160px_160px_auto] md:items-end">
          <div>
            <label htmlFor="nome" className="label">Nome ou número</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
              <input
                id="nome"
                name="nome"
                type="search"
                defaultValue={nome}
                className="input pl-9"
                placeholder="Nome, parte do nome ou número exato"
              />
            </div>
          </div>
          <div>
            <label htmlFor="rifaId" className="label">Rifa</label>
            <select id="rifaId" name="rifaId" defaultValue={rifaId} className="input">
              <option value="">Todas as rifas</option>
              {rifas.map((rifa) => (
                <option key={rifa.id} value={rifa.id}>{rifa.titulo}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pagamento" className="label">Pagamento</label>
            <select id="pagamento" name="pagamento" defaultValue={pagamento} className="input">
              <option value="">Todos</option>
              <option value="PENDENTE">Pendente</option>
              <option value="PAGO">Pago</option>
            </select>
          </div>
          <div>
            <label htmlFor="estado" className="label">Estado do número</label>
            <select id="estado" name="estado" defaultValue={estadoValido} className="input">
              <option value="TODOS">Todos os ocupados</option>
              <option value="RESERVADO">Reservado</option>
              <option value="PAGO">Pago</option>
              <option value="PENDENTE">Pendente</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1 md:flex-none">
              <Filter className="h-4 w-4" aria-hidden />
              Buscar
            </button>
            <Link href="/pesquisa" className="btn-secondary">Limpar</Link>
          </div>
        </div>
      </form>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-ink-500">
          <strong className="text-ink-900">{reservas.length}</strong> reserva(s) ·{" "}
          <strong className="text-ink-900">{totalNumeros}</strong> número(s)
        </p>
        <p className="text-ink-500">
          Total associado: <strong className="text-ink-900">{formatCurrency(totalValor)}</strong>
        </p>
      </div>

      {reservas.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title={temFiltro ? "Nenhum resultado encontrado" : "Nenhuma reserva cadastrada"}
            description={
              temFiltro
                ? "Tente buscar apenas parte do nome, informar um número exato ou remover alguns filtros."
                : "Crie uma rifa e registre reservas para consultar os participantes aqui."
            }
            action={
              temFiltro ? (
                <Link href="/pesquisa" className="btn-secondary">Limpar filtros</Link>
              ) : (
                <Link href="/rifas/nova" className="btn-primary">Criar rifa</Link>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-2">
          {reservas.map((reserva) => (
            <div key={reserva.id} className="card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-600">
                    <Ticket className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/rifas/${reserva.rifaId}/participantes/${reserva.id}`}
                        className="font-semibold text-ink-950 hover:text-brand-800"
                      >
                        {reserva.participante.nome}
                      </Link>
                      <PagamentoBadge status={reserva.statusPagamento} />
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
                      <Link href={`/rifas/${reserva.rifaId}`} className="font-medium text-brand-800 hover:underline">
                        {reserva.rifa.titulo}
                      </Link>
                      <RifaStatusBadge status={reserva.rifa.status} />
                      <span>· {formatPhone(reserva.participante.telefone)}</span>
                    </p>
                    <p className="mt-1 text-xs text-ink-600">
                      Números:{" "}
                      <span className="font-medium text-ink-900">
                        {reserva.numeros.map((item) => formatNumber(item.numero)).join(", ")}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-400">Reservado em {formatDateTime(reserva.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-3 sm:justify-end sm:border-0 sm:pt-0">
                  <p className="text-base font-bold text-ink-950">{formatCurrency(reserva.valorCobrado)}</p>
                  <div className="flex items-center gap-1.5">
                    <PagamentoQuickToggle reservaId={reserva.id} status={reserva.statusPagamento} compact />
                    <Link
                      href={`/rifas/${reserva.rifaId}/participantes/${reserva.id}`}
                      className="btn-secondary btn-sm"
                    >
                      Abrir
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
