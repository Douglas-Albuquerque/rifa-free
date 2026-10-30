"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth";
import { fail, publicErrorMessage, success, type ActionResult } from "@/lib/errors";
import { rifaSchema, rifaStatusSchema } from "@/lib/validation";
import { alterarStatusRifa, atualizarRifa, criarRifa } from "@/server/services/rifa-service";

import { actionFailureFromZod, formString } from "./helpers";

function revalidarRifa(rifaId?: string) {
  revalidatePath("/");
  revalidatePath("/rifas");
  revalidatePath("/pesquisa");
  revalidatePath("/historico");
  if (rifaId) {
    revalidatePath(`/rifas/${rifaId}`);
    revalidatePath(`/rifas/${rifaId}/participantes`);
    revalidatePath(`/rifas/${rifaId}/pagamentos`);
    revalidatePath(`/rifas/${rifaId}/sorteio`);
    revalidatePath(`/rifas/${rifaId}/auditoria`);
  }
}

function parseRifaForm(formData: FormData) {
  return rifaSchema.safeParse({
    titulo: formString(formData, "titulo"),
    descricao: formString(formData, "descricao"),
    quantidadeNumeros: formString(formData, "quantidadeNumeros"),
    valorNumero: formString(formData, "valorNumero"),
    dataInicio: formString(formData, "dataInicio"),
    dataSorteio: formString(formData, "dataSorteio"),
    status: formString(formData, "status"),
  });
}

export async function criarRifaAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireSession();
  const parsed = parseRifaForm(formData);
  if (!parsed.success) return actionFailureFromZod(parsed.error);

  let rifaId: string;
  try {
    const rifa = await criarRifa(parsed.data, user.id);
    rifaId = rifa.id;
  } catch (error) {
    return fail(publicErrorMessage(error));
  }

  revalidarRifa(rifaId);
  redirect(`/rifas/${rifaId}`);
}

export async function atualizarRifaAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireSession();
  const rifaId = formString(formData, "rifaId");
  if (!rifaId) return fail("Rifa inválida.");

  const parsed = parseRifaForm(formData);
  if (!parsed.success) return actionFailureFromZod(parsed.error);

  try {
    await atualizarRifa(rifaId, parsed.data, user.id);
  } catch (error) {
    return fail(publicErrorMessage(error));
  }

  revalidarRifa(rifaId);
  redirect(`/rifas/${rifaId}`);
}

export async function alterarStatusRifaAction(input: unknown): Promise<ActionResult> {
  const user = await requireSession();
  const parsed = rifaStatusSchema.safeParse(input);
  if (!parsed.success) return actionFailureFromZod(parsed.error);

  try {
    await alterarStatusRifa(parsed.data.rifaId, parsed.data.status, user.id);
    revalidarRifa(parsed.data.rifaId);
    return success("Status da rifa atualizado.");
  } catch (error) {
    return fail(publicErrorMessage(error));
  }
}
