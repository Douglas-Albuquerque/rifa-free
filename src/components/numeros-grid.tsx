"use client";

import type { PagamentoStatus, RifaStatus } from "@prisma/client";
import {
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Phone,
  Ticket,
  Trash2,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import type { ActionResult } from "@/lib/errors";
import { cn } from "@/lib/cn";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatPhone,
} from "@/lib/format";
import {
  atualizarReservaAction,
  criarReservaAction,
  definirPagamentoAction,
  liberarReservaAction,
} from "@/server/actions/reserva-actions";

import { Modal } from "./modal";
import { Alert, PagamentoBadge } from "./ui";
import { toast } from "./toast";

export type ReservaDetalhe = {
  id: string;
  participanteId: string;
  participanteNome: string;
  telefone: string | null;
  statusPagamento: PagamentoStatus;
  valorCobrado: number;
  pagoEm: string | null;
  observacoes: string | null;
  numeros: number[];
  createdAt: string;
};

type RifaGrid = {
  id: string;
  titulo: string;
  quantidadeNumeros: number;
  valorNumero: number;
  status: RifaStatus;
};

const LEGENDA = [
  { key: "livre", label: "Disponível", className: "border-ink-300 bg-white" },
  { key: "selecionado", label: "Selecionado", className: "border-brand-700 bg-brand-700" },
  { key: "pendente", label: "Pendente", className: "border-amber-300 bg-amber-100" },
  { key: "pago", label: "Pago", className: "border-brand-400 bg-brand-100" },
  { key: "sorteado", label: "Sorteado", className: "border-amber-500 bg-amber-200" },
];

export function NumerosGrid({
  rifa,
  reservas,
  numeroSorteado,
}: {
  rifa: RifaGrid;
  reservas: ReservaDetalhe[];
  numeroSorteado?: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [modalReservar, setModalReservar] = useState(false);
  const [detalhe, setDetalhe] = useState<ReservaDetalhe | null>(null);
  const [modo, setModo] = useState<"detalhe" | "editar" | "liberar">("detalhe");
  const [erro, setErro] = useState<string | null>(null);
  const [ocultarReservados, setOcultarReservados] = useState(false);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [pagamento, setPagamento] = useState<PagamentoStatus>("PENDENTE");

  const [editNome, setEditNome] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editObservacoes, setEditObservacoes] = useState("");

  const canReserve = rifa.status === "RASCUNHO" || rifa.status === "ABERTA";
  const isSorteada = rifa.status === "SORTEADA";

  const porNumero = useMemo(() => {
    const mapa = new Map<number, ReservaDetalhe>();
    for (const reserva of reservas) {
      for (const numero of reserva.numeros) mapa.set(numero, reserva);
    }
    return mapa;
  }, [reservas]);

  const totalSelecionado = selecionados.length * rifa.valorNumero;
  const numerosDisponiveis = Math.max(0, rifa.quantidadeNumeros - porNumero.size);
  const todosNumeros = Array.from({ length: rifa.quantidadeNumeros }, (_, index) => index + 1);
  const numerosVisiveis = ocultarReservados
    ? todosNumeros.filter((numero) => !porNumero.has(numero))
    : todosNumeros;

  function toggleNumero(numero: number) {
    setErro(null);
    if (!canReserve) {
      toast(
        isSorteada
          ? "Rifa já sorteada: não é possível fazer novas reservas."
          : "Esta rifa está encerrada para novas reservas.",
        "info",
      );
      return;
    }
    setSelecionados((atual) =>
      atual.includes(numero) ? atual.filter((item) => item !== numero) : [...atual, numero].sort((a, b) => a - b),
    );
  }

  function abrirReserva() {
    if (selecionados.length === 0) return;
    setErro(null);
    setNome("");
    setTelefone("");
    setObservacoes("");
    setPagamento("PENDENTE");
    setModalReservar(true);
  }

  function abrirDetalhe(reserva: ReservaDetalhe) {
    setDetalhe(reserva);
    setModo("detalhe");
    setErro(null);
    setEditNome(reserva.participanteNome);
    setEditTelefone(reserva.telefone ?? "");
    setEditObservacoes(reserva.observacoes ?? "");
  }

  function fecharTudo() {
    setModalReservar(false);
    setDetalhe(null);
    setErro(null);
  }

  function aplicarResultado(resultado: ActionResult, onSuccess?: () => void) {
    if (!resultado.ok) {
      setErro(resultado.message);
      if (resultado.code === "NUMERO_OCUPADO") {
        setSelecionados([]);
        router.refresh();
      }
      return false;
    }
    toast(resultado.message);
    onSuccess?.();
    router.refresh();
    return true;
  }

  function confirmarReserva(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    startTransition(async () => {
      const resultado = await criarReservaAction({
        rifaId: rifa.id,
        nome,
        telefone,
        numeros: selecionados,
        statusPagamento: pagamento,
        observacoes,
      });
      aplicarResultado(resultado, () => {
        setSelecionados([]);
        setModalReservar(false);
      });
    });
  }

  function salvarEdicao(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detalhe) return;
    setErro(null);
    startTransition(async () => {
      const resultado = await atualizarReservaAction(detalhe.id, {
        nome: editNome,
        telefone: editTelefone,
        observacoes: editObservacoes,
      });
      aplicarResultado(resultado, () => setDetalhe(null));
    });
  }

  function alterarPagamento(status: PagamentoStatus) {
    if (!detalhe) return;
    setErro(null);
    startTransition(async () => {
      const resultado = await definirPagamentoAction({
        reservaId: detalhe.id,
        statusPagamento: status,
      });
      aplicarResultado(resultado, () => setDetalhe(null));
    });
  }

  function confirmarLiberacao() {
    if (!detalhe) return;
    setErro(null);
    startTransition(async () => {
      const resultado = await liberarReservaAction({ reservaId: detalhe.id, confirmacao: true });
      aplicarResultado(resultado, () => setDetalhe(null));
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-ink-100 bg-white/70 px-3.5 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Legenda</span>
        {LEGENDA.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1.5 text-[11px] text-ink-600">
            <span className={cn("h-3.5 w-3.5 rounded border", item.className)} aria-hidden />
            {item.label}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-ink-500">
          <Lock className="h-3 w-3" aria-hidden />
          Toque em um número para reservar ou ver detalhes
        </span>
      </div>

      {erro && !modalReservar && !detalhe ? (
        <div className="mb-4">
          <Alert type="error">{erro}</Alert>
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-500">
          <strong className="text-ink-900">{numerosDisponiveis}</strong> disponível(is) de{" "}
          <strong className="text-ink-900">{rifa.quantidadeNumeros}</strong>
        </p>
        <button
          type="button"
          onClick={() => setOcultarReservados((atual) => !atual)}
          aria-pressed={ocultarReservados}
          className={cn("btn-secondary btn-sm", ocultarReservados && "border-brand-400 bg-brand-50 text-brand-900")}
        >
          {ocultarReservados ? <Eye className="h-3.5 w-3.5" aria-hidden /> : <EyeOff className="h-3.5 w-3.5" aria-hidden />}
          {ocultarReservados ? "Mostrar todos" : "Só disponíveis"}
        </button>
      </div>

      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-1.5 sm:gap-2"
        role="group"
        aria-label={`Grade de números da rifa ${rifa.titulo}`}
      >
        {numerosVisiveis.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-ink-300 bg-white/70 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-ink-800">Todos os números estão reservados.</p>
            <p className="mt-1 text-xs text-ink-500">Use “Mostrar todos” para visualizar a grade completa.</p>
          </div>
        ) : null}
        {numerosVisiveis.map((numero) => {
          const reserva = porNumero.get(numero);
          const selecionado = selecionados.includes(numero);
          const sorteado = numero === numeroSorteado;
          const status = sorteado ? "sorteado" : selecionado ? "selecionado" : reserva ? reserva.statusPagamento.toLowerCase() : "livre";

          return (
            <button
              key={numero}
              type="button"
              onClick={() => (reserva ? abrirDetalhe(reserva) : toggleNumero(numero))}
              aria-label={`Número ${formatNumber(numero)}${
                sorteado
                  ? ", número sorteado"
                  : reserva
                    ? `, ${reserva.statusPagamento === "PAGO" ? "pago" : "pendente"}, participante ${reserva.participanteNome}`
                    : ", disponível"
              }`}
              aria-pressed={reserva ? undefined : selecionado}
              className={cn(
                "group relative flex min-h-[58px] flex-col items-center justify-center rounded-xl border px-1 py-1.5 transition focus-visible:z-10",
                status === "livre" && "border-ink-200 bg-white text-ink-800 hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-sm",
                status === "selecionado" && "border-brand-700 bg-brand-700 text-white shadow-sm",
                status === "pendente" && "border-amber-300 bg-amber-100 text-amber-950 hover:border-amber-500",
                status === "pago" && "border-brand-400 bg-brand-100 text-brand-950 hover:border-brand-600",
                status === "sorteado" && "border-amber-500 bg-amber-200 text-amber-950 shadow-[0_0_0_2px_rgba(245,158,11,.25)] hover:border-amber-600",
              )}
            >
              <span className="text-[13px] font-bold leading-none tabular-nums sm:text-sm">{formatNumber(numero)}</span>
              <span className="mt-1 flex items-center gap-0.5 text-[8px] font-semibold uppercase leading-none tracking-wide opacity-80">
                {status === "sorteado" ? <Trophy className="h-2.5 w-2.5" aria-hidden /> : null}
                {status === "pago" ? <Check className="h-2.5 w-2.5" aria-hidden /> : null}
                {status === "pendente" ? <Clock3 className="h-2.5 w-2.5" aria-hidden /> : null}
                {status === "selecionado" ? <Check className="h-2.5 w-2.5" aria-hidden /> : null}
                {status === "livre" ? "Livre" : status === "selecionado" ? "Escolhido" : status === "pago" ? "Pago" : status === "pendente" ? "Pendente" : "Sorteado"}
              </span>
              {sorteado ? <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-amber-500 text-white shadow"><Trophy className="h-2.5 w-2.5" /></span> : null}
            </button>
          );
        })}
      </div>

      {selecionados.length > 0 ? (
        <div className="fixed inset-x-3 bottom-[74px] z-50 mx-auto max-w-xl animate-rise rounded-2xl border border-ink-800 bg-ink-950 p-3 text-white shadow-lift md:bottom-6 md:left-auto md:right-8 md:mx-0 md:w-[420px]">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/20 text-brand-300">
              <Ticket className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {selecionados.length} número(s) · {formatCurrency(totalSelecionado)}
              </p>
              <p className="truncate text-[11px] text-ink-300">
                {selecionados.map(formatNumber).join(", ")}
              </p>
            </div>
            <button type="button" onClick={() => setSelecionados([])} className="rounded-lg p-2 text-ink-300 hover:bg-white/10 hover:text-white" aria-label="Limpar seleção">
              <X className="h-4 w-4" />
            </button>
            <button type="button" onClick={abrirReserva} className="btn bg-brand-500 text-ink-950 hover:bg-brand-400">
              Reservar
            </button>
          </div>
        </div>
      ) : null}

      <Modal
        open={modalReservar}
        onClose={() => setModalReservar(false)}
        title="Nova reserva"
        description="Preencha os dados do participante. Os números são validados novamente no servidor."
        size="md"
      >
        <form onSubmit={confirmarReserva} className="space-y-4">
          {erro ? <Alert type="error">{erro}</Alert> : null}

          <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-3.5">
            <p className="text-xs font-semibold text-brand-900">
              {selecionados.length} número(s) selecionado(s)
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selecionados.map((numero) => (
                <button
                  key={numero}
                  type="button"
                  onClick={() => setSelecionados((atual) => atual.filter((item) => item !== numero))}
                  className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-brand-900 ring-1 ring-brand-200 hover:bg-red-50 hover:text-red-700 hover:ring-red-200"
                  aria-label={`Remover número ${formatNumber(numero)}`}
                >
                  {formatNumber(numero)}
                  <X className="h-3 w-3" aria-hidden />
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-brand-200 pt-2.5 text-sm">
              <span className="text-brand-800">Valor total</span>
              <span className="font-bold text-brand-950">{formatCurrency(totalSelecionado)}</span>
            </div>
          </div>

          <div>
            <label htmlFor="reserva-nome" className="label">
              Nome completo <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
              <input
                id="reserva-nome"
                className="input pl-9"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                required
                minLength={3}
                maxLength={160}
                autoComplete="name"
                placeholder="Nome do participante"
                data-autofocus
              />
            </div>
          </div>

          <div>
            <label htmlFor="reserva-telefone" className="label">
              Telefone ou WhatsApp <span className="font-normal text-ink-400">(opcional)</span>
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
              <input
                id="reserva-telefone"
                className="input pl-9"
                value={telefone}
                onChange={(event) => setTelefone(event.target.value)}
                maxLength={30}
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <fieldset>
            <legend className="label">Situação do pagamento</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["PENDENTE", "PAGO"] as const).map((status) => (
                <label
                  key={status}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                    pagamento === status
                      ? status === "PAGO"
                        ? "border-brand-500 bg-brand-50 text-brand-900 ring-1 ring-brand-500"
                        : "border-amber-400 bg-amber-50 text-amber-900 ring-1 ring-amber-400"
                      : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50",
                  )}
                >
                  <input
                    type="radio"
                    name="pagamento"
                    value={status}
                    checked={pagamento === status}
                    onChange={() => setPagamento(status)}
                    className="h-4 w-4 accent-brand-700"
                  />
                  {status === "PAGO" ? "Pago" : "Pendente"}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="reserva-observacoes" className="label">
              Observações <span className="font-normal text-ink-400">(opcional)</span>
            </label>
            <textarea
              id="reserva-observacoes"
              className="textarea min-h-20"
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
              maxLength={1000}
              placeholder="Informações adicionais sobre a reserva"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-ink-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={() => setModalReservar(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isPending || selecionados.length === 0}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {isPending ? "Confirmando..." : "Confirmar reserva"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(detalhe)}
        onClose={fecharTudo}
        title={
          modo === "editar"
            ? "Editar reserva"
            : modo === "liberar"
              ? "Liberar números"
              : detalhe
                ? `Reserva de ${detalhe.participanteNome}`
                : "Reserva"
        }
        description={
          modo === "liberar"
            ? "Os números voltarão a ficar disponíveis para outras pessoas."
            : detalhe
              ? `${detalhe.numeros.length} número(s) · ${formatCurrency(detalhe.valorCobrado)}`
              : undefined
        }
        size="md"
      >
        {detalhe ? (
          <>
            {erro ? (
              <div className="mb-4">
                <Alert type="error">{erro}</Alert>
              </div>
            ) : null}

            {modo === "detalhe" ? (
              <div className="space-y-4">
                {detalhe.numeros.includes(numeroSorteado ?? -1) ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-amber-950">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-amber-400 text-white">
                      <Trophy className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-bold">Número vencedor do sorteio</p>
                      <p className="text-xs">Este participante ganhou a rifa.</p>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="card-muted p-3">
                    <p className="text-[11px] uppercase tracking-wide text-ink-500">Participante</p>
                    <p className="mt-1 font-semibold text-ink-900">{detalhe.participanteNome}</p>
                  </div>
                  <div className="card-muted p-3">
                    <p className="text-[11px] uppercase tracking-wide text-ink-500">Telefone</p>
                    <p className="mt-1 font-semibold text-ink-900">{formatPhone(detalhe.telefone)}</p>
                  </div>
                  <div className="card-muted p-3">
                    <p className="text-[11px] uppercase tracking-wide text-ink-500">Pagamento</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <PagamentoBadge status={detalhe.statusPagamento} />
                      {detalhe.pagoEm ? <span className="text-[10px] text-ink-400">{formatDateTime(detalhe.pagoEm)}</span> : null}
                    </div>
                  </div>
                  <div className="card-muted p-3">
                    <p className="text-[11px] uppercase tracking-wide text-ink-500">Reservado em</p>
                    <p className="mt-1 font-semibold text-ink-900">{formatDateTime(detalhe.createdAt)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-ink-100 p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-wide text-ink-500">Números</p>
                    <p className="text-sm font-bold text-ink-950">{formatCurrency(detalhe.valorCobrado)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {detalhe.numeros.map((numero) => (
                      <span key={numero} className="rounded-lg bg-ink-950 px-2 py-1 text-xs font-bold text-white">
                        {formatNumber(numero)}
                      </span>
                    ))}
                  </div>
                </div>

                {detalhe.observacoes ? (
                  <div className="rounded-2xl bg-amber-50 p-3.5 text-sm text-amber-950 ring-1 ring-amber-200">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Observações</p>
                    <p className="mt-1 whitespace-pre-wrap">{detalhe.observacoes}</p>
                  </div>
                ) : null}

                {isSorteada ? (
                  <div className="flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    Rifa sorteada: os dados do vencedor e os números estão protegidos. Apenas o pagamento pode ser corrigido.
                  </div>
                ) : null}

                <div className="space-y-2 border-t border-ink-100 pt-4">
                  {detalhe.statusPagamento === "PENDENTE" ? (
                    <button
                      type="button"
                      onClick={() => alterarPagamento("PAGO")}
                      disabled={isPending}
                      className="btn-primary w-full"
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                      Marcar como pago
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => alterarPagamento("PENDENTE")}
                      disabled={isPending}
                      className="btn-secondary w-full"
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Clock3 className="h-4 w-4" aria-hidden />}
                      Voltar para pendente
                    </button>
                  )}

                  {!isSorteada ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setModo("editar")} className="btn-secondary">
                          Editar dados
                        </button>
                        <button type="button" onClick={() => setModo("liberar")} className="btn-secondary text-red-700 hover:bg-red-50">
                          Liberar números
                        </button>
                      </div>
                      <p className="text-center text-[11px] text-ink-400">
                        O número permanece ocupado enquanto o pagamento estiver pendente.
                      </p>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            {modo === "editar" ? (
              <form onSubmit={salvarEdicao} className="space-y-4">
                <div>
                  <label htmlFor="edit-nome" className="label">
                    Nome completo <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="edit-nome"
                    className="input"
                    value={editNome}
                    onChange={(event) => setEditNome(event.target.value)}
                    required
                    minLength={3}
                    maxLength={160}
                    data-autofocus
                  />
                </div>
                <div>
                  <label htmlFor="edit-telefone" className="label">
                    Telefone ou WhatsApp
                  </label>
                  <input
                    id="edit-telefone"
                    className="input"
                    value={editTelefone}
                    onChange={(event) => setEditTelefone(event.target.value)}
                    maxLength={30}
                    inputMode="tel"
                  />
                </div>
                <div>
                  <label htmlFor="edit-observacoes" className="label">
                    Observações
                  </label>
                  <textarea
                    id="edit-observacoes"
                    className="textarea min-h-20"
                    value={editObservacoes}
                    onChange={(event) => setEditObservacoes(event.target.value)}
                    maxLength={1000}
                  />
                </div>
                <p className="text-xs text-ink-500">
                  Os números desta reserva não podem ser alterados aqui. Para trocar números, libere esta reserva e crie outra.
                </p>
                <div className="flex flex-col-reverse gap-2 border-t border-ink-100 pt-4 sm:flex-row sm:justify-end">
                  <button type="button" className="btn-secondary" onClick={() => setModo("detalhe")}>
                    Voltar
                  </button>
                  <button type="submit" className="btn-primary" disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    Salvar alterações
                  </button>
                </div>
              </form>
            ) : null}

            {modo === "liberar" ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                  <Trash2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                  <div>
                    <p className="font-semibold">Esta ação não pode ser desfeita.</p>
                    <p className="mt-1 text-xs leading-relaxed">
                      A reserva de <strong>{detalhe.participanteNome}</strong> será removida e os números{" "}
                      <strong>{detalhe.numeros.map(formatNumber).join(", ")}</strong> ficarão disponíveis novamente. A
                      operação ficará registrada na auditoria.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" className="btn-secondary" onClick={() => setModo("detalhe")}>
                    Cancelar
                  </button>
                  <button type="button" className="btn-danger" onClick={confirmarLiberacao} disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
                    Sim, liberar números
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </Modal>
    </div>
  );
}
