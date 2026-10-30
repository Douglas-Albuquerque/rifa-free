import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import type { RifaInput } from "@/lib/validation";
import type { RifaStatus } from "@prisma/client";

import { registrarAuditoria } from "./audit";

function validarConfiguracao(input: RifaInput) {
  if (!Number.isInteger(input.quantidadeNumeros) || input.quantidadeNumeros < 1 || input.quantidadeNumeros > 500) {
    throw new AppError("QUANTIDADE_INVALIDA", "A quantidade de números deve estar entre 1 e 500.");
  }
  if (!Number.isInteger(input.valorNumero) || input.valorNumero <= 0) {
    throw new AppError("VALOR_INVALIDO", "O valor do número deve ser maior que zero.");
  }
}

export async function criarRifa(input: RifaInput, usuarioId: string) {
  validarConfiguracao(input);
  return prisma.$transaction(async (tx) => {
    const rifa = await tx.rifa.create({
      data: {
        titulo: input.titulo,
        descricao: input.descricao,
        quantidadeNumeros: input.quantidadeNumeros,
        valorNumero: input.valorNumero,
        dataInicio: input.dataInicio,
        dataSorteio: input.dataSorteio,
        status: input.status,
      },
    });

    await registrarAuditoria(tx, {
      rifaId: rifa.id,
      acao: "RIFA_CRIADA",
      entidadeAfetada: "Rifa",
      registroId: rifa.id,
      dadosNovos: rifa,
      usuarioId,
    });

    return rifa;
  });
}

export async function atualizarRifa(rifaId: string, input: RifaInput, usuarioId: string) {
  validarConfiguracao(input);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Rifa" WHERE id = ${rifaId} FOR UPDATE`;

    const atual = await tx.rifa.findUnique({ where: { id: rifaId } });
    if (!atual) throw new AppError("RIFA_NAO_ENCONTRADA", "Rifa não encontrada.", 404);

    const maiorNumeroReservado = await tx.numeroReservado.aggregate({
      where: { rifaId },
      _max: { numero: true },
    });

    if (
      maiorNumeroReservado._max.numero &&
      input.quantidadeNumeros < maiorNumeroReservado._max.numero
    ) {
      throw new AppError(
        "QUANTIDADE_INVALIDA",
        `Não é possível reduzir para ${input.quantidadeNumeros} números: existem reservas até o número ${maiorNumeroReservado._max.numero}.`,
      );
    }

    const status: RifaStatus = atual.status === "SORTEADA" ? "SORTEADA" : input.status;

    const rifa = await tx.rifa.update({
      where: { id: rifaId },
      data: {
        titulo: input.titulo,
        descricao: input.descricao,
        quantidadeNumeros: input.quantidadeNumeros,
        valorNumero: input.valorNumero,
        dataInicio: input.dataInicio,
        dataSorteio: input.dataSorteio,
        status,
      },
    });

    await registrarAuditoria(tx, {
      rifaId,
      acao: "RIFA_ATUALIZADA",
      entidadeAfetada: "Rifa",
      registroId: rifaId,
      dadosAnteriores: atual,
      dadosNovos: rifa,
      usuarioId,
    });

    return rifa;
  });
}

export async function alterarStatusRifa(rifaId: string, status: RifaStatus, usuarioId: string) {
  return prisma.$transaction(async (tx) => {
    const atual = await tx.rifa.findUnique({ where: { id: rifaId } });
    if (!atual) throw new AppError("RIFA_NAO_ENCONTRADA", "Rifa não encontrada.", 404);
    if (atual.status === "SORTEADA") {
      throw new AppError(
        "RIFA_SORTEADA",
        "O status de uma rifa sorteada não pode ser alterado por operações comuns.",
      );
    }

    const rifa = await tx.rifa.update({ where: { id: rifaId }, data: { status } });

    await registrarAuditoria(tx, {
      rifaId,
      acao: "RIFA_STATUS_ALTERADO",
      entidadeAfetada: "Rifa",
      registroId: rifaId,
      dadosAnteriores: { status: atual.status },
      dadosNovos: { status },
      usuarioId,
    });

    return rifa;
  });
}
