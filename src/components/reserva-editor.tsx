"use client";

import type { PagamentoStatus } from "@prisma/client";
import { CheckCircle2, Clock3, Loader2, Save, Trash2, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatCurrency, formatNumber } from "@/lib/format";
import {
  atualizarReservaAction,
  definirPagamentoAction,
  liberarReservaAction,
} from "@/server/actions/reserva-actions";

import { Modal } from "./modal";
import { Alert, PagamentoBadge } from "./ui";
import { toast } from "./toast";

export function ReservaEditor({
  reserva,
}: {
  reserva: {
    id: string;
    rifaId: string;
    participanteNome: string;
    telefone: string | null;
    observacoes: string | null;
    statusPagamento: PagamentoStatus;
    valorCobrado: number;
    numeros: number[];
    isSorteada: boolean;
    isVencedora: boolean;
  };
}) {
  const router = useRouter();
  const [nome, setNome] = useState(reserva.participanteNome);
  const [telefone, setTelefone] = useState(reserva.telefone ?? "");
  const [observacoes, setObservacoes] = useState(reserva.observacoes ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarLiberacao, setConfirmarLiberacao] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isPaymentPending, startPayment] = useTransition();
  const [isReleasePending, startRelease] = useTransition();

  function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    startTransition(async () => {
      const result = await atualizarReservaAction(reserva.id, { nome, telefone, observacoes });
      if (!result.ok) {
        setErro(result.message);
        return;
      }
      toast(result.message);
      router.refresh();
    });
  }

  function alternarPagamento() {
    setErro(null);
    startPayment(async () => {
      const result = await definirPagamentoAction({
        reservaId: reserva.id,
        statusPagamento: reserva.statusPagamento === "PAGO" ? "PENDENTE" : "PAGO",
      });
      if (!result.ok) {
        setErro(result.message);
        return;
      }
      toast(result.message);
      router.refresh();
    });
  }

  function liberar() {
    setErro(null);
    startRelease(async () => {
      const result = await liberarReservaAction({ reservaId: reserva.id, confirmacao: true });
      if (!result.ok) {
        setErro(result.message);
        return;
      }
      toast(result.message);
      setConfirmarLiberacao(false);
      router.push(`/rifas/${reserva.rifaId}/participantes`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="section-title">Dados do participante</h2>
          <PagamentoBadge status={reserva.statusPagamento} />
        </div>

        {erro ? (
          <div className="mb-4">
            <Alert type="error">{erro}</Alert>
          </div>
        ) : null}

        {reserva.isVencedora ? (
          <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-950">
            <Trophy className="h-5 w-5" aria-hidden />
            Esta reserva contém o número vencedor da rifa.
          </div>
        ) : null}

        <form onSubmit={salvar} className="space-y-4" noValidate>
          <div>
            <label htmlFor="editor-nome" className="label">
              Nome completo <span className="text-red-600">*</span>
            </label>
            <input
              id="editor-nome"
              className="input"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              required
              minLength={3}
              maxLength={160}
              disabled={reserva.isSorteada}
            />
          </div>
          <div>
            <label htmlFor="editor-telefone" className="label">
              Telefone ou WhatsApp
            </label>
            <input
              id="editor-telefone"
              className="input"
              value={telefone}
              onChange={(event) => setTelefone(event.target.value)}
              maxLength={30}
              inputMode="tel"
              disabled={reserva.isSorteada}
            />
          </div>
          <div>
            <label htmlFor="editor-observacoes" className="label">
              Observações
            </label>
            <textarea
              id="editor-observacoes"
              className="textarea"
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
              maxLength={1000}
              disabled={reserva.isSorteada}
            />
          </div>

          {reserva.isSorteada ? (
            <p className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
              Rifa sorteada: os dados do vencedor estão bloqueados. Apenas o pagamento pode ser corrigido.
            </p>
          ) : (
            <div className="flex justify-end border-t border-ink-100 pt-4">
              <button type="submit" className="btn-primary" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                Salvar alterações
              </button>
            </div>
          )}
        </form>
      </div>

      <aside className="space-y-3">
        <div className="card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Resumo da reserva</p>
          <p className="mt-2 text-2xl font-bold text-ink-950">{formatCurrency(reserva.valorCobrado)}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {reserva.numeros.map((numero) => (
              <span key={numero} className="rounded-lg bg-ink-950 px-2 py-1 text-xs font-bold text-white">
                {formatNumber(numero)}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-500">{reserva.numeros.length} número(s) nesta reserva</p>

          <div className="mt-4 space-y-2 border-t border-ink-100 pt-4">
            <button
              type="button"
              onClick={alternarPagamento}
              disabled={isPaymentPending}
              className={reserva.statusPagamento === "PAGO" ? "btn-secondary w-full" : "btn-primary w-full"}
            >
              {isPaymentPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : reserva.statusPagamento === "PAGO" ? (
                <Clock3 className="h-4 w-4" aria-hidden />
              ) : (
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              )}
              {reserva.statusPagamento === "PAGO" ? "Voltar para pendente" : "Marcar como pago"}
            </button>

            {!reserva.isSorteada ? (
              <button
                type="button"
                className="btn-secondary w-full text-red-700 hover:bg-red-50"
                onClick={() => setConfirmarLiberacao(true)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Liberar números
              </button>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3.5 text-xs leading-relaxed text-sky-900">
          Uma reserva pendente continua ocupando os números. A liberação é manual e fica registrada na auditoria.
        </div>
      </aside>

      <Modal
        open={confirmarLiberacao}
        onClose={() => setConfirmarLiberacao(false)}
        title="Liberar estes números?"
        description="A reserva será removida e os números voltarão a ficar disponíveis."
        size="sm"
      >
        {erro ? <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{erro}</p> : null}
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
          <strong>{reserva.participanteNome}</strong> perderá a reserva dos números{" "}
          <strong>{reserva.numeros.map(formatNumber).join(", ")}</strong>. Esta ação não pode ser desfeita.
        </div>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={() => setConfirmarLiberacao(false)}>
            Cancelar
          </button>
          <button type="button" className="btn-danger" onClick={liberar} disabled={isReleasePending}>
            {isReleasePending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
            Sim, liberar
          </button>
        </div>
      </Modal>
    </div>
  );
}
