"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth";
import { fail, publicErrorMessage, success, type ActionResult } from "@/lib/errors";
import { sorteioSchema } from "@/lib/validation";
import { realizarSorteio } from "@/server/services/sorteio-service";

import { actionFailureFromZod } from "./helpers";

export type SorteioActionResult = ActionResult & {
  numeroVencedor?: number;
  participante?: string;
};

export async function realizarSorteioAction(input: unknown): Promise<SorteioActionResult> {
  const user = await requireSession();
  const parsed = sorteioSchema.safeParse(input);
  if (!parsed.success) return actionFailureFromZod(parsed.error);

  try {
    const sorteio = await realizarSorteio(parsed.data.rifaId, user.id);
    revalidatePath("/");
    revalidatePath("/rifas");
    revalidatePath("/historico");
    revalidatePath(`/rifas/${parsed.data.rifaId}`);
    revalidatePath(`/rifas/${parsed.data.rifaId}/participantes`);
    revalidatePath(`/rifas/${parsed.data.rifaId}/pagamentos`);
    revalidatePath(`/rifas/${parsed.data.rifaId}/sorteio`);
    revalidatePath(`/rifas/${parsed.data.rifaId}/auditoria`);

    return {
      ...success("Sorteio realizado com sucesso."),
      numeroVencedor: sorteio.numeroVencedor,
      participante: sorteio.participante.nome,
    };
  } catch (error) {
    return fail(publicErrorMessage(error));
  }
}
