"use client";

import { Loader2, ShieldCheck, Sparkles, Trophy, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { realizarSorteioAction } from "@/server/actions/sorteio-actions";

import { Modal } from "./modal";
import { Alert } from "./ui";
import { toast } from "./toast";

export function DrawPanel({
  rifaId,
  titulo,
  elegiveis,
}: {
  rifaId: string;
  titulo: string;
  elegiveis: number;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function sortear() {
    setErro(null);
    startTransition(async () => {
      const result = await realizarSorteioAction({ rifaId, confirmacao: true });
      if (!result.ok) {
        setErro(result.message);
        return;
      }
      toast(
        `Sorteio concluído: número ${String(result.numeroVencedor).padStart(3, "0")} — ${result.participante}.`,
        "success",
      );
      setAberto(false);
      setConfirmado(false);
      router.refresh();
    });
  }

  return (
    <div className="card overflow-hidden">
      <div className="relative overflow-hidden bg-ink-950 p-6 text-white sm:p-8">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
          aria-hidden
        />
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">Hora da verdade</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">Realizar sorteio</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-300">
              {elegiveis} número(s) pago(s) participam. O vencedor é escolhido no servidor com gerador
              criptograficamente seguro e o resultado é definitivo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setErro(null);
              setAberto(true);
            }}
            className="btn min-h-12 bg-amber-400 px-5 text-base text-ink-950 shadow-lift hover:bg-amber-300"
          >
            <Sparkles className="h-5 w-5" aria-hidden />
            Iniciar sorteio
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5 text-[11px] text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-brand-700" aria-hidden />
          Seleção 100% no servidor
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-amber-600" aria-hidden />
          Apenas números pagos concorrem
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-brand-700" aria-hidden />
          Resultado salvo permanentemente
        </span>
      </div>

      <Modal
        open={aberto}
        onClose={() => {
          if (!isPending) setAberto(false);
        }}
        title="Confirmar realização do sorteio?"
        description="O resultado será gravado e a rifa passará para o status Sorteada."
        size="sm"
      >
        {erro ? (
          <div className="mb-3">
            <Alert type="error">{erro}</Alert>
          </div>
        ) : null}

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex items-start gap-2.5">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">Ação irreversível</p>
              <p className="mt-1 text-xs leading-relaxed">
                Será sorteado 1 número entre os <strong>{elegiveis} números pagos</strong> da rifa{" "}
                <strong>{titulo}</strong>. Não será possível realizar um segundo sorteio normal.
              </p>
            </div>
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-ink-200 p-3 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={confirmado}
            onChange={(event) => setConfirmado(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-700"
          />
          <span>Confirmo que o sorteio pode ser realizado agora e entendo que o resultado é definitivo.</span>
        </label>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={() => setAberto(false)} disabled={isPending}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={sortear} disabled={!confirmado || isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trophy className="h-4 w-4" aria-hidden />}
            {isPending ? "Sorteando..." : "Realizar sorteio"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
