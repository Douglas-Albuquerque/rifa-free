"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSession, destroySession } from "@/lib/auth";
import { fail, type ActionResult } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

import { actionFailureFromZod, formString } from "./helpers";

// Hash ficticio apenas para igualar o tempo de resposta quando o e-mail nao existe.
// Nao e uma credencial real e nunca corresponde a uma senha valida.
// nosemgrep: generic.secrets.security.detected-bcrypt-hash.detected-bcrypt-hash
const DUMMY_HASH = "$2b$10$Pc9umsZDOGYaWpW0HoccQ.XjslvjcJRDodP5B2.5TYJlOlB.rYYCi";

function safeNext(next: string | undefined) {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  if (next.startsWith("/login")) return "/";
  return next;
}

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formString(formData, "email"),
    senha: formString(formData, "senha"),
    next: formString(formData, "next") || undefined,
  });

  if (!parsed.success) return actionFailureFromZod(parsed.error);

  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    "desconhecido";
  const rateKey = `${ip}:${parsed.data.email.toLowerCase()}`;
  const rate = checkRateLimit(rateKey);

  if (!rate.allowed) {
    return fail(
      `Muitas tentativas. Aguarde ${Math.ceil((rate.retryAfterSeconds ?? 0) / 60)} minuto(s) para tentar novamente.`,
      "RATE_LIMIT",
    );
  }

  const user = await prisma.adminUser.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  const senhaValida = await bcrypt.compare(parsed.data.senha, user?.senhaHash ?? DUMMY_HASH);

  if (!user || !senhaValida) {
    return fail("E-mail ou senha inválidos.", "AUTH_INVALID");
  }

  clearRateLimit(rateKey);
  await createSession({ sub: user.id, nome: user.nome, email: user.email });
  redirect(safeNext(parsed.data.next));
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
