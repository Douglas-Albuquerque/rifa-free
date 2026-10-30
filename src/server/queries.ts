import "server-only";

import type { PagamentoStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type ResumoTipo = {
  totalNumeros: number;
  reservados: number;
  disponiveis: number;
  pendentes: number;
  pagos: number;
  arrecadado: number;
  aReceber: number;
  ocupacao: number;
};

type ReservaResumo = {
  statusPagamento: PagamentoStatus;
  valorCobrado: number;
  numeros: { id: string }[];
};

export function calcularResumo(
  quantidadeNumeros: number,
  reservas: ReservaResumo[],
): ResumoTipo {
  let reservados = 0;
  let pagos = 0;
  let arrecadado = 0;
  let aReceber = 0;

  for (const reserva of reservas) {
    const quantidade = reserva.numeros.length;
    reservados += quantidade;
    if (reserva.statusPagamento === "PAGO") {
      pagos += quantidade;
      arrecadado += reserva.valorCobrado;
    } else {
      aReceber += reserva.valorCobrado;
    }
  }

  return {
    totalNumeros: quantidadeNumeros,
    reservados,
    disponiveis: Math.max(0, quantidadeNumeros - reservados),
    pendentes: reservados - pagos,
    pagos,
    arrecadado,
    aReceber,
    ocupacao: quantidadeNumeros > 0 ? (reservados / quantidadeNumeros) * 100 : 0,
  };
}

const resumoInclude = {
  reservas: {
    select: {
      statusPagamento: true,
      valorCobrado: true,
      numeros: { select: { id: true } },
    },
  },
} as const;

export async function listarRifasComResumo() {
  const rifas = await prisma.rifa.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      ...resumoInclude,
      sorteio: {
        select: { numeroVencedor: true, participante: { select: { nome: true } } },
      },
    },
  });

  return rifas.map((rifa) => ({
    ...rifa,
    resumo: calcularResumo(rifa.quantidadeNumeros, rifa.reservas),
  }));
}

export type RifaListada = Awaited<ReturnType<typeof listarRifasComResumo>>[number];

export function resumoGlobal(rifas: Awaited<ReturnType<typeof listarRifasComResumo>>) {
  const totais = rifas.reduce<Omit<ResumoTipo, "ocupacao">>(
    (acc, rifa) => ({
      totalNumeros: acc.totalNumeros + rifa.resumo.totalNumeros,
      reservados: acc.reservados + rifa.resumo.reservados,
      disponiveis: acc.disponiveis + rifa.resumo.disponiveis,
      pendentes: acc.pendentes + rifa.resumo.pendentes,
      pagos: acc.pagos + rifa.resumo.pagos,
      arrecadado: acc.arrecadado + rifa.resumo.arrecadado,
      aReceber: acc.aReceber + rifa.resumo.aReceber,
    }),
    {
      totalNumeros: 0,
      reservados: 0,
      disponiveis: 0,
      pendentes: 0,
      pagos: 0,
      arrecadado: 0,
      aReceber: 0,
    },
  );

  return {
    ...totais,
    ocupacao: totais.totalNumeros > 0 ? (totais.reservados / totais.totalNumeros) * 100 : 0,
  };
}

export async function obterRifa(id: string) {
  return prisma.rifa.findUnique({
    where: { id },
    include: {
      reservas: {
        orderBy: { createdAt: "asc" },
        include: {
          participante: true,
          numeros: { orderBy: { numero: "asc" } },
        },
      },
      sorteio: { include: { participante: true } },
    },
  });
}

export async function obterRifaSimples(id: string) {
  return prisma.rifa.findUnique({
    where: { id },
    include: {
      sorteio: { include: { participante: true } },
      _count: { select: { numeros: true } },
    },
  });
}

export async function listarReservas(filtros: {
  rifaId?: string;
  nome?: string;
  pagamento?: PagamentoStatus;
  estado?: "TODOS" | "RESERVADO" | "PAGO" | "PENDENTE";
}) {
  const statusPagamento =
    filtros.pagamento ??
    (filtros.estado === "PAGO"
      ? "PAGO"
      : filtros.estado === "PENDENTE"
        ? "PENDENTE"
        : undefined);

  const termo = filtros.nome?.trim();
  const numeroBuscado = termo && /^\d+$/.test(termo) ? Number(termo) : null;
  const where: Prisma.ReservaWhereInput = {
    rifaId: filtros.rifaId || undefined,
    statusPagamento,
  };

  if (termo) {
    where.OR = [{ participante: { nome: { contains: termo, mode: "insensitive" } } }];
    if (numeroBuscado !== null && Number.isSafeInteger(numeroBuscado)) {
      where.OR.push({ numeros: { some: { numero: numeroBuscado } } });
    }
  }

  return prisma.reserva.findMany({
    where,
    include: {
      participante: true,
      numeros: { orderBy: { numero: "asc" } },
      rifa: { select: { id: true, titulo: true, status: true, valorNumero: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export async function obterReserva(id: string) {
  return prisma.reserva.findUnique({
    where: { id },
    include: {
      participante: true,
      numeros: { orderBy: { numero: "asc" } },
      rifa: true,
    },
  });
}

export async function listarHistoricoSorteios() {
  return prisma.sorteio.findMany({
    orderBy: { dataHoraSorteio: "desc" },
    include: {
      rifa: { select: { id: true, titulo: true, status: true } },
      participante: true,
    },
    take: 100,
  });
}

export async function listarAuditorias(rifaId: string) {
  return prisma.auditoria.findMany({
    where: { rifaId },
    orderBy: { dataHora: "desc" },
    include: { usuario: { select: { nome: true, email: true } } },
    take: 500,
  });
}

export async function listarRifasParaFiltro() {
  return prisma.rifa.findMany({
    select: { id: true, titulo: true, status: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function obterRifaParaSorteio(id: string) {
  return prisma.rifa.findUnique({
    where: { id },
    include: {
      numeros: {
        orderBy: { numero: "asc" },
        select: {
          numero: true,
          reserva: {
            select: {
              statusPagamento: true,
              participante: { select: { nome: true } },
            },
          },
        },
      },
      sorteio: { include: { participante: true } },
    },
  });
}
