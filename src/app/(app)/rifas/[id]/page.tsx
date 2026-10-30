import {
  Banknote,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Hash,
  Pencil,
  Ticket,
  Trophy,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth";
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { calcularResumo, obterRifa } from "@/server/queries";
import { CartelaModal } from "@/components/cartela-modal";
import { NumerosGrid, type ReservaDetalhe } from "@/components/numeros-grid";
import { RifaStatusButton } from "@/components/rifa-status-button";
import { RifaTabs } from "@/components/rifa-tabs";
import {
  PageHeader,
  ProgressBar,
  RifaStatusBadge,
  StatCard,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const rifa = await obterRifa(id);
  return { title: rifa?.titulo ?? "Rifa" };
}

export default async function RifaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const rifa = await obterRifa(id);
  if (!rifa) notFound();

  const resumo = calcularResumo(rifa.quantidadeNumeros, rifa.reservas);

  const reservas: ReservaDetalhe[] = rifa.reservas.map((reserva) => ({
    id: reserva.id,
    participanteId: reserva.participanteId,
    participanteNome: reserva.participante.nome,
    telefone: reserva.participante.telefone,
    statusPagamento: reserva.statusPagamento,
    valorCobrado: reserva.valorCobrado,
    pagoEm: reserva.pagoEm ? reserva.pagoEm.toISOString() : null,
    observacoes: reserva.observacoes,
    numeros: reserva.numeros.map((item) => item.numero),
    createdAt: reserva.createdAt.toISOString(),
  }));

  const numerosVendidos = Array.from(new Set(reservas.flatMap((reserva) => reserva.numeros))).sort((a, b) => a - b);

  return (
    <>
      <PageHeader
        eyebrow="Detalhes da rifa"
        title={rifa.titulo}
        description={rifa.descricao}
        actions={
          <>
            <RifaStatusBadge status={rifa.status} />
            <RifaStatusButton rifaId={rifa.id} status={rifa.status} />
            <Link href={`/rifas/${rifa.id}/editar`} className="btn-primary">
              <Pencil className="h-4 w-4" aria-hidden />
              Editar
            </Link>
          </>
        }
      />

      <RifaTabs rifaId={rifa.id} />

      {rifa.sorteio ? (
        <section className="mb-4 overflow-hidden rounded-3xl border border-amber-300 bg-gradient-to-br from-amber-100 via-cream to-brand-50 p-5 shadow-card sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-400 text-white shadow-sm">
                <Trophy className="h-7 w-7" aria-hidden />
              </span>
              <div>
                <p className="eyebrow !text-amber-800">Rifa sorteada</p>
                <p className="mt-1 font-display text-2xl font-semibold text-ink-950">
                  Número {formatNumber(rifa.sorteio.numeroVencedor)} · {rifa.sorteio.participante.nome}
                </p>
                <p className="mt-1 text-xs text-ink-600">
                  Sorteado em {formatDateTime(rifa.sorteio.dataHoraSorteio)} entre {rifa.sorteio.quantidadeElegivel} números elegíveis.
                </p>
              </div>
            </div>
            <Link href={`/rifas/${rifa.id}/sorteio`} className="btn bg-white text-amber-900 ring-1 ring-amber-300 hover:bg-amber-50">
              Ver resultado
            </Link>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-3 gap-2.5 sm:gap-3 lg:grid-cols-4" aria-label="Informações da rifa">
        <div className="card p-3.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
            <Banknote className="h-3.5 w-3.5" aria-hidden /> Valor do número
          </p>
          <p className="mt-1.5 text-sm font-bold text-ink-950">{formatCurrency(rifa.valorNumero)}</p>
          <p className="text-[11px] text-ink-500">Potencial {formatCurrency(rifa.valorNumero * rifa.quantidadeNumeros)}</p>
        </div>
        <div className="card p-3.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Sorteio previsto
          </p>
          <p className="mt-1.5 text-sm font-bold text-ink-950">{formatDate(rifa.dataSorteio)}</p>
          <p className="text-[11px] text-ink-500">{formatDateTime(rifa.dataSorteio).split(" às ")[1] ?? ""}</p>
        </div>
        <div className="card p-3.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Início das vendas
          </p>
          <p className="mt-1.5 text-sm font-bold text-ink-950">{formatDate(rifa.dataInicio)}</p>
          <p className="text-[11px] text-ink-500">Criada em {formatDate(rifa.createdAt)}</p>
        </div>
        <div className="card col-span-3 p-3.5 lg:col-span-1">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
              <Hash className="h-3.5 w-3.5" aria-hidden /> Ocupação
            </p>
            <span className="text-xs font-bold text-brand-800">{formatPercent(resumo.ocupacao)}</span>
          </div>
          <ProgressBar value={resumo.ocupacao} className="mt-2" />
          <p className="mt-1.5 text-[11px] text-ink-500">
            {resumo.reservados} de {resumo.totalNumeros} números
          </p>
        </div>
      </section>

      <section className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4" aria-label="Indicadores da rifa">
        <StatCard label="Total de números" value={String(resumo.totalNumeros)} icon={<Hash className="h-4 w-4" />} tone="neutral" />
        <StatCard label="Disponíveis" value={String(resumo.disponiveis)} icon={<Ticket className="h-4 w-4" />} tone="sky" />
        <StatCard label="Pendentes" value={String(resumo.pendentes)} hint="reservados, não pagos" icon={<Clock3 className="h-4 w-4" />} tone="amber" />
        <StatCard label="Pagos" value={String(resumo.pagos)} icon={<CheckCircle2 className="h-4 w-4" />} tone="brand" />
        <StatCard label="Arrecadado" value={formatCurrency(resumo.arrecadado)} icon={<Banknote className="h-4 w-4" />} tone="brand" />
        <StatCard label="A receber" value={formatCurrency(resumo.aReceber)} icon={<Wallet className="h-4 w-4" />} tone="amber" />
      </section>

      <section className="card mt-4 p-4 sm:p-5" aria-labelledby="grade-titulo">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="grade-titulo" className="font-display text-xl font-semibold text-ink-950">
              Grade de números
            </h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Selecione números livres para reservar. Números ocupados abrem os detalhes da reserva.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/rifas/${rifa.id}/participantes`} className="btn-secondary btn-sm">
              <Ticket className="h-3.5 w-3.5" aria-hidden />
              Ver participantes
            </Link>
            <CartelaModal
              rifa={{
                titulo: rifa.titulo,
                descricao: rifa.descricao,
                quantidadeNumeros: rifa.quantidadeNumeros,
                valorNumero: rifa.valorNumero,
                dataSorteio: rifa.dataSorteio.toISOString(),
                status: rifa.status,
              }}
              numerosVendidos={numerosVendidos}
              numeroSorteado={rifa.sorteio?.numeroVencedor}
            />
          </div>
        </div>
        <NumerosGrid rifa={rifa} reservas={reservas} numeroSorteado={rifa.sorteio?.numeroVencedor} />
      </section>
    </>
  );
}
