import type { Metadata } from "next";
import { ChevronRight, Filter, Search, Ticket, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth";
import { formatCurrency, formatDateTime, formatNumber, formatPhone } from "@/lib/format";
import { listarReservas, obterRifaSimples } from "@/server/queries";
import { PagamentoQuickToggle } from "@/components/pagamento-quick-toggle";
import { RifaTabs } from "@/components/rifa-tabs";
import { EmptyState, PageHeader, PagamentoBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Participantes" };
export const dynamic = "force-dynamic";

const ESTADOS = ["TODOS", "RESERVADO", "PAGO", "PENDENTE"] as const;
type Estado = (typeof ESTADOS)[number];

export default async function ParticipantesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nome?: string; pagamento?: string; estado?: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const { nome = "", pagamento = "", estado = "TODOS" } = await searchParams;
  const rifa = await obterRifaSimples(id);
  if (!rifa) notFound();

  const estadoValido = ESTADOS.includes(estado as Estado) ? (estado as Estado) : "TODOS";
  const pagamentoValido = pagamento === "PAGO" || pagamento === "PENDENTE" ? pagamento : undefined;

  const reservas = await listarReservas({
    rifaId: id,
    nome,
    pagamento: pagamentoValido,
    estado: estadoValido,
  });

  const totalNumeros = reservas.reduce((acc, reserva) => acc + reserva.numeros.length, 0);
  const totalValor = reservas.reduce((acc, reserva) => acc + reserva.valorCobrado, 0);

  return (
    <>
      <PageHeader
        eyebrow="Participantes"
        title="Participantes e reservas"
        description={`Consulte por nome ou número, pagamento e estado dos números. ${rifa.titulo}`}
        actions={
          <Link href={`/rifas/${rifa.id}`} className="btn-secondary">
            <Ticket className="h-4 w-4" aria-hidden />
            Ver grade
          </Link>
        }
      />
      <RifaTabs rifaId={rifa.id} />

      <form className="card mb-4 p-4" method="get" role="search">
        <div className="grid gap-3 md:grid-cols-[1fr_170px_170px_auto] md:items-end">
          <div>
            <label htmlFor="nome" className="label">
              Nome ou número
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
              <input
                id="nome"
                name="nome"
                type="search"
                defaultValue={nome}
                placeholder="Nome, parte do nome ou número exato"
                className="input pl-9"
              />
            </div>
          </div>
          <div>
            <label htmlFor="pagamento" className="label">
              Pagamento
            </label>
            <select id="pagamento" name="pagamento" defaultValue={pagamento} className="input">
              <option value="">Todos</option>
              <option value="PENDENTE">Pendente</option>
              <option value="PAGO">Pago</option>
            </select>
          </div>
          <div>
            <label htmlFor="estado" className="label">
              Estado do número
            </label>
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
              Filtrar
            </button>
            <Link href={`/rifas/${rifa.id}/participantes`} className="btn-secondary">
              Limpar
            </Link>
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
            title="Nenhuma reserva encontrada"
            description={nome || pagamento || estadoValido !== "TODOS" ? "Ajuste os filtros, tente outro nome ou um número exato." : "As reservas feitas na grade aparecerão aqui."}
            action={
              <Link href={`/rifas/${rifa.id}`} className="btn-primary">
                Ir para a grade de números
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="card hidden overflow-hidden md:block">
            <div className="table-wrap border-0">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Participante</th>
                    <th scope="col">Números</th>
                    <th scope="col">Pagamento</th>
                    <th scope="col">Valor</th>
                    <th scope="col">Reservado em</th>
                    <th scope="col" className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {reservas.map((reserva) => (
                    <tr key={reserva.id}>
                      <td>
                        <Link href={`/rifas/${rifa.id}/participantes/${reserva.id}`} className="font-semibold text-ink-900 hover:text-brand-800">
                          {reserva.participante.nome}
                        </Link>
                        <p className="text-xs text-ink-500">{formatPhone(reserva.participante.telefone)}</p>
                      </td>
                      <td>
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {reserva.numeros.map((item) => (
                            <span key={item.id} className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold text-ink-800">
                              {formatNumber(item.numero)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td><PagamentoBadge status={reserva.statusPagamento} /></td>
                      <td className="font-medium">{formatCurrency(reserva.valorCobrado)}</td>
                      <td className="text-xs text-ink-500">{formatDateTime(reserva.createdAt)}</td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <PagamentoQuickToggle reservaId={reserva.id} status={reserva.statusPagamento} compact />
                          <Link
                            href={`/rifas/${rifa.id}/participantes/${reserva.id}`}
                            className="btn-ghost btn-sm"
                            aria-label={`Abrir reserva de ${reserva.participante.nome}`}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2 md:hidden">
            {reservas.map((reserva) => (
              <div key={reserva.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/rifas/${rifa.id}/participantes/${reserva.id}`} className="font-semibold text-ink-950 hover:text-brand-800">
                      {reserva.participante.nome}
                    </Link>
                    <p className="text-xs text-ink-500">{formatPhone(reserva.participante.telefone)}</p>
                  </div>
                  <PagamentoBadge status={reserva.statusPagamento} />
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {reserva.numeros.map((item) => (
                    <span key={item.id} className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[11px] font-semibold text-ink-800">
                      {formatNumber(item.numero)}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
                  <div>
                    <p className="text-sm font-bold text-ink-950">{formatCurrency(reserva.valorCobrado)}</p>
                    <p className="text-[10px] text-ink-400">{formatDateTime(reserva.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <PagamentoQuickToggle reservaId={reserva.id} status={reserva.statusPagamento} compact />
                    <Link href={`/rifas/${rifa.id}/participantes/${reserva.id}`} className="btn-secondary btn-sm">
                      Abrir
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
