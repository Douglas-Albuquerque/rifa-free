import type { ZodError } from "zod";

import type { ActionResult } from "@/lib/errors";

export function actionFailureFromZod(error: ZodError, message = "Verifique os campos informados."): ActionResult {
  const flat = error.flatten();
  const fieldErrors: Record<string, string[]> = {};
  const entries = Object.entries(flat.fieldErrors) as [string, string[] | undefined][];
  for (const [field, errors] of entries) {
    if (errors && errors.length > 0) fieldErrors[field] = errors;
  }

  return {
    ok: false,
    code: "VALIDATION_ERROR",
    message: error.issues[0]?.message ?? message,
    fieldErrors,
  };
}

export function formString(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}
