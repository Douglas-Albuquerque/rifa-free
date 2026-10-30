import { Prisma } from "@prisma/client";

export class AppError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export type ActionResult = {
  ok: boolean;
  message: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
};

export function fail(message: string, code = "VALIDATION_ERROR", fieldErrors?: Record<string, string[]>): ActionResult {
  return { ok: false, message, code, fieldErrors };
}

export function success(message: string): ActionResult {
  return { ok: true, message };
}

export function isUniqueConstraintError(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002")
  );
}

export function isSerializationError(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2034")
  );
}

export function publicErrorMessage(error: unknown) {
  if (error instanceof AppError) return error.message;
  if (isUniqueConstraintError(error)) return "Este registro já existe. Atualize a página e tente novamente.";
  console.error("[rifas] erro inesperado", error);
  return "Não foi possível concluir a operação. Tente novamente.";
}
