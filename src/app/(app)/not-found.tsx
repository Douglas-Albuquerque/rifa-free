import { Compass, Plus } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="card mt-8">
      <EmptyState
        icon={<Compass className="h-6 w-6" />}
        title="Página ou rifa não encontrada"
        description="O endereço pode estar incorreto ou o registro foi removido."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/" className="btn-secondary">Ir para o painel</Link>
            <Link href="/rifas/nova" className="btn-primary">
              <Plus className="h-4 w-4" aria-hidden />
              Nova rifa
            </Link>
          </div>
        }
      />
    </div>
  );
}
