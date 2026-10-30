import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  atualizarReserva,
  criarReserva,
  definirPagamento,
  liberarReserva,
} from "@/server/services/reserva-service";

import { createAdmin, createRifa, resetDatabase, reservaInput } from "./helpers";

describe("Reservas de números", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("reserva três números para um participante e calcula o total", async () => {
    const admin = await createAdmin();
    const rifa = await createRifa({ valorNumero: 500 });
    const reserva = await criarReserva(
      reservaInput(rifa.id, [7, 3, 21], "João Pereira"),
      admin.id,
    );

    expect(reserva.participante.nome).toBe("João Pereira");
    expect(reserva.valorCobrado).toBe(1500);
    expect(reserva.statusPagamento).toBe("PENDENTE");
    expect(reserva.pagoEm).toBeNull();
    expect(reserva.numeros.map((item) => item.numero).sort((a, b) => a - b)).toEqual([3, 7, 21]);

    const numerosNoBanco = await prisma.numeroReservado.count({ where: { rifaId: rifa.id } });
    expect(numerosNoBanco).toBe(3);

    const auditoria = await prisma.auditoria.findFirstOrThrow({
      where: { rifaId: rifa.id, acao: "RESERVA_CRIADA" },
    });
    expect(auditoria.dadosNovos).toMatchObject({ numeros: [3, 7, 21], valorCobrado: 1500 });
  });

  it("impede reservar um número já ocupado", async () => {
    const admin = await createAdmin();
    const rifa = await createRifa();
    await criarReserva(reservaInput(rifa.id, [11], "Primeira Pessoa"), admin.id);

    await expect(
      criarReserva(reservaInput(rifa.id, [11], "Segunda Pessoa"), admin.id),
    ).rejects.toMatchObject({ code: "NUMERO_OCUPADO" });

    expect(await prisma.numeroReservado.count({ where: { rifaId: rifa.id, numero: 11 } })).toBe(1);
  });

  it("impede reservas simultâneas do mesmo número", async () => {
    const admin = await createAdmin();
    const rifa = await createRifa();

    const resultados = await Promise.allSettled([
      criarReserva(reservaInput(rifa.id, [42], "Pessoa A"), admin.id),
      criarReserva(reservaInput(rifa.id, [42], "Pessoa B"), admin.id),
      criarReserva(reservaInput(rifa.id, [42], "Pessoa C"), admin.id),
    ]);

    const sucessos = resultados.filter((resultado) => resultado.status === "fulfilled");
    const falhas = resultados.filter((resultado) => resultado.status === "rejected");

    expect(sucessos).toHaveLength(1);
    expect(falhas).toHaveLength(2);
    expect(
      await prisma.numeroReservado.count({ where: { rifaId: rifa.id, numero: 42 } }),
    ).toBe(1);
    expect(await prisma.reserva.count({ where: { rifaId: rifa.id } })).toBe(1);
  });

  it("a restrição única do banco protege rifa e número", async () => {
    const admin = await createAdmin();
    const rifa = await createRifa();
    const reserva = await criarReserva(reservaInput(rifa.id, [5]), admin.id);

    const participante = await prisma.participante.create({ data: { nome: "Outra Pessoa" } });
    const outraReserva = await prisma.reserva.create({
      data: {
        rifaId: rifa.id,
        participanteId: participante.id,
        valorCobrado: 500,
      },
    });

    await expect(
      prisma.numeroReservado.create({
        data: { rifaId: rifa.id, reservaId: outraReserva.id, numero: 5 },
      }),
    ).rejects.toThrow();

    expect(reserva.numeros[0].numero).toBe(5);
  });

  it("rejeita números fora do intervalo da rifa", async () => {
    const admin = await createAdmin();
    const rifa = await createRifa({ quantidadeNumeros: 10 });

    await expect(
      criarReserva(reservaInput(rifa.id, [11]), admin.id),
    ).rejects.toMatchObject({ code: "NUMERO_INVALIDO" });
  });

  it("bloqueia novas reservas em rifa encerrada ou sorteada", async () => {
    const admin = await createAdmin();
    const encerrada = await createRifa({ status: "ENCERRADA" });
    const sorteada = await createRifa({ status: "SORTEADA" });

    await expect(criarReserva(reservaInput(encerrada.id, [1]), admin.id)).rejects.toMatchObject({
      code: "RIFA_FECHADA",
    });
    await expect(criarReserva(reservaInput(sorteada.id, [1]), admin.id)).rejects.toMatchObject({
      code: "RIFA_FECHADA",
    });
  });

  it("confirma e reverte pagamento registrando data e auditoria", async () => {
    const admin = await createAdmin();
    const rifa = await createRifa();
    const reserva = await criarReserva(reservaInput(rifa.id, [8, 9]), admin.id);

    const paga = await definirPagamento(reserva.id, "PAGO", admin.id);
    expect(paga.statusPagamento).toBe("PAGO");
    expect(paga.pagoEm).toBeInstanceOf(Date);

    const auditoriaPago = await prisma.auditoria.findFirstOrThrow({
      where: { rifaId: rifa.id, acao: "PAGAMENTO_ALTERADO" },
      orderBy: { dataHora: "desc" },
    });
    expect(auditoriaPago.dadosAnteriores).toMatchObject({ statusPagamento: "PENDENTE" });
    expect(auditoriaPago.dadosNovos).toMatchObject({ statusPagamento: "PAGO" });

    const pendente = await definirPagamento(reserva.id, "PENDENTE", admin.id);
    expect(pendente.statusPagamento).toBe("PENDENTE");
    expect(pendente.pagoEm).toBeNull();
  });

  it("edita os dados do participante mantendo a reserva", async () => {
    const admin = await createAdmin();
    const rifa = await createRifa();
    const reserva = await criarReserva(reservaInput(rifa.id, [12], "Nome Antigo"), admin.id);

    const atualizada = await atualizarReserva(
      reserva.id,
      { nome: "Nome Novo", telefone: "(21) 98888-7777", observacoes: "Pagou metade" },
      admin.id,
    );

    expect(atualizada.participante.nome).toBe("Nome Novo");
    expect(atualizada.participante.telefone).toBe("(21) 98888-7777");
    expect(atualizada.observacoes).toBe("Pagou metade");
    expect(atualizada.numeros.map((item) => item.numero)).toEqual([12]);
  });

  it("libera os números, remove a reserva e audita a operação", async () => {
    const admin = await createAdmin();
    const rifa = await createRifa();
    const reserva = await criarReserva(reservaInput(rifa.id, [30, 31], "Carlos"), admin.id);

    const resultado = await liberarReserva(reserva.id, admin.id);
    expect(resultado.numeros).toEqual([30, 31]);

    expect(await prisma.reserva.findUnique({ where: { id: reserva.id } })).toBeNull();
    expect(await prisma.numeroReservado.count({ where: { rifaId: rifa.id } })).toBe(0);

    const auditoria = await prisma.auditoria.findFirstOrThrow({
      where: { rifaId: rifa.id, acao: "RESERVA_LIBERADA" },
    });
    expect(auditoria.dadosAnteriores).toMatchObject({ numeros: [30, 31] });

    const nova = await criarReserva(reservaInput(rifa.id, [30], "Nova Pessoa"), admin.id);
    expect(nova.numeros[0].numero).toBe(30);
  });
});
