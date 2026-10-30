import type { RifaStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Auditoria", "Sorteio", "NumeroReservado", "Reserva", "Participante", "Rifa", "AdminUser" RESTART IDENTITY CASCADE;',
  );
}

export async function createAdmin() {
  return prisma.adminUser.create({
    data: {
      nome: "Administrador Teste",
      email: `admin-${Date.now()}-${Math.random().toString(16).slice(2)}@teste.local`,
      senhaHash: "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin",
    },
  });
}

export async function createRifa(overrides: {
  titulo?: string;
  descricao?: string;
  quantidadeNumeros?: number;
  valorNumero?: number;
  status?: RifaStatus;
  dataSorteio?: Date;
} = {}) {
  return prisma.rifa.create({
    data: {
      titulo: overrides.titulo ?? "Rifa de teste",
      descricao: overrides.descricao ?? "Descrição da rifa de teste",
      quantidadeNumeros: overrides.quantidadeNumeros ?? 100,
      valorNumero: overrides.valorNumero ?? 500,
      dataSorteio: overrides.dataSorteio ?? new Date("2026-12-01T20:00:00-03:00"),
      status: overrides.status ?? "ABERTA",
    },
  });
}

export function reservaInput(rifaId: string, numeros: number[], nome = "Maria da Silva") {
  return {
    rifaId,
    nome,
    telefone: "(11) 99999-9999",
    numeros,
    statusPagamento: "PENDENTE" as const,
    observacoes: null,
  };
}
