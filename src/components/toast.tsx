"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; message: string; type: ToastType };

const EVENT = "rifas:toast";

export function toast(message: string, type: ToastType = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, type } }));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    function handler(event: Event) {
      const detail = (event as CustomEvent<{ message: string; type: ToastType }>).detail;
      const id = Date.now() + Math.random();
      setItems((current) => [...current.slice(-2), { id, message: detail.message, type: detail.type }]);
      window.setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== id));
      }, 5000);
    }
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex flex-col items-center gap-2 px-3 sm:top-5" aria-live="polite">
      {items.map((item) => {
        const Icon = item.type === "success" ? CheckCircle2 : item.type === "error" ? XCircle : Info;
        return (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm shadow-lift animate-rise",
              item.type === "success" && "border-brand-200 bg-white text-brand-900",
              item.type === "error" && "border-red-200 bg-white text-red-900",
              item.type === "info" && "border-sky-200 bg-white text-sky-900",
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="flex-1">{item.message}</p>
            <button
              type="button"
              onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
              className="rounded-md p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              aria-label="Fechar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
