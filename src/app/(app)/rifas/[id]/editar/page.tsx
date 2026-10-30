import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth";
import { obterRifa } from "@/server/queries";
import { RifaForm } from "@/components/rifa-form";
import { PageHeader, RifaStatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Editar rifa" };
export const dynamic = "force-dynamic";

export default async function EditarRifaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const rifa = await obterRifa(id);
  if (!rifa) notFound();

  return (
    <>
      <Link href={`/rifas/${rifa.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Voltar para a rifa
      </Link>
      <PageHeader
        eyebrow="Editar rifa"
        title={rifa.titulo}
        description="Alterações são registradas na auditoria e aplicadas imediatamente."
        actions={<RifaStatusBadge status={rifa.status} />}
      />
      <RifaForm
        rifa={{
          id: rifa.id,
          titulo: rifa.titulo,
          descricao: rifa.descricao,
          quantidadeNumeros: rifa.quantidadeNumeros,
          valorNumero: rifa.valorNumero,
          dataInicio: rifa.dataInicio,
          dataSorteio: rifa.dataSorteio,
          status: rifa.status,
        }}
      />
    </>
  );
}
