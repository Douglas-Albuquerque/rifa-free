import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { criarReserva, definirPagamento } from "@/server/services/reserva-service";
import { realizarSorteio } from "@/server/services/sorteio-service";

import { createAdmin, createRifa, resetDatabase, reservaInput } from "./helpers";

function reservaPaga(rifaId: string, numeros: number[], nome?: string) {
  return { ...reservaInput(rifaId, numeros, nome), statusPagamento: "PAGO" as const };
}

describe("Sorteio da rifa", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("bloqueia sorteio sem números reservados", async () => {
    const admin = await createAdmin();
    const rifa = await createRifa();

    await expect(realizarSorteio(rifa.id, admin.id)).rejects.toMatchObject({
      code: "SEM_NUMEROS_ELEGIVEIS",
    });
  });

  it("bloqueia sorteio de rifa em rascunho", async () => {
    const admin = await createAdmin();
    const rifa = await createRifa({ status: "RASCUNHO" });
    await criarReserva(reservaPaga(rifa.id, [1]), admin.id);

    await expect(realizarSorteio(rifa.id, admin.id)).rejects.toMatchObject({
      code: "RIFA_RASCUNHO",
    });
  });

  it("sorteia apenas número reservado e persiste o resultado", async () => {
    const admin = await createAdmin();
    const rifa = await createRifa({ quantidadeNumeros: 500 });
    await criarReserva(reservaPaga(rifa.id, [101, 250, 499], "Ana"), admin.id);
    await criarReserva(reservaPaga(rifa.id, [2], "Bruno"), admin.id);

    const sorteio = await realizarSorteio(rifa.id, admin.id);

    expect([2, 101, 250, 499]).toContain(sorteio.numeroVencedor);
    expect(sorteio.quantidadeElegivel).toBe(4);
    expect(sorteio.numerosElegiveis.sort((a, b) => a - b)).toEqual([2, 101, 250, 499]);
    expect(sorteio.participante.nome).toBeTruthy();

    const persistido = await prisma.sorteio.findUniqueOrThrow({ where: { rifaId: rifa.id } });
    expect(persistido.numeroVencedor).toBe(sorteio.numeroVencedor);
    expect(persistido.participanteId).toBe(sorteio.participanteId);

    const rifaAtualizada = await prisma.rifa.findUniqueOrThrow({ where: { id: rifa.id } });
    expect(rifaAtualizada.status).toBe("SORTEADA");

    const auditoria = await prisma.auditoria.findFirstOrThrow({
      where: { rifaId: rifa.id, acao: "SORTEIO_REALIZADO" },
    });
    expect(auditoria.dadosNovos).toMatchObject({ numeroVencedor: sorteio.numeroVencedor });
  });

  it("nunca sorteia números disponíveis", async () => {
    const admin = await createAdmin();

    for (let i = 0; i < 12; i++) {
      const rifa = await createRifa({ quantidadeNumeros: 500, titulo: `Rifa ${i}` });
      const reservados = [497, 498, 499, 500].slice(0, (i % 4) + 1);
      await criarReserva(reservaPaga(rifa.id, reservados, `Participante ${i}`), admin.id);

      const sorteio = await realizarSorteio(rifa.id, admin.id);
      expect(reservados).toContain(sorteio.numeroVencedor);
    }
  });

  it("bloqueia sorteio quando só há reservas pendentes", async () => {
    const admin = await createAdmin();
    const rifa = await createRifa();
    await criarReserva(reservaInput(rifa.id, [77], "Pendente"), admin.id);

    await expect(realizarSorteio(rifa.id, admin.id)).rejects.toMatchObject({
      code: "SEM_NUMEROS_ELEGIVEIS",
    });
  });

  it("nunca sorteia números de reservas pendentes", async () => {
    const admin = await createAdmin();

    for (let i = 0; i < 12; i++) {
      const rifa = await createRifa({ titulo: `Rifa ${i}` });
      await criarReserva(reservaInput(rifa.id, [1, 2, 3, 4, 5, 6, 7, 8, 9], `Pendente ${i}`), admin.id);
      await criarReserva(reservaPaga(rifa.id, [50, 60], `Pago ${i}`), admin.id);

      const sorteio = await realizarSorteio(rifa.id, admin.id);
      expect([50, 60]).toContain(sorteio.numeroVencedor);
      expect(sorteio.numerosElegiveis.sort((a, b) => a - b)).toEqual([50, 60]);
      expect(sorteio.quantidadeElegivel).toBe(2);
    }
  });

  it("impede alterar o pagamento da reserva vencedora após o sorteio", async () => {
    const admin = await createAdmin();
    const rifa = await createRifa();
    const vencedora = await criarReserva(reservaPaga(rifa.id, [8]), admin.id);
    await realizarSorteio(rifa.id, admin.id);

    await expect(definirPagamento(vencedora.id, "PENDENTE", admin.id)).rejects.toMatchObject({
      code: "RESERVA_VENCEDORA",
    });
    const persistida = await prisma.reserva.findUniqueOrThrow({ where: { id: vencedora.id } });
    expect(persistida.statusPagamento).toBe("PAGO");
  });

  it("impede um segundo sorteio normal", async () => {
    const admin = await createAdmin();
    const rifa = await createRifa();
    await criarReserva(reservaPaga(rifa.id, [5]), admin.id);

    const primeiro = await realizarSorteio(rifa.id, admin.id);
    await expect(realizarSorteio(rifa.id, admin.id)).rejects.toMatchObject({
      code: "SORTEIO_JA_REALIZADO",
    });

    const sorteios = await prisma.sorteio.findMany({ where: { rifaId: rifa.id } });
    expect(sorteios).toHaveLength(1);
    expect(sorteios[0].numeroVencedor).toBe(primeiro.numeroVencedor);
  });

  it("executa apenas um sorteio em chamadas concorrentes", async () => {
    const admin = await createAdmin();
    const rifa = await createRifa();
    await criarReserva(reservaPaga(rifa.id, [10, 20, 30]), admin.id);

    const resultados = await Promise.allSettled([
      realizarSorteio(rifa.id, admin.id),
      realizarSorteio(rifa.id, admin.id),
      realizarSorteio(rifa.id, admin.id),
    ]);

    const sucessos = resultados.filter((resultado) => resultado.status === "fulfilled");
    const falhas = resultados.filter((resultado) => resultado.status === "rejected");

    expect(sucessos).toHaveLength(1);
    expect(falhas).toHaveLength(2);
    expect(await prisma.sorteio.count({ where: { rifaId: rifa.id } })).toBe(1);
  });

  it("o banco impede dois sorteios concluídos para a mesma rifa", async () => {
    const rifa = await createRifa();
    const participante = await prisma.participante.create({ data: { nome: "Teste" } });

    await prisma.sorteio.create({
      data: {
        rifaId: rifa.id,
        numeroVencedor: 1,
        participanteId: participante.id,
        quantidadeElegivel: 1,
        numerosElegiveis: [1],
      },
    });

    await expect(
      prisma.sorteio.create({
        data: {
          rifaId: rifa.id,
          numeroVencedor: 2,
          participanteId: participante.id,
          quantidadeElegivel: 1,
          numerosElegiveis: [2],
        },
      }),
    ).rejects.toThrow();
  });
});
