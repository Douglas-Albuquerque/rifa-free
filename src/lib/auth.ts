import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
  type SessionPayload,
} from "@/lib/session-token";

export type SessionUser = {
  id: string;
  nome: string;
  email: string;
};

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySession(token);
  if (!payload) return null;

  const user = await prisma.adminUser.findUnique({
    where: { id: payload.sub },
    select: { id: true, nome: true, email: true },
  });

  return user;
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

async function usarCookieSeguro() {
  const override = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (override) return override === "true";

  const headerStore = await headers();
  const proto = headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (proto) return proto === "https";

  return headerStore.get("origin")?.startsWith("https://") ?? false;
}

export async function createSession(payload: SessionPayload) {
  const token = await signSession(payload);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: await usarCookieSeguro(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}
