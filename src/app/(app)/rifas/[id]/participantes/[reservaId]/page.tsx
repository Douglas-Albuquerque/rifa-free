import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth";
import { formatDateTime, formatNumber } from "@/lib/format";
import { obterReserva, obterRifaSimples } from "@/server/queries";
import { ReservaEditor } from "@/components/reserva-editor";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Detalhes da reserva" };
export const dynamic = "force-dynamic";

export default async function ReservaPage({
  params,
}: {
  params: Promise<{ id: string; reservaId: string }>;
}) {
  await requireSession();
  const { id, reservaId } = await params;
  const [rifa, reserva] = await Promise.all([obterRifaSimples(id), obterReserva(reservaId)]);

  if (!rifa || !reserva || reserva.rifaId !== rifa.id) notFound();

  const numeros = reserva.numeros.map((item) => item.numero);
  const isVencedora = Boolean(rifa.sorteio && numeros.includes(rifa.sorteio.numeroVencedor));

  return (
    <>
      <Link href={`/rifas/${rifa.id}/participantes`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Voltar para participantes
      </Link>
      <PageHeader
        eyebrow={rifa.titulo}
        title={reserva.participante.nome}
        description={`Reserva feita em ${formatDateTime(reserva.createdAt)} · números ${numeros.map(formatNumber).join(", ")}`}
      />
      <ReservaEditor
        reserva={{
          id: reserva.id,
          rifaId: reserva.rifaId,
          participanteNome: reserva.participante.nome,
          telefone: reserva.participante.telefone,
          observacoes: reserva.observacoes,
          statusPagamento: reserva.statusPagamento,
          valorCobrado: reserva.valorCobrado,
          numeros,
          isSorteada: rifa.status === "SORTEADA",
          isVencedora,
        }}
      />
    </>
  );
}
