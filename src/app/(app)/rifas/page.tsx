import { Plus, Search, Ticket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { requireSession } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { listarRifasComResumo } from "@/server/queries";
import { RifaCard } from "@/components/rifa-card";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Minhas rifas" };
export const dynamic = "force-dynamic";

const FILTROS = [
  { value: "todas", label: "Todas" },
  { value: "ABERTA", label: "Abertas" },
  { value: "RASCUNHO", label: "Rascunhos" },
  { value: "ENCERRADA", label: "Encerradas" },
  { value: "SORTEADA", label: "Sorteadas" },
] as const;

export default async function RifasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireSession();
  const { status = "todas", q = "" } = await searchParams;
  const rifas = await listarRifasComResumo();

  const filtradas = rifas.filter((rifa) => {
    const matchStatus = status === "todas" || rifa.status === status;
    const matchBusca = !q || rifa.titulo.toLowerCase().includes(q.toLowerCase());
    return matchStatus && matchBusca;
  });

  return (
    <>
      <PageHeader
        eyebrow="Minhas rifas"
        title="Todas as rifas"
        description={`${rifas.length} rifa(s) cadastrada(s). Acesse a grade, participantes, pagamentos e sorteio.`}
        actions={
          <Link href="/rifas/nova" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden />
            Nova rifa
          </Link>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1">
          {FILTROS.map((filtro) => {
            const ativo = status === filtro.value;
            const params = new URLSearchParams();
            if (filtro.value !== "todas") params.set("status", filtro.value);
            if (q) params.set("q", q);
            return (
              <Link
                key={filtro.value}
                href={`/rifas${params.size ? `?${params.toString()}` : ""}`}
                className={cn(
                  "whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition",
                  ativo
                    ? "bg-ink-950 text-white ring-ink-950"
                    : "bg-white text-ink-600 ring-ink-200 hover:bg-ink-50",
                )}
                aria-current={ativo ? "page" : undefined}
              >
                {filtro.label}
              </Link>
            );
          })}
        </div>

        <form className="relative w-full sm:w-64" role="search">
          {status !== "todas" ? <input type="hidden" name="status" value={status} /> : null}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar pelo título"
            className="input h-10 min-h-10 pl-9 text-sm"
            aria-label="Buscar rifa pelo título"
          />
        </form>
      </div>

      {filtradas.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Ticket className="h-6 w-6" />}
            title={rifas.length === 0 ? "Nenhuma rifa cadastrada" : "Nenhuma rifa encontrada"}
            description={
              rifas.length === 0
                ? "Crie sua primeira rifa para começar a registrar reservas."
                : "Tente outro filtro ou ajuste o termo de busca."
            }
            action={
              rifas.length === 0 ? (
                <Link href="/rifas/nova" className="btn-primary">
                  <Plus className="h-4 w-4" aria-hidden />
                  Criar rifa
                </Link>
              ) : (
                <Link href="/rifas" className="btn-secondary">
                  Limpar filtros
                </Link>
              )
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((rifa) => (
            <RifaCard key={rifa.id} rifa={rifa} />
          ))}
        </div>
      )}
    </>
  );
}
