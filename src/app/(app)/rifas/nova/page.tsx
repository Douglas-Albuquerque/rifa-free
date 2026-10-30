import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { requireSession } from "@/lib/auth";
import { RifaForm } from "@/components/rifa-form";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Nova rifa" };

export default async function NovaRifaPage() {
  await requireSession();

  return (
    <>
      <Link href="/rifas" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Voltar para minhas rifas
      </Link>
      <PageHeader
        eyebrow="Nova rifa"
        title="Criar uma rifa"
        description="Defina os números, o valor e a data do sorteio. Você poderá editar tudo antes de abrir."
      />
      <RifaForm />
    </>
  );
}
