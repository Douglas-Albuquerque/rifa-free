"use client";

import { Info, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { centsToInput, formatCurrency, parseMoneyToCents, toDateTimeLocalValue } from "@/lib/format";
import { criarRifaAction, atualizarRifaAction } from "@/server/actions/rifa-actions";

import { Alert } from "./ui";
import { SubmitButton } from "./submit-button";

type RifaFormData = {
  id?: string;
  titulo: string;
  descricao: string;
  quantidadeNumeros: number;
  valorNumero: number;
  dataInicio: Date | null;
  dataSorteio: Date;
  status: "RASCUNHO" | "ABERTA" | "ENCERRADA" | "SORTEADA";
};

export function RifaForm({ rifa }: { rifa?: RifaFormData }) {
  const editando = Boolean(rifa);
  const [state, formAction] = useActionState(editando ? atualizarRifaAction : criarRifaAction, null);

  const [titulo, setTitulo] = useState(rifa?.titulo ?? "");
  const [descricao, setDescricao] = useState(rifa?.descricao ?? "");
  const [quantidade, setQuantidade] = useState(String(rifa?.quantidadeNumeros ?? 100));
  const [valor, setValor] = useState(rifa ? centsToInput(rifa.valorNumero) : "5,00");
  const [dataInicio, setDataInicio] = useState(toDateTimeLocalValue(rifa?.dataInicio));
  const [dataSorteio, setDataSorteio] = useState(toDateTimeLocalValue(rifa?.dataSorteio));
  const [status, setStatus] = useState<"RASCUNHO" | "ABERTA" | "ENCERRADA">(
    rifa?.status === "SORTEADA" || !rifa ? "ABERTA" : rifa.status,
  );

  const quantidadeNumeros = Math.min(500, Math.max(0, Number(quantidade) || 0));
  const valorCentavos = parseMoneyToCents(valor) ?? 0;
  const potencial = useMemo(
    () => quantidadeNumeros * valorCentavos,
    [quantidadeNumeros, valorCentavos],
  );

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-[1fr_320px]" noValidate>
      {rifa?.id ? <input type="hidden" name="rifaId" value={rifa.id} /> : null}

      <div className="card p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-700" aria-hidden />
          <h2 className="section-title">Dados da rifa</h2>
        </div>

        {state && !state.ok ? (
          <div className="mb-5">
            <Alert type="error">{state.message}</Alert>
          </div>
        ) : null}

        <div className="space-y-4">
          <div>
            <label htmlFor="titulo" className="label">
              Título da rifa <span className="text-red-600">*</span>
            </label>
            <input
              id="titulo"
              name="titulo"
              className="input"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              maxLength={120}
              required
              placeholder="Ex.: Rifa solidária do Colégio"
              aria-invalid={Boolean(state?.fieldErrors?.titulo)}
            />
            {state?.fieldErrors?.titulo ? <p className="mt-1 text-xs text-red-700">{state.fieldErrors.titulo[0]}</p> : null}
          </div>

          <div>
            <label htmlFor="descricao" className="label">
              Descrição ou prêmio <span className="text-red-600">*</span>
            </label>
            <textarea
              id="descricao"
              name="descricao"
              className="textarea"
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              maxLength={2000}
              required
              placeholder="Descreva o prêmio, objetivo da rifa e informações importantes."
              aria-invalid={Boolean(state?.fieldErrors?.descricao)}
            />
            {state?.fieldErrors?.descricao ? (
              <p className="mt-1 text-xs text-red-700">{state.fieldErrors.descricao[0]}</p>
            ) : (
              <p className="hint">{descricao.length}/2000 caracteres</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="quantidadeNumeros" className="label">
                Quantidade de números <span className="text-red-600">*</span>
              </label>
              <input
                id="quantidadeNumeros"
                name="quantidadeNumeros"
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                step={1}
                className="input"
                value={quantidade}
                onChange={(event) => setQuantidade(event.target.value)}
                required
                aria-invalid={Boolean(state?.fieldErrors?.quantidadeNumeros)}
              />
              {state?.fieldErrors?.quantidadeNumeros ? (
                <p className="mt-1 text-xs text-red-700">{state.fieldErrors.quantidadeNumeros[0]}</p>
              ) : (
                <p className="hint">De 1 a 500 números. Serão gerados de 001 a {String(quantidadeNumeros || 0).padStart(3, "0")}.</p>
              )}
            </div>

            <div>
              <label htmlFor="valorNumero" className="label">
                Valor por número <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-500">R$</span>
                <input
                  id="valorNumero"
                  name="valorNumero"
                  inputMode="decimal"
                  className="input pl-10"
                  value={valor}
                  onChange={(event) => setValor(event.target.value)}
                  required
                  placeholder="5,00"
                  aria-invalid={Boolean(state?.fieldErrors?.valorNumero)}
                />
              </div>
              {state?.fieldErrors?.valorNumero ? (
                <p className="mt-1 text-xs text-red-700">{state.fieldErrors.valorNumero[0]}</p>
              ) : (
                <p className="hint">Valor individual em reais.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="dataInicio" className="label">
                Início das vendas <span className="font-normal text-ink-400">(opcional)</span>
              </label>
              <input
                id="dataInicio"
                name="dataInicio"
                type="datetime-local"
                className="input"
                value={dataInicio}
                onChange={(event) => setDataInicio(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="dataSorteio" className="label">
                Data e hora do sorteio <span className="text-red-600">*</span>
              </label>
              <input
                id="dataSorteio"
                name="dataSorteio"
                type="datetime-local"
                className="input"
                value={dataSorteio}
                onChange={(event) => setDataSorteio(event.target.value)}
                required
                aria-invalid={Boolean(state?.fieldErrors?.dataSorteio)}
              />
              {state?.fieldErrors?.dataSorteio ? (
                <p className="mt-1 text-xs text-red-700">{state.fieldErrors.dataSorteio[0]}</p>
              ) : null}
            </div>
          </div>

          <div>
            <label htmlFor="status" className="label">
              Status
            </label>
            {rifa?.status === "SORTEADA" ? (
              <>
                <input type="hidden" name="status" value="ENCERRADA" />
                <div className="rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2.5 text-sm text-violet-900">
                  Rifa sorteada. O resultado e o status são protegidos contra alterações comuns.
                </div>
              </>
            ) : (
              <select
                id="status"
                name="status"
                className="input"
                value={status}
                onChange={(event) => setStatus(event.target.value as "RASCUNHO" | "ABERTA" | "ENCERRADA")}
              >
                <option value="RASCUNHO">Rascunho — em preparação</option>
                <option value="ABERTA">Aberta — aceitando reservas</option>
                <option value="ENCERRADA">Encerrada — sem novas reservas</option>
              </select>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-ink-100 pt-5 sm:flex-row sm:justify-end">
          <Link href={rifa?.id ? `/rifas/${rifa.id}` : "/rifas"} className="btn-secondary">
            Cancelar
          </Link>
          <SubmitButton pendingLabel={editando ? "Salvando..." : "Criando rifa..."}>
            {editando ? "Salvar alterações" : "Criar rifa"}
          </SubmitButton>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="card overflow-hidden">
          <div className="bg-ink-950 p-5 text-white">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-400">Prévia</p>
            <h3 className="mt-2 line-clamp-2 font-display text-xl font-semibold">{titulo || "Nome da sua rifa"}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-ink-300">{descricao || "A descrição aparecerá aqui."}</p>
          </div>
          <div className="space-y-3 p-5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-500">Números</span>
              <span className="font-semibold text-ink-900">001 – {String(quantidadeNumeros || 0).padStart(3, "0")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-500">Valor unitário</span>
              <span className="font-semibold text-ink-900">{formatCurrency(valorCentavos)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-ink-100 pt-3">
              <span className="text-ink-500">Potencial total</span>
              <span className="font-bold text-brand-800">{formatCurrency(potencial)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3.5 text-xs leading-relaxed text-sky-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Os números são gerados automaticamente. Reservas são validadas no servidor e nunca podem ser duplicadas,
            mesmo com acessos simultâneos.
          </p>
        </div>

        {editando && Number(quantidade) < (rifa?.quantidadeNumeros ?? 0) ? (
          <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              A quantidade só pode ser reduzida até o maior número já reservado. Reservas existentes não são apagadas
              automaticamente.
            </p>
          </div>
        ) : null}
      </aside>
    </form>
  );
}
