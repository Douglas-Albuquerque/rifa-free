import {
  ArrowRight,
  Banknote,
  CircleCheckBig,
  Clock3,
  Hash,
  Plus,
  Ticket,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import { requireSession } from "@/lib/auth";
import { formatCurrency, formatPercent } from "@/lib/format";
import { listarRifasComResumo, resumoGlobal } from "@/server/queries";
import { RifaCard } from "@/components/rifa-card";
import { EmptyState, PageHeader, ProgressBar, StatCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireSession();
  const rifas = await listarRifasComResumo();
  const resumo = resumoGlobal(rifas);
  const ativas = rifas.filter((rifa) => rifa.status === "ABERTA").length;
  const primeiroNome = user.nome.split(" ")[0];

  return (
    <>
      <PageHeader
        eyebrow="Painel"
        title={`Olá, ${primeiroNome}`}
        description="Acompanhe suas rifas, reservas e pagamentos em tempo real."
        actions={
          <Link href="/rifas/nova" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden />
            Nova rifa
          </Link>
        }
      />

      {rifas.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Ticket className="h-6 w-6" />}
            title="Comece sua primeira rifa"
            description="Crie uma rifa, defina a quantidade de números e compartilhe com os participantes. Os dados ficam salvos com segurança."
            action={
              <Link href="/rifas/nova" className="btn-primary">
                <Plus className="h-4 w-4" aria-hidden />
                Criar primeira rifa
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores gerais">
            <StatCard
              label="Números totais"
              value={String(resumo.totalNumeros)}
              hint={`${rifas.length} rifa(s) · ${ativas} aberta(s)`}
              icon={<Hash className="h-4 w-4" />}
              tone="neutral"
            />
            <StatCard
              label="Disponíveis"
              value={String(resumo.disponiveis)}
              hint="livres para reserva"
              icon={<Ticket className="h-4 w-4" />}
              tone="sky"
            />
            <StatCard
              label="Aguardando pagamento"
              value={String(resumo.pendentes)}
              hint="reservados e pendentes"
              icon={<Clock3 className="h-4 w-4" />}
              tone="amber"
            />
            <StatCard
              label="Números pagos"
              value={String(resumo.pagos)}
              hint="pagamentos confirmados"
              icon={<CircleCheckBig className="h-4 w-4" />}
              tone="brand"
            />
          </section>

          <section className="mt-3 grid gap-3 lg:grid-cols-3" aria-label="Financeiro e ocupação">
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Total arrecadado</p>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-100 text-brand-800">
                  <Banknote className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-3xl font-bold tracking-tight text-brand-900">{formatCurrency(resumo.arrecadado)}</p>
              <p className="mt-1 text-xs text-ink-500">Somente reservas confirmadas como pagas</p>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Pendente de recebimento</p>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-800">
                  <Wallet className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-3xl font-bold tracking-tight text-amber-900">{formatCurrency(resumo.aReceber)}</p>
              <p className="mt-1 text-xs text-ink-500">Reservas ainda não confirmadas</p>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Ocupação geral</p>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-100 text-violet-800">
                  <TrendingUp className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-3xl font-bold tracking-tight text-ink-950">{formatPercent(resumo.ocupacao)}</p>
              <ProgressBar value={resumo.ocupacao} className="mt-3" />
              <p className="mt-2 text-xs text-ink-500">
                {resumo.reservados} reservado(s) de {resumo.totalNumeros}
              </p>
            </div>
          </section>

          <section className="mt-8" aria-labelledby="rifas-recentes">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="rifas-recentes" className="font-display text-2xl font-semibold text-ink-950">
                Suas rifas
              </h2>
              <Link href="/rifas" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
                Ver todas
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rifas.slice(0, 6).map((rifa) => (
                <RifaCard key={rifa.id} rifa={rifa} />
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
