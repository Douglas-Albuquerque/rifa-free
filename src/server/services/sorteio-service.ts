import { randomInt } from "node:crypto";

import { Prisma, type RifaStatus } from "@prisma/client";

import { AppError, isSerializationError, isUniqueConstraintError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

import { registrarAuditoria } from "./audit";

type RifaLock = {
  id: string;
  status: RifaStatus;
  titulo: string;
};

export async function realizarSorteio(rifaId: string, usuarioId: string) {
  const maxTentativas = 3;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const rifas = await tx.$queryRaw<RifaLock[]>`
            SELECT id, status, titulo
            FROM "Rifa"
            WHERE id = ${rifaId}
            FOR UPDATE
          `;
          const rifa = rifas[0];

          if (!rifa) throw new AppError("RIFA_NAO_ENCONTRADA", "Rifa não encontrada.", 404);
          if (rifa.status === "SORTEADA") {
            throw new AppError(
              "SORTEIO_JA_REALIZADO",
              "Esta rifa já foi sorteada. O resultado não pode ser sobrescrito.",
              409,
            );
          }
          if (rifa.status === "RASCUNHO") {
            throw new AppError(
              "RIFA_RASCUNHO",
              "Abra a rifa antes de realizar o sorteio.",
              409,
            );
          }

          const existente = await tx.sorteio.findUnique({ where: { rifaId } });
          if (existente) {
            throw new AppError(
              "SORTEIO_JA_REALIZADO",
              "Esta rifa já possui um sorteio concluído.",
              409,
            );
          }

          const elegiveis = await tx.numeroReservado.findMany({
            where: { rifaId, reserva: { statusPagamento: "PAGO" } },
            select: {
              numero: true,
              reserva: {
                select: {
                  participanteId: true,
                  participante: { select: { nome: true } },
                },
              },
            },
            orderBy: { numero: "asc" },
          });

          if (elegiveis.length === 0) {
            throw new AppError(
              "SEM_NUMEROS_ELEGIVEIS",
              "Não há números pagos. O sorteio só pode ser realizado com números de reservas pagas.",
              409,
            );
          }

          const indiceSorteado = randomInt(0, elegiveis.length);
          const vencedor = elegiveis[indiceSorteado];

          const sorteio = await tx.sorteio.create({
            data: {
              rifaId,
              numeroVencedor: vencedor.numero,
              participanteId: vencedor.reserva.participanteId,
              quantidadeElegivel: elegiveis.length,
              numerosElegiveis: elegiveis.map((item) => item.numero),
              status: "CONCLUIDO",
            },
            include: { participante: true, rifa: true },
          });

          await tx.rifa.update({ where: { id: rifaId }, data: { status: "SORTEADA" } });

          await registrarAuditoria(tx, {
            rifaId,
            acao: "SORTEIO_REALIZADO",
            entidadeAfetada: "Sorteio",
            registroId: sorteio.id,
            dadosNovos: {
              numeroVencedor: sorteio.numeroVencedor,
              participante: sorteio.participante.nome,
              quantidadeElegivel: sorteio.quantidadeElegivel,
              numerosElegiveis: sorteio.numerosElegiveis,
              dataHoraSorteio: sorteio.dataHoraSorteio,
            },
            usuarioId,
          });

          return sorteio;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10_000,
          timeout: 20_000,
        },
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError(
          "SORTEIO_JA_REALIZADO",
          "Esta rifa já foi sorteada por outra operação. Atualize a página.",
          409,
        );
      }
      if (isSerializationError(error) && tentativa < maxTentativas) {
        continue;
      }
      throw error;
    }
  }

  throw new AppError(
    "SORTEIO_CONFLITO",
    "Não foi possível concluir o sorteio por concorrência. Tente novamente.",
    409,
  );
}
