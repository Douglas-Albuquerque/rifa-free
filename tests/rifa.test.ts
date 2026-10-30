import { beforeEach, describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { rifaSchema, type RifaInput } from "@/lib/validation";
import {
  alterarStatusRifa,
  atualizarRifa,
  criarRifa,
} from "@/server/services/rifa-service";
import { criarReserva } from "@/server/services/reserva-service";

import { createAdmin, createRifa, resetDatabase, reservaInput } from "./helpers";

function buildInput(overrides: Partial<RifaInput> = {}): RifaInput {
  return {
    titulo: "Rifa solidária",
    descricao: "Prêmio: cesta de produtos",
    quantidadeNumeros: 100,
    valorNumero: 500,
    dataInicio: null,
    dataSorteio: new Date("2026-12-01T23:00:00.000Z"),
    status: "ABERTA",
    ...overrides,
  };
}

describe("Cadastro e edição de rifas", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("aceita rifa com 100 e com 500 números", async () => {
    for (const quantidade of [100, 500]) {
      const parsed = rifaSchema.safeParse({
        titulo: "Rifa válida",
        descricao: "Descrição suficiente",
        quantidadeNumeros: String(quantidade),
        valorNumero: "5,00",
        dataInicio: "",
        dataSorteio: "2026-12-01T20:00",
        status: "ABERTA",
      });
      expect(parsed.success).toBe(true);
      if (!parsed.success) continue;
      expect(parsed.data.quantidadeNumeros).toBe(quantidade);
      expect(parsed.data.valorNumero).toBe(500);
    }
  });

  it("rejeita mais de 500 números na validação e no serviço", async () => {
    const parsed = rifaSchema.safeParse({
      titulo: "Rifa grande",
      descricao: "Descrição suficiente",
      quantidadeNumeros: "501",
      valorNumero: "5,00",
      dataInicio: "",
      dataSorteio: "2026-12-01T20:00",
      status: "ABERTA",
    });
    expect(parsed.success).toBe(false);

    const admin = await createAdmin();
    await expect(criarRifa(buildInput({ quantidadeNumeros: 501 }), admin.id)).rejects.toMatchObject({
      code: "QUANTIDADE_INVALIDA",
    });
  });

  it("o banco também impede quantidade acima de 500", async () => {
    await expect(createRifa({ quantidadeNumeros: 501 })).rejects.toThrow();
  });

  it("cria rifa com 500 números e registra auditoria", async () => {
    const admin = await createAdmin();
    const rifa = await criarRifa(buildInput({ quantidadeNumeros: 500 }), admin.id);

    expect(rifa.quantidadeNumeros).toBe(500);
    expect(rifa.status).toBe("ABERTA");

    const auditorias = await prisma.auditoria.findMany({ where: { rifaId: rifa.id } });
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0].acao).toBe("RIFA_CRIADA");
    expect(auditorias[0].usuarioId).toBe(admin.id);
  });

  it("impede reduzir a quantidade abaixo do maior número reservado", async () => {
    const admin = await createAdmin();
    const rifa = await criarRifa(buildInput(), admin.id);
    await criarReserva(reservaInput(rifa.id, [50]), admin.id);

    await expect(
      atualizarRifa(rifa.id, buildInput({ quantidadeNumeros: 40 }), admin.id),
    ).rejects.toMatchObject({ code: "QUANTIDADE_INVALIDA" });

    const atual = await prisma.rifa.findUniqueOrThrow({ where: { id: rifa.id } });
    expect(atual.quantidadeNumeros).toBe(100);
  });

  it("atualiza a rifa e registra os valores anteriores e novos", async () => {
    const admin = await createAdmin();
    const rifa = await criarRifa(buildInput(), admin.id);
    await atualizarRifa(rifa.id, buildInput({ titulo: "Novo título", valorNumero: 750 }), admin.id);

    const atual = await prisma.rifa.findUniqueOrThrow({ where: { id: rifa.id } });
    expect(atual.titulo).toBe("Novo título");
    expect(atual.valorNumero).toBe(750);

    const auditoria = await prisma.auditoria.findFirstOrThrow({
      where: { rifaId: rifa.id, acao: "RIFA_ATUALIZADA" },
    });
    expect(auditoria.dadosAnteriores).toMatchObject({ titulo: "Rifa solidária", valorNumero: 500 });
    expect(auditoria.dadosNovos).toMatchObject({ titulo: "Novo título", valorNumero: 750 });
  });

  it("protege o status de uma rifa sorteada", async () => {
    const admin = await createAdmin();
    const rifa = await createRifa({ status: "SORTEADA" });

    await expect(alterarStatusRifa(rifa.id, "ABERTA", admin.id)).rejects.toBeInstanceOf(AppError);
    await expect(alterarStatusRifa(rifa.id, "ABERTA", admin.id)).rejects.toMatchObject({
      code: "RIFA_SORTEADA",
    });
  });
});
