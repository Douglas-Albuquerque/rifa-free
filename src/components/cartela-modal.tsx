"use client";

import type { RifaStatus } from "@prisma/client";
import { Check, Copy, LayoutGrid, Printer } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { RIFA_STATUS_LABEL } from "@/lib/status";

import { Modal } from "./modal";
import { toast } from "./toast";

type RifaCartela = {
  titulo: string;
  descricao: string;
  quantidadeNumeros: number;
  valorNumero: number;
  dataSorteio: string;
  status: RifaStatus;
};

type CartelaModalProps = {
  rifa: RifaCartela;
  numerosVendidos: number[];
  numeroSorteado?: number | null;
};

export function CartelaModal({ rifa, numerosVendidos, numeroSorteado }: CartelaModalProps) {
  const [open, setOpen] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const vendidos = useMemo(() => new Set(numerosVendidos), [numerosVendidos]);
  const numeros = useMemo(
    () => Array.from({ length: rifa.quantidadeNumeros }, (_, index) => index + 1),
    [rifa.quantidadeNumeros],
  );
  const disponiveis = useMemo(() => numeros.filter((numero) => !vendidos.has(numero)), [numeros, vendidos]);
  const vendidosOrdenados = useMemo(() => numeros.filter((numero) => vendidos.has(numero)), [numeros, vendidos]);
  const ocupacao = Math.round((vendidosOrdenados.length / rifa.quantidadeNumeros) * 100);

  const textoDivulgacao = useMemo(() => {
    const linhas = [
      rifa.titulo,
      rifa.descricao,
      `Valor do número: ${formatCurrency(rifa.valorNumero)}`,
      `Sorteio: ${formatDate(rifa.dataSorteio)}`,
      `Vendidos: ${vendidosOrdenados.length} de ${rifa.quantidadeNumeros}`,
      "",
      `Números disponíveis (${disponiveis.length}):`,
      disponiveis.length > 0 ? disponiveis.map(formatNumber).join(", ") : "Todos os números já foram vendidos.",
    ];
    return linhas.filter((linha) => linha !== "").join("\n");
  }, [rifa, vendidosOrdenados.length, disponiveis]);

  async function copiarDisponiveis() {
    try {
      await navigator.clipboard.writeText(textoDivulgacao);
      setCopiado(true);
      toast("Lista de números disponíveis copiada.");
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast("Não foi possível copiar automaticamente. Selecione a lista manualmente.", "error");
    }
  }

  function imprimir() {
    const janela = window.open("", "_blank", "width=900,height=1200");
    if (!janela) {
      toast("Permita pop-ups neste site para abrir a versão de impressão.", "error");
      return;
    }
    janela.document.write(gerarHtmlImpressao(rifa, new Set(numerosVendidos), numeroSorteado));
    janela.document.close();
    janela.focus();
    window.setTimeout(() => janela.print(), 300);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm">
        <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
        Ver cartela
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cartela para divulgação"
        description="Visualize os números vendidos e disponíveis. Use a impressão ou o PDF para compartilhar nas redes sociais."
        size="xl"
      >
        <div className="cartela-print rounded-3xl border border-ink-200 bg-white p-4 shadow-card sm:p-5">
          <header className="border-b border-ink-100 pb-3">
            <p className="eyebrow">{RIFA_STATUS_LABEL[rifa.status]} · Rifa</p>
            <h3 className="mt-1 font-display text-xl font-semibold text-ink-950 sm:text-2xl">{rifa.titulo}</h3>
            {rifa.descricao ? <p className="mt-1 text-xs leading-relaxed text-ink-500">{rifa.descricao}</p> : null}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-600">
              <span>
                Número: <strong className="text-ink-950">{formatCurrency(rifa.valorNumero)}</strong>
              </span>
              <span>
                Sorteio: <strong className="text-ink-950">{formatDate(rifa.dataSorteio)}</strong>
              </span>
              <span>
                Vendidos:{" "}
                <strong className="text-ink-950">
                  {vendidosOrdenados.length} de {rifa.quantidadeNumeros}
                </strong>
              </span>
              <span>
                Disponíveis: <strong className="text-brand-800">{disponiveis.length}</strong>
              </span>
            </div>
          </header>

          <div
            className="mt-3 grid grid-cols-10 gap-0.5 sm:grid-cols-[repeat(20,minmax(0,1fr))] lg:grid-cols-[repeat(25,minmax(0,1fr))]"
            role="list"
            aria-label={`Cartela de números da rifa ${rifa.titulo}`}
          >
            {numeros.map((numero) => {
              const sorteado = numero === numeroSorteado;
              const vendido = vendidos.has(numero);
              return (
                <span
                  key={numero}
                  role="listitem"
                  aria-label={`Número ${formatNumber(numero)}${
                    sorteado ? ", sorteado" : vendido ? ", vendido" : ", disponível"
                  }`}
                  className={cn(
                    "flex h-6 items-center justify-center rounded border text-[10px] font-bold leading-none tabular-nums",
                    sorteado
                      ? "border-amber-500 bg-amber-300 text-amber-950"
                      : vendido
                        ? "border-red-300 bg-red-100 text-red-700 line-through"
                        : "border-brand-200 bg-brand-50 text-brand-900",
                  )}
                >
                  {formatNumber(numero)}
                </span>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-ink-100 pt-3 text-[11px] text-ink-600">
            <LegendaItem className="border-brand-200 bg-brand-50" label="Disponível" />
            <LegendaItem className="border-red-300 bg-red-100" label="Vendido" />
            <LegendaItem className="border-amber-500 bg-amber-300" label="Sorteado" />
            <span className="ml-auto font-semibold text-ink-700">{ocupacao}% da cartela vendida</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <section className="rounded-2xl border border-ink-100 bg-white p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Vendidos</h4>
              <span className="badge bg-ink-100 text-ink-700 ring-ink-200">{vendidosOrdenados.length}</span>
            </div>
            <div className="mt-2 flex max-h-40 flex-wrap gap-1 overflow-y-auto pr-1">
              {vendidosOrdenados.length > 0 ? (
                vendidosOrdenados.map((numero) => (
                  <span
                    key={numero}
                    className={cn(
                      "rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-red-700",
                      numero === numeroSorteado && "bg-amber-300 text-amber-950",
                    )}
                  >
                    {formatNumber(numero)}
                  </span>
                ))
              ) : (
                <p className="text-xs text-ink-500">Nenhum número vendido até o momento.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-brand-200 bg-brand-50/50 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-brand-800">Disponíveis</h4>
              <span className="badge bg-brand-100 text-brand-800 ring-brand-200">{disponiveis.length}</span>
            </div>
            <div className="mt-2 flex max-h-40 flex-wrap gap-1 overflow-y-auto pr-1">
              {disponiveis.length > 0 ? (
                disponiveis.map((numero) => (
                  <span
                    key={numero}
                    className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-brand-900 ring-1 ring-brand-200"
                  >
                    {formatNumber(numero)}
                  </span>
                ))
              ) : (
                <p className="text-xs text-ink-500">Todos os números já foram vendidos.</p>
              )}
            </div>
          </section>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-ink-100 pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={copiarDisponiveis} className="btn-secondary">
            {copiado ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copiado ? "Copiado" : "Copiar disponíveis"}
          </button>
          <button type="button" onClick={imprimir} className="btn-primary">
            <Printer className="h-4 w-4" aria-hidden />
            Imprimir / Salvar PDF
          </button>
        </div>
      </Modal>
    </>
  );
}

function LegendaItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3.5 w-3.5 rounded border", className)} aria-hidden />
      {label}
    </span>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[char] ?? char;
  });
}

function gerarHtmlImpressao(rifa: RifaCartela, vendidos: Set<number>, numeroSorteado?: number | null) {
  const numeros = Array.from({ length: rifa.quantidadeNumeros }, (_, index) => index + 1);
  const disponiveis = numeros.filter((numero) => !vendidos.has(numero));
  const vendidosOrdenados = numeros.filter((numero) => vendidos.has(numero));

  const celulas = numeros
    .map((numero) => {
      const classe = numero === numeroSorteado ? "sorteado" : vendidos.has(numero) ? "vendido" : "disponivel";
      const titulo = numero === numeroSorteado ? "Sorteado" : vendidos.has(numero) ? "Vendido" : "Disponível";
      return `<div class="celula ${classe}" title="${titulo}">${formatNumber(numero)}</div>`;
    })
    .join("");

  const listaVendidos = vendidosOrdenados.length
    ? vendidosOrdenados.map(formatNumber).join(", ")
    : "Nenhum número vendido até o momento.";

  const listaDisponiveis = disponiveis.length
    ? disponiveis.map(formatNumber).join(", ")
    : "Todos os números já foram vendidos.";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapeHtml(rifa.titulo)} - Cartela</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; background: #fff; color: #151e1a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
  .cartela { max-width: 780px; margin: 0 auto; }
  .topo { border-bottom: 2px solid #047857; padding-bottom: 12px; margin-bottom: 14px; }
  .eyebrow { margin: 0 0 4px; font-size: 10px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #047857; }
  h1 { margin: 0; font-size: 24px; line-height: 1.2; }
  .descricao { margin: 6px 0 0; font-size: 12px; line-height: 1.5; color: #5c796a; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 10px; font-size: 12px; color: #3a4d44; }
  .meta strong { color: #151e1a; }
  .grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; }
  .celula { display: flex; align-items: center; justify-content: center; aspect-ratio: 1 / 1; border: 1px solid #cbd6d0; border-radius: 4px; font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .disponivel { background: #ecfdf5; border-color: #a7f3d0; color: #064e3b; }
  .vendido { background: #fee2e2; border-color: #fca5a5; color: #b91c1c; text-decoration: line-through; }
  .sorteado { background: #fde68a; border-color: #f59e0b; color: #78350f; }
  .legenda { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #e6ebe8; font-size: 10px; color: #3a4d44; }
  .legenda span { display: inline-flex; align-items: center; gap: 5px; }
  .quadrado { display: inline-block; width: 11px; height: 11px; border: 1px solid #cbd6d0; border-radius: 3px; }
  .secao { margin-top: 18px; page-break-inside: avoid; }
  .secao h2 { margin: 0 0 6px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #3a4d44; }
  .lista { font-size: 11px; line-height: 1.7; color: #2b3631; }
  .rodape { margin-top: 18px; border-top: 1px solid #e6ebe8; padding-top: 8px; font-size: 9px; color: #7a9586; }
  @media print { body { padding: 0; } @page { size: A4 portrait; margin: 10mm; } }
</style>
</head>
<body>
  <main class="cartela">
    <header class="topo">
      <p class="eyebrow">${escapeHtml(RIFA_STATUS_LABEL[rifa.status])} · Rifa</p>
      <h1>${escapeHtml(rifa.titulo)}</h1>
      ${rifa.descricao ? `<p class="descricao">${escapeHtml(rifa.descricao)}</p>` : ""}
      <div class="meta">
        <span>Número: <strong>${escapeHtml(formatCurrency(rifa.valorNumero))}</strong></span>
        <span>Sorteio: <strong>${escapeHtml(formatDate(rifa.dataSorteio))}</strong></span>
        <span>Vendidos: <strong>${vendidosOrdenados.length} de ${rifa.quantidadeNumeros}</strong></span>
        <span>Disponíveis: <strong>${disponiveis.length}</strong></span>
      </div>
    </header>

    <div class="grid">${celulas}</div>

    <div class="legenda">
      <span><i class="quadrado" style="background:#ecfdf5;border-color:#a7f3d0"></i>Disponível</span>
      <span><i class="quadrado" style="background:#fee2e2;border-color:#fca5a5"></i>Vendido</span>
      <span><i class="quadrado" style="background:#fde68a;border-color:#f59e0b"></i>Sorteado</span>
    </div>

    <section class="secao">
      <h2>Números vendidos (${vendidosOrdenados.length})</h2>
      <p class="lista">${listaVendidos}</p>
    </section>

    <section class="secao">
      <h2>Números disponíveis (${disponiveis.length})</h2>
      <p class="lista">${listaDisponiveis}</p>
    </section>

    <p class="rodape">Gerado em ${escapeHtml(formatDate(new Date()))}. Os números vendidos não podem ser escolhidos novamente.</p>
  </main>
</body>
</html>`;
}
