"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card mt-8 p-8 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-100 text-red-700">
        <TriangleAlert className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink-950">Não foi possível carregar esta página</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
        Ocorreu um erro inesperado. Seus dados permanecem salvos. Tente novamente ou volte ao painel.
      </p>
      {error.digest ? <p className="mt-2 text-[11px] text-ink-400">Referência: {error.digest}</p> : null}
      <button type="button" onClick={reset} className="btn-primary mt-5">
        <RotateCcw className="h-4 w-4" aria-hidden />
        Tentar novamente
      </button>
    </div>
  );
}
