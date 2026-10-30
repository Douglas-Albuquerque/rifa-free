"use client";

import { CirclePause, CirclePlay, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { RifaStatus } from "@prisma/client";

import { alterarStatusRifaAction } from "@/server/actions/rifa-actions";

import { Modal } from "./modal";
import { toast } from "./toast";

export function RifaStatusButton({ rifaId, status }: { rifaId: string; status: RifaStatus }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (status === "SORTEADA") {
    return (
      <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3.5 text-xs font-semibold text-violet-900">
        <Lock className="h-4 w-4" aria-hidden />
        Resultado protegido
      </span>
    );
  }

  const encerrando = status === "ABERTA";
  const alvo: RifaStatus = encerrando ? "ENCERRADA" : "ABERTA";

  function confirmar() {
    setErro(null);
    startTransition(async () => {
      const result = await alterarStatusRifaAction({ rifaId, status: alvo });
      if (!result.ok) {
        setErro(result.message);
        return;
      }
      toast(result.message);
      setAberto(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        className={encerrando ? "btn-secondary" : "btn-secondary"}
        onClick={() => {
          setErro(null);
          setAberto(true);
        }}
      >
        {encerrando ? <CirclePause className="h-4 w-4" aria-hidden /> : <CirclePlay className="h-4 w-4" aria-hidden />}
        {encerrando ? "Encerrar rifa" : "Abrir rifa"}
      </button>

      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title={encerrando ? "Encerrar esta rifa?" : "Abrir esta rifa?"}
        description={
          encerrando
            ? "A rifa deixa de aceitar novas reservas. As reservas existentes e os pagamentos continuam disponíveis."
            : "A rifa volta a aceitar novas reservas na grade de números."
        }
        size="sm"
      >
        {erro ? <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{erro}</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={() => setAberto(false)}>
            Cancelar
          </button>
          <button type="button" className={encerrando ? "btn-danger" : "btn-primary"} onClick={confirmar} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {encerrando ? "Sim, encerrar" : "Sim, abrir"}
          </button>
        </div>
      </Modal>
    </>
  );
}
