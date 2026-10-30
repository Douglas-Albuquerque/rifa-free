import type { Prisma } from "@prisma/client";

type AuditInput = {
  rifaId?: string | null;
  acao: string;
  entidadeAfetada: string;
  registroId?: string | null;
  dadosAnteriores?: unknown;
  dadosNovos?: unknown;
  usuarioId: string;
};

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function registrarAuditoria(tx: Prisma.TransactionClient, input: AuditInput) {
  await tx.auditoria.create({
    data: {
      rifaId: input.rifaId ?? null,
      acao: input.acao,
      entidadeAfetada: input.entidadeAfetada,
      registroId: input.registroId ?? null,
      dadosAnteriores: toJson(input.dadosAnteriores),
      dadosNovos: toJson(input.dadosNovos),
      usuarioId: input.usuarioId,
    },
  });
}
