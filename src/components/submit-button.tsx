"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/cn";

export function SubmitButton({
  children,
  className,
  pendingLabel = "Salvando...",
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={cn("btn-primary", className)} disabled={pending} aria-busy={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {pending ? pendingLabel : children}
    </button>
  );
}
