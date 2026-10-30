import { z } from "zod";

import { parseDateTimeLocal, parseMoneyToCents } from "@/lib/format";

const dateTimeField = (requiredMessage: string) =>
  z
    .string({ error: requiredMessage })
    .trim()
    .min(1, requiredMessage)
    .transform((value, ctx) => {
      const date = parseDateTimeLocal(value);
      if (!date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe uma data e horário válidos." });
        return z.NEVER;
      }
      return date;
    });

const optionalDateTimeField = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const date = parseDateTimeLocal(value);
    if (!date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe uma data válida." });
      return z.NEVER;
    }
    return date;
  });

const moneyField = z
  .string({ error: "Informe o valor do número." })
  .trim()
  .min(1, "Informe o valor do número.")
  .transform((value, ctx) => {
    const cents = parseMoneyToCents(value);
    if (cents === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe um valor maior que zero." });
      return z.NEVER;
    }
    if (cents > 100_000_000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "O valor máximo é R$ 1.000.000,00." });
      return z.NEVER;
    }
    return cents;
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  senha: z.string().min(1, "Informe a senha."),
  next: z.string().optional(),
});

export const rifaSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(3, "O título deve ter pelo menos 3 caracteres.")
    .max(120, "O título deve ter no máximo 120 caracteres."),
  descricao: z
    .string()
    .trim()
    .min(3, "Descreva o prêmio ou a rifa.")
    .max(2000, "A descrição deve ter no máximo 2000 caracteres."),
  quantidadeNumeros: z.coerce
    .number({ error: "Informe a quantidade de números." })
    .int("A quantidade deve ser um número inteiro.")
    .min(1, "A rifa precisa ter pelo menos 1 número.")
    .max(500, "O limite máximo é de 500 números por rifa."),
  valorNumero: moneyField,
  dataInicio: optionalDateTimeField,
  dataSorteio: dateTimeField("Informe a data e o horário do sorteio."),
  status: z.enum(["RASCUNHO", "ABERTA", "ENCERRADA"], {
    error: "Status inválido.",
  }),
});

export const rifaStatusSchema = z.object({
  rifaId: z.string().min(1),
  status: z.enum(["RASCUNHO", "ABERTA", "ENCERRADA"], {
    error: "Status inválido.",
  }),
});

export const reservaSchema = z
  .object({
    rifaId: z.string().min(1, "Rifa inválida."),
    nome: z
      .string()
      .trim()
      .min(3, "Informe o nome completo do participante.")
      .max(160, "O nome deve ter no máximo 160 caracteres."),
    telefone: z
      .string()
      .trim()
      .max(30, "O telefone deve ter no máximo 30 caracteres.")
      .optional()
      .transform((value) => (value ? value : null)),
    numeros: z
      .array(z.coerce.number().int().positive())
      .min(1, "Selecione pelo menos um número.")
      .max(500, "Selecione no máximo 500 números.")
      .refine((numeros) => new Set(numeros).size === numeros.length, "Há números repetidos na seleção."),
    statusPagamento: z.enum(["PENDENTE", "PAGO"], {
      error: "Situação de pagamento inválida.",
    }),
    observacoes: z
      .string()
      .trim()
      .max(1000, "As observações devem ter no máximo 1000 caracteres.")
      .optional()
      .transform((value) => (value ? value : null)),
  })
  .refine((data) => data.numeros.length > 0, "Selecione pelo menos um número.");

export const reservaAtualizacaoSchema = z.object({
  reservaId: z.string().min(1),
  nome: z
    .string()
    .trim()
    .min(3, "Informe o nome completo do participante.")
    .max(160, "O nome deve ter no máximo 160 caracteres."),
  telefone: z
    .string()
    .trim()
    .max(30, "O telefone deve ter no máximo 30 caracteres.")
    .optional()
    .transform((value) => (value ? value : null)),
  observacoes: z
    .string()
    .trim()
    .max(1000, "As observações devem ter no máximo 1000 caracteres.")
    .optional()
    .transform((value) => (value ? value : null)),
});

export const pagamentoSchema = z.object({
  reservaId: z.string().min(1),
  statusPagamento: z.enum(["PENDENTE", "PAGO"]),
});

export const liberacaoSchema = z.object({
  reservaId: z.string().min(1),
  confirmacao: z.literal(true, {
    error: "Confirme a liberação dos números.",
  }),
});

export const sorteioSchema = z.object({
  rifaId: z.string().min(1),
  confirmacao: z.literal(true, {
    error: "Confirme a realização do sorteio.",
  }),
});

export const buscaSchema = z.object({
  rifaId: z.string().optional(),
  nome: z.string().trim().optional(),
  pagamento: z.enum(["PENDENTE", "PAGO"]).optional(),
  estado: z.enum(["TODOS", "RESERVADO", "PAGO", "PENDENTE"]).optional(),
});

export type RifaInput = z.infer<typeof rifaSchema>;
export type ReservaInput = z.infer<typeof reservaSchema>;
