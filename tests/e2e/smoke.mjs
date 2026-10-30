import assert from "node:assert/strict";
import fs from "node:fs";

import "dotenv/config";
import { chromium } from "playwright-core";
import { PrismaClient } from "@prisma/client";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3100";
const EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@exemplo.com";
const SENHA = process.env.E2E_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "troque-esta-senha-forte";
const TITULO = `[E2E] Rifa de validação ${Date.now()}`;
const PARTICIPANTE = "E2E Participante da Silva";
const SHOTS = process.env.E2E_SHOTS_DIR || "/tmp/rifas-shots";
const DB_URL = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL;

const CHROME_CANDIDATES = [
  process.env.E2E_CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

function findChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("Chrome/Chromium não encontrado. Defina E2E_CHROME_PATH.");
  return found;
}

async function limpar() {
  if (!DB_URL) return;
  const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  try {
    const antigas = await prisma.rifa.findMany({ where: { titulo: { startsWith: "[E2E]" } }, select: { id: true } });
    for (const rifa of antigas) {
      await prisma.rifa.delete({ where: { id: rifa.id } });
    }
  } catch (error) {
    console.warn(`Aviso: não foi possível limpar rifas [E2E] via banco (${DB_URL ? "conexão falhou" : "URL ausente"}).`);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  await limpar();

  const browser = await chromium.launch({ executablePath: findChrome(), args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, locale: "pt-BR" });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.locator("#email").fill(EMAIL);
    await page.locator("#senha").fill(SENHA);
    await Promise.all([
      page.waitForURL(`${BASE_URL}/`),
      page.getByRole("button", { name: "Entrar no painel" }).click(),
    ]);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${SHOTS}/01-dashboard.png`, fullPage: true });

    await page.goto(`${BASE_URL}/rifas/nova`);
    await page.locator("#titulo").fill(TITULO);
    await page.locator("#descricao").fill("Validação automatizada ponta a ponta do sistema de rifas.");
    await page.locator("#quantidadeNumeros").fill("100");
    await page.locator("#valorNumero").fill("10,00");
    await page.locator("#dataSorteio").fill("2026-12-20T20:00");
    await page.getByRole("button", { name: "Criar rifa" }).click();
    await page.waitForURL((url) => /^\/rifas\/[a-z0-9]+$/.test(url.pathname) && url.pathname !== "/rifas/nova", {
      timeout: 20_000,
    });
    const rifaId = new URL(page.url()).pathname.split("/").pop();
    assert.ok(rifaId, "ID da rifa não encontrado");
    await page.waitForLoadState("networkidle");
    assert.equal(await page.locator("h1").first().textContent(), TITULO);

    for (const numero of ["001", "002", "003"]) {
      await page.locator(`button[aria-label="Número ${numero}, disponível"]`).click();
    }
    await page.getByRole("button", { name: "Reservar", exact: true }).click();
    await page.locator("#reserva-nome").fill(PARTICIPANTE);
    await page.locator("#reserva-telefone").fill("(11) 99999-0000");
    await page.getByRole("button", { name: "Confirmar reserva" }).click();
    await page.getByText(/Reserva confirmada para/).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(800);

    for (const numero of ["001", "002", "003"]) {
      await page
        .locator(`button[aria-label*="Número ${numero}"][aria-label*="pendente"][aria-label*="${PARTICIPANTE}"]`)
        .waitFor();
    }
    await page.getByRole("button", { name: "Só disponíveis" }).click();
    assert.equal(await page.locator('button[aria-label^="Número 001"]').count(), 0, "Número reservado deveria estar oculto");
    assert.equal(await page.locator('button[aria-label="Número 004, disponível"]').count(), 1, "Número disponível deveria aparecer");
    await page.getByRole("button", { name: "Mostrar todos" }).click();
    assert.equal(await page.locator('button[aria-label^="Número 001"]').count(), 1, "Número reservado deveria reaparecer");
    await page.screenshot({ path: `${SHOTS}/02-rifa-grade.png`, fullPage: true });

    await page.locator(`button[aria-label*="Número 001"][aria-label*="${PARTICIPANTE}"]`).click();
    await page.getByRole("button", { name: "Marcar como pago" }).click();
    await page.getByText("Pagamento confirmado e indicadores atualizados.").waitFor({ timeout: 15_000 });
    await page.waitForTimeout(800);
    await page
      .locator(`button[aria-label*="Número 001"][aria-label*="pago"][aria-label*="${PARTICIPANTE}"]`)
      .waitFor();

    await page.goto(`${BASE_URL}/pesquisa`);
    await page.locator("#nome").fill("E2E Particip");
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.waitForLoadState("networkidle");
    const resultado = page.getByText(PARTICIPANTE, { exact: true });
    await resultado.waitFor();
    await page.screenshot({ path: `${SHOTS}/03-pesquisa.png`, fullPage: true });

    await page.locator("#nome").fill("002");
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.waitForLoadState("networkidle");
    await page.getByText(PARTICIPANTE, { exact: true }).waitFor();

    await page.goto(`${BASE_URL}/rifas/${rifaId}/participantes`, { waitUntil: "networkidle" });
    await page.locator("#nome").fill("003");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: PARTICIPANTE, exact: true }).first().waitFor();

    await page.goto(`${BASE_URL}/rifas/${rifaId}/sorteio`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Iniciar sorteio" }).click();
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: "Realizar sorteio" }).click();
    await page.getByText("Número vencedor", { exact: true }).waitFor({ timeout: 20_000 });
    const textoVencedor = await page.locator("text=/^00[1-3]$/").first().textContent();
    assert.ok(["001", "002", "003"].includes(textoVencedor?.trim()), `Vencedor inesperado: ${textoVencedor}`);
    await page.screenshot({ path: `${SHOTS}/04-sorteio.png`, fullPage: true });

    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Número vencedor", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Iniciar sorteio" }).count(), 0);

    await page.goto(`${BASE_URL}/historico`);
    await page.getByText(TITULO, { exact: true }).waitFor();
    await page.screenshot({ path: `${SHOTS}/05-historico.png`, fullPage: true });

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "pt-BR",
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(`${BASE_URL}/login`);
    await mobilePage.locator("#email").fill(EMAIL);
    await mobilePage.locator("#senha").fill(SENHA);
    await Promise.all([
      mobilePage.waitForURL(`${BASE_URL}/`),
      mobilePage.getByRole("button", { name: "Entrar no painel" }).click(),
    ]);
    await mobilePage.screenshot({ path: `${SHOTS}/06-mobile-painel.png`, fullPage: true });
    await mobilePage.goto(`${BASE_URL}/rifas/${rifaId}`, { waitUntil: "networkidle" });
    const semScrollHorizontal = await mobilePage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    assert.ok(semScrollHorizontal, "A página mobile possui rolagem horizontal");
    await mobilePage.screenshot({ path: `${SHOTS}/07-mobile-rifa.png`, fullPage: true });

    assert.equal(consoleErrors.length, 0, `Erros de console: ${consoleErrors.join(" | ")}`);
    console.log("E2E OK — login, rifa, reserva, pagamento, pesquisa, sorteio, persistência e mobile.");
    console.log(`Screenshots em ${SHOTS}`);
  } catch (error) {
    await page.screenshot({ path: `${SHOTS}/erro.png`, fullPage: true }).catch(() => {});
    console.error(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await limpar();
  }
}

main();
