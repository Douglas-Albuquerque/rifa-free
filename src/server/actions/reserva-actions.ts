"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth";
import { fail, publicErrorMessage, success, type ActionResult } from "@/lib/errors";
import {
  liberacaoSchema,
  pagamentoSchema,
  reservaAtualizacaoSchema,
  reservaSchema,
} from "@/lib/validation";
import {
  atualizarReserva,
  criarReserva,
  definirPagamento,
  liberarReserva,
} from "@/server/services/reserva-service";

import { actionFailureFromZod } from "./helpers";

function revalidar(rifaId: string) {
  revalidatePath("/");
  revalidatePath("/rifas");
  revalidatePath("/pesquisa");
  revalidatePath("/historico");
  revalidatePath(`/rifas/${rifaId}`);
  revalidatePath(`/rifas/${rifaId}/participantes`);
  revalidatePath(`/rifas/${rifaId}/pagamentos`);
  revalidatePath(`/rifas/${rifaId}/sorteio`);
  revalidatePath(`/rifas/${rifaId}/auditoria`);
}

export async function criarReservaAction(input: unknown): Promise<ActionResult> {
  const user = await requireSession();
  const parsed = reservaSchema.safeParse(input);
  if (!parsed.success) return actionFailureFromZod(parsed.error);

  try {
    const reserva = await criarReserva(parsed.data, user.id);
    revalidar(parsed.data.rifaId);
    return success(
      `Reserva confirmada para ${reserva.participante.nome} (${reserva.numeros.length} número(s)).`,
    );
  } catch (error) {
    return fail(publicErrorMessage(error));
  }
}

export async function atualizarReservaAction(
  reservaId: string,
  input: unknown,
): Promise<ActionResult> {
  const user = await requireSession();
  const parsed = reservaAtualizacaoSchema.safeParse({ ...(input as object), reservaId });
  if (!parsed.success) return actionFailureFromZod(parsed.error);

  try {
    const reserva = await atualizarReserva(
      reservaId,
      {
        nome: parsed.data.nome,
        telefone: parsed.data.telefone,
        observacoes: parsed.data.observacoes,
      },
      user.id,
    );
    revalidar(reserva.rifaId);
    return success("Dados da reserva atualizados.");
  } catch (error) {
    return fail(publicErrorMessage(error));
  }
}

export async function definirPagamentoAction(input: unknown): Promise<ActionResult> {
  const user = await requireSession();
  const parsed = pagamentoSchema.safeParse(input);
  if (!parsed.success) return actionFailureFromZod(parsed.error);

  try {
    const reserva = await definirPagamento(
      parsed.data.reservaId,
      parsed.data.statusPagamento,
      user.id,
    );
    revalidar(reserva.rifaId);
    return success(
      parsed.data.statusPagamento === "PAGO"
        ? "Pagamento confirmado e indicadores atualizados."
        : "Pagamento marcado como pendente.",
    );
  } catch (error) {
    return fail(publicErrorMessage(error));
  }
}

export async function liberarReservaAction(input: unknown): Promise<ActionResult> {
  const user = await requireSession();
  const parsed = liberacaoSchema.safeParse(input);
  if (!parsed.success) return actionFailureFromZod(parsed.error);

  try {
    const resultado = await liberarReserva(parsed.data.reservaId, user.id);
    revalidar(resultado.rifaId);
    return success(`Número(s) ${resultado.numeros.join(", ")} liberado(s).`);
  } catch (error) {
    return fail(publicErrorMessage(error));
  }
}
