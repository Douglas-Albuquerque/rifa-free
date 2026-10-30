import { Prisma, type PagamentoStatus, type RifaStatus } from "@prisma/client";

import { AppError, isUniqueConstraintError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { ReservaInput } from "@/lib/validation";

import { registrarAuditoria } from "./audit";

type RifaLock = {
  id: string;
  status: RifaStatus;
  quantidadeNumeros: number;
  valorNumero: number;
};

export async function criarReserva(input: ReservaInput, usuarioId: string) {
  const numeros = [...new Set(input.numeros)].sort((a, b) => a - b);

  try {
    return await prisma.$transaction(async (tx) => {
      const rifas = await tx.$queryRaw<RifaLock[]>`
        SELECT id, status, "quantidadeNumeros", "valorNumero"
        FROM "Rifa"
        WHERE id = ${input.rifaId}
        FOR SHARE
      `;
      const rifa = rifas[0];

      if (!rifa) throw new AppError("RIFA_NAO_ENCONTRADA", "Rifa não encontrada.", 404);
      if (rifa.status === "ENCERRADA" || rifa.status === "SORTEADA") {
        throw new AppError(
          "RIFA_FECHADA",
          "Esta rifa não está aberta para novas reservas.",
        );
      }
      if (rifa.quantidadeNumeros < 1 || rifa.quantidadeNumeros > 500) {
        throw new AppError("RIFA_INVALIDA", "A rifa possui uma quantidade inválida de números.");
      }

      const foraDoIntervalo = numeros.filter(
        (numero) => numero < 1 || numero > rifa.quantidadeNumeros,
      );
      if (foraDoIntervalo.length > 0) {
        throw new AppError(
          "NUMERO_INVALIDO",
          `Número(s) fora do intervalo desta rifa: ${foraDoIntervalo.join(", ")}.`,
        );
      }

      const ocupados = await tx.numeroReservado.findMany({
        where: { rifaId: input.rifaId, numero: { in: numeros } },
        select: { numero: true },
        orderBy: { numero: "asc" },
      });
      if (ocupados.length > 0) {
        throw new AppError(
          "NUMERO_OCUPADO",
          `Os números ${ocupados.map((item) => item.numero).join(", ")} já estão reservados. Atualize a página.`,
          409,
        );
      }

      const participante = await tx.participante.create({
        data: { nome: input.nome, telefone: input.telefone },
      });

      const reserva = await tx.reserva.create({
        data: {
          rifaId: input.rifaId,
          participanteId: participante.id,
          statusPagamento: input.statusPagamento,
          valorCobrado: numeros.length * rifa.valorNumero,
          pagoEm: input.statusPagamento === "PAGO" ? new Date() : null,
          observacoes: input.observacoes,
          numeros: {
            create: numeros.map((numero) => ({ rifaId: input.rifaId, numero })),
          },
        },
        include: { participante: true, numeros: true },
      });

      await registrarAuditoria(tx, {
        rifaId: input.rifaId,
        acao: "RESERVA_CRIADA",
        entidadeAfetada: "Reserva",
        registroId: reserva.id,
        dadosNovos: {
          participante: reserva.participante.nome,
          telefone: reserva.participante.telefone,
          numeros,
          statusPagamento: reserva.statusPagamento,
          valorCobrado: reserva.valorCobrado,
        },
        usuarioId,
      });

      return reserva;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(
        "NUMERO_OCUPADO",
        "Um ou mais números acabaram de ser reservados por outra pessoa. Atualize a página e tente novamente.",
        409,
      );
    }
    throw error;
  }
}

export async function atualizarReserva(
  reservaId: string,
  input: { nome: string; telefone: string | null; observacoes: string | null },
  usuarioId: string,
) {
  return prisma.$transaction(async (tx) => {
    const atual = await tx.reserva.findUnique({
      where: { id: reservaId },
      include: { participante: true, numeros: { orderBy: { numero: "asc" } }, rifa: true },
    });
    if (!atual) throw new AppError("RESERVA_NAO_ENCONTRADA", "Reserva não encontrada.", 404);
    if (atual.rifa.status === "SORTEADA") {
      throw new AppError(
        "RIFA_SORTEADA",
        "Os dados de uma reserva vencedora não podem ser alterados após o sorteio.",
      );
    }

    const participante = await tx.participante.update({
      where: { id: atual.participanteId },
      data: { nome: input.nome, telefone: input.telefone },
    });

    const reserva = await tx.reserva.update({
      where: { id: reservaId },
      data: { observacoes: input.observacoes },
      include: { participante: true, numeros: true },
    });

    await registrarAuditoria(tx, {
      rifaId: atual.rifaId,
      acao: "RESERVA_ATUALIZADA",
      entidadeAfetada: "Reserva",
      registroId: reservaId,
      dadosAnteriores: {
        nome: atual.participante.nome,
        telefone: atual.participante.telefone,
        observacoes: atual.observacoes,
      },
      dadosNovos: {
        nome: participante.nome,
        telefone: participante.telefone,
        observacoes: reserva.observacoes,
      },
      usuarioId,
    });

    return reserva;
  });
}

export async function definirPagamento(
  reservaId: string,
  statusPagamento: PagamentoStatus,
  usuarioId: string,
) {
  return prisma.$transaction(
    async (tx) => {
      const atual = await tx.reserva.findUnique({
        where: { id: reservaId },
        include: {
          participante: true,
          numeros: { orderBy: { numero: "asc" } },
          rifa: { select: { sorteio: { select: { numeroVencedor: true } } } },
        },
      });
      if (!atual) throw new AppError("RESERVA_NAO_ENCONTRADA", "Reserva não encontrada.", 404);
      const vencedor = atual.rifa.sorteio?.numeroVencedor;
      if (vencedor !== undefined && atual.numeros.some((item) => item.numero === vencedor)) {
        throw new AppError(
          "RESERVA_VENCEDORA",
          "O pagamento da reserva vencedora não pode ser alterado após o sorteio.",
        );
      }

      const pagoEm = statusPagamento === "PAGO" ? atual.pagoEm ?? new Date() : null;

      const reserva = await tx.reserva.update({
        where: { id: reservaId },
        data: { statusPagamento, pagoEm },
        include: { participante: true, numeros: true },
      });

      await registrarAuditoria(tx, {
        rifaId: atual.rifaId,
        acao: "PAGAMENTO_ALTERADO",
        entidadeAfetada: "Reserva",
        registroId: reservaId,
        dadosAnteriores: {
          statusPagamento: atual.statusPagamento,
          pagoEm: atual.pagoEm,
          participante: atual.participante.nome,
          numeros: atual.numeros.map((item) => item.numero),
        },
        dadosNovos: {
          statusPagamento: reserva.statusPagamento,
          pagoEm: reserva.pagoEm,
          participante: reserva.participante.nome,
          numeros: reserva.numeros.map((item) => item.numero),
        },
        usuarioId,
      });

      return reserva;
    },
    // Serializable para conflitar com o sorteio, que lê o conjunto de reservas pagas.
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function liberarReserva(reservaId: string, usuarioId: string) {
  return prisma.$transaction(async (tx) => {
    const reserva = await tx.reserva.findUnique({
      where: { id: reservaId },
      include: {
        participante: true,
        numeros: { orderBy: { numero: "asc" } },
        rifa: { select: { id: true, status: true } },
      },
    });
    if (!reserva) throw new AppError("RESERVA_NAO_ENCONTRADA", "Reserva não encontrada.", 404);
    if (reserva.rifa.status === "SORTEADA") {
      throw new AppError(
        "RIFA_SORTEADA",
        "Números de uma rifa sorteada não podem ser liberados.",
      );
    }

    await registrarAuditoria(tx, {
      rifaId: reserva.rifaId,
      acao: "RESERVA_LIBERADA",
      entidadeAfetada: "Reserva",
      registroId: reservaId,
      dadosAnteriores: {
        participante: reserva.participante.nome,
        telefone: reserva.participante.telefone,
        numeros: reserva.numeros.map((item) => item.numero),
        statusPagamento: reserva.statusPagamento,
        valorCobrado: reserva.valorCobrado,
      },
      usuarioId,
    });

    await tx.reserva.delete({ where: { id: reservaId } });
    return { numeros: reserva.numeros.map((item) => item.numero), rifaId: reserva.rifaId };
  });
}
