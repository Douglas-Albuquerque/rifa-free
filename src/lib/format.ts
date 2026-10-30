export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Sao_Paulo";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: APP_TIMEZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: APP_TIMEZONE,
});

export function formatCurrency(cents: number) {
  return currencyFormatter.format((cents || 0) / 100);
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  return dateFormatter.format(new Date(date));
}

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  return dateTimeFormatter.format(new Date(date)).replace(",", " às");
}

export function formatNumber(numero: number) {
  return String(numero).padStart(3, "0");
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function formatPhone(telefone: string | null | undefined) {
  if (!telefone) return "Sem telefone";
  const digits = telefone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return telefone;
}

export function sanitizePhone(telefone: string) {
  return telefone.replace(/[^\d\s()+-]/g, "").trim();
}

export function parseDateTimeLocal(value: string): Date | null {
  if (!value) return null;
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${withSeconds}-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDateTimeLocalValue(date: Date | string | null | undefined) {
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: APP_TIMEZONE,
  }).formatToParts(new Date(date));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

export function parseMoneyToCents(value: string): number | null {
  if (!value) return null;
  const normalized = value
    .replace(/\s/g, "")
    .replace(/^R\$/i, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}
