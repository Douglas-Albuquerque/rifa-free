"use client";

import type { PagamentoStatus } from "@prisma/client";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/cn";
import { definirPagamentoAction } from "@/server/actions/reserva-actions";

import { toast } from "./toast";

export function PagamentoQuickToggle({
  reservaId,
  status,
  className,
  compact = false,
}: {
  reservaId: string;
  status: PagamentoStatus;
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const novoStatus = status === "PAGO" ? "PENDENTE" : "PAGO";

  function alternar() {
    startTransition(async () => {
      const result = await definirPagamentoAction({ reservaId, statusPagamento: novoStatus });
      if (!result.ok) {
        toast(result.message, "error");
        return;
      }
      toast(result.message);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={isPending}
      className={cn(
        compact ? "btn-secondary btn-sm" : "btn-secondary",
        novoStatus === "PAGO" ? "text-brand-800 hover:bg-brand-50" : "text-amber-800 hover:bg-amber-50",
        className,
      )}
      aria-label={novoStatus === "PAGO" ? "Marcar reserva como paga" : "Marcar reserva como pendente"}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : novoStatus === "PAGO" ? (
        <CheckCircle2 className="h-4 w-4" aria-hidden />
      ) : (
        <RotateCcw className="h-4 w-4" aria-hidden />
      )}
      {novoStatus === "PAGO" ? "Marcar pago" : "Marcar pendente"}
    </button>
  );
}
