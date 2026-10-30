import { History, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { Prisma } from "@prisma/client";

import { requireSession } from "@/lib/auth";
import { formatDateTime, formatNumber } from "@/lib/format";
import { AUDITORIA_LABEL } from "@/lib/status";
import { listarAuditorias, obterRifaSimples } from "@/server/queries";
import { RifaTabs } from "@/components/rifa-tabs";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Auditoria" };
export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  participante: "Participante",
  telefone: "Telefone",
  numeros: "Números",
  numerosElegiveis: "Números elegíveis",
  statusPagamento: "Pagamento",
  valorCobrado: "Valor",
  pagoEm: "Pago em",
  observacoes: "Observações",
  numeroVencedor: "Número vencedor",
  quantidadeElegivel: "Elegíveis",
  dataHoraSorteio: "Data do sorteio",
  status: "Status",
  titulo: "Título",
  quantidadeNumeros: "Quantidade",
  valorNumero: "Valor do número",
};

function valorLegivel(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) {
    const items = key.toLowerCase().includes("numero") ? value.map((item) => (typeof item === "number" ? formatNumber(item) : String(item))) : value.map(String);
    if (items.length > 24) return `${items.slice(0, 24).join(", ")}… (+${items.length - 24})`;
    return items.join(", ");
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
    return value;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function Dados({ dados, tipo }: { dados: Prisma.JsonValue | null; tipo: "anteriores" | "novos" }) {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return null;
  const entries = Object.entries(dados).filter(([, value]) => value !== null && value !== undefined);
  if (entries.length === 0) return null;

  return (
    <div className={tipo === "anteriores" ? "rounded-xl bg-ink-50 p-3" : "rounded-xl bg-brand-50/70 p-3"}>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-500">
        {tipo === "anteriores" ? "Antes" : "Depois"}
      </p>
      <dl className="grid gap-1">
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[100px_1fr] gap-2 text-xs">
            <dt className="text-ink-500">{LABELS[key] ?? key}</dt>
            <dd className="break-words font-medium text-ink-900">{valorLegivel(key, value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function AuditoriaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const [rifa, auditorias] = await Promise.all([obterRifaSimples(id), listarAuditorias(id)]);
  if (!rifa) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Auditoria"
        title="Histórico de alterações"
        description="Registro das ações administrativas relevantes desta rifa, com autor, horário e dados alterados."
        actions={
          <Link href={`/rifas/${rifa.id}`} className="btn-secondary">
            Voltar à rifa
          </Link>
        }
      />
      <RifaTabs rifaId={rifa.id} />

      {auditorias.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<History className="h-6 w-6" />}
            title="Nenhuma alteração registrada"
            description="Criação de reservas, pagamentos, liberações e sorteios aparecem aqui."
          />
        </div>
      ) : (
        <ol className="space-y-2">
          {auditorias.map((item) => (
            <li key={item.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-600">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-semibold text-ink-950">{AUDITORIA_LABEL[item.acao] ?? item.acao}</p>
                    <span className="badge bg-ink-50 text-ink-600 ring-ink-200">{item.entidadeAfetada}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-500">
                    {formatDateTime(item.dataHora)} · {item.usuario.nome} ({item.usuario.email})
                    {item.registroId ? ` · ID ${item.registroId.slice(-8)}` : ""}
                  </p>

                  {(item.dadosAnteriores || item.dadosNovos) ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] font-semibold text-brand-800">Ver dados do registro</summary>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <Dados dados={item.dadosAnteriores} tipo="anteriores" />
                        <Dados dados={item.dadosNovos} tipo="novos" />
                      </div>
                    </details>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
