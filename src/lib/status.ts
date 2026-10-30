import type { PagamentoStatus, RifaStatus } from "@prisma/client";

export const RIFA_STATUS_LABEL: Record<RifaStatus, string> = {
  RASCUNHO: "Rascunho",
  ABERTA: "Aberta",
  ENCERRADA: "Encerrada",
  SORTEADA: "Sorteada",
};

export const RIFA_STATUS_STYLE: Record<RifaStatus, string> = {
  RASCUNHO: "bg-ink-100 text-ink-700 ring-ink-200",
  ABERTA: "bg-brand-50 text-brand-800 ring-brand-200",
  ENCERRADA: "bg-amber-50 text-amber-800 ring-amber-200",
  SORTEADA: "bg-violet-50 text-violet-800 ring-violet-200",
};

export const PAGAMENTO_LABEL: Record<PagamentoStatus, string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
};

export const PAGAMENTO_STYLE: Record<PagamentoStatus, string> = {
  PENDENTE: "bg-amber-50 text-amber-800 ring-amber-200",
  PAGO: "bg-brand-50 text-brand-800 ring-brand-200",
};

export const AUDITORIA_LABEL: Record<string, string> = {
  RIFA_CRIADA: "Rifa criada",
  RIFA_ATUALIZADA: "Rifa atualizada",
  RIFA_STATUS_ALTERADO: "Status da rifa alterado",
  RESERVA_CRIADA: "Reserva criada",
  RESERVA_ATUALIZADA: "Reserva atualizada",
  PAGAMENTO_ALTERADO: "Pagamento alterado",
  RESERVA_LIBERADA: "Números liberados",
  SORTEIO_REALIZADO: "Sorteio realizado",
  LOGIN_REALIZADO: "Login realizado",
};
