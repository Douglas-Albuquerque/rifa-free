import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "rifas_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type SessionPayload = {
  sub: string;
  nome: string;
  email: string;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET ausente ou com menos de 32 caracteres.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ nome: payload.nome, email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.nome !== "string" || typeof payload.email !== "string") {
      return null;
    }
    return { sub: payload.sub, nome: payload.nome, email: payload.email };
  } catch {
    return null;
  }
}
