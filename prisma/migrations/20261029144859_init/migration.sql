-- CreateEnum
CREATE TYPE "public"."RifaStatus" AS ENUM ('RASCUNHO', 'ABERTA', 'ENCERRADA', 'SORTEADA');

-- CreateEnum
CREATE TYPE "public"."PagamentoStatus" AS ENUM ('PENDENTE', 'PAGO');

-- CreateEnum
CREATE TYPE "public"."SorteioStatus" AS ENUM ('CONCLUIDO');

-- CreateTable
CREATE TABLE "public"."AdminUser" (
    "id" TEXT NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Rifa" (
    "id" TEXT NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "descricao" VARCHAR(2000) NOT NULL,
    "quantidadeNumeros" INTEGER NOT NULL,
    "valorNumero" INTEGER NOT NULL,
    "dataInicio" TIMESTAMP(3),
    "dataSorteio" TIMESTAMP(3) NOT NULL,
    "status" "public"."RifaStatus" NOT NULL DEFAULT 'ABERTA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rifa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Participante" (
    "id" TEXT NOT NULL,
    "nome" VARCHAR(160) NOT NULL,
    "telefone" VARCHAR(30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Reserva" (
    "id" TEXT NOT NULL,
    "rifaId" TEXT NOT NULL,
    "participanteId" TEXT NOT NULL,
    "statusPagamento" "public"."PagamentoStatus" NOT NULL DEFAULT 'PENDENTE',
    "valorCobrado" INTEGER NOT NULL,
    "pagoEm" TIMESTAMP(3),
    "observacoes" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NumeroReservado" (
    "id" TEXT NOT NULL,
    "rifaId" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NumeroReservado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Sorteio" (
    "id" TEXT NOT NULL,
    "rifaId" TEXT NOT NULL,
    "numeroVencedor" INTEGER NOT NULL,
    "participanteId" TEXT NOT NULL,
    "dataHoraSorteio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantidadeElegivel" INTEGER NOT NULL,
    "numerosElegiveis" INTEGER[],
    "status" "public"."SorteioStatus" NOT NULL DEFAULT 'CONCLUIDO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sorteio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Auditoria" (
    "id" TEXT NOT NULL,
    "rifaId" TEXT,
    "acao" VARCHAR(60) NOT NULL,
    "entidadeAfetada" VARCHAR(60) NOT NULL,
    "registroId" VARCHAR(80),
    "dadosAnteriores" JSONB,
    "dadosNovos" JSONB,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "public"."AdminUser"("email");

-- CreateIndex
CREATE INDEX "Rifa_status_idx" ON "public"."Rifa"("status");

-- CreateIndex
CREATE INDEX "Rifa_createdAt_idx" ON "public"."Rifa"("createdAt");

-- CreateIndex
CREATE INDEX "Participante_nome_idx" ON "public"."Participante"("nome");

-- CreateIndex
CREATE INDEX "Reserva_rifaId_statusPagamento_idx" ON "public"."Reserva"("rifaId", "statusPagamento");

-- CreateIndex
CREATE INDEX "Reserva_participanteId_idx" ON "public"."Reserva"("participanteId");

-- CreateIndex
CREATE INDEX "Reserva_createdAt_idx" ON "public"."Reserva"("createdAt");

-- CreateIndex
CREATE INDEX "NumeroReservado_reservaId_idx" ON "public"."NumeroReservado"("reservaId");

-- CreateIndex
CREATE UNIQUE INDEX "NumeroReservado_rifaId_numero_key" ON "public"."NumeroReservado"("rifaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Sorteio_rifaId_key" ON "public"."Sorteio"("rifaId");

-- CreateIndex
CREATE INDEX "Sorteio_participanteId_idx" ON "public"."Sorteio"("participanteId");

-- CreateIndex
CREATE INDEX "Sorteio_dataHoraSorteio_idx" ON "public"."Sorteio"("dataHoraSorteio");

-- CreateIndex
CREATE INDEX "Auditoria_rifaId_dataHora_idx" ON "public"."Auditoria"("rifaId", "dataHora");

-- CreateIndex
CREATE INDEX "Auditoria_dataHora_idx" ON "public"."Auditoria"("dataHora");

-- CreateIndex
CREATE INDEX "Auditoria_usuarioId_idx" ON "public"."Auditoria"("usuarioId");

-- AddForeignKey
ALTER TABLE "public"."Reserva" ADD CONSTRAINT "Reserva_rifaId_fkey" FOREIGN KEY ("rifaId") REFERENCES "public"."Rifa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reserva" ADD CONSTRAINT "Reserva_participanteId_fkey" FOREIGN KEY ("participanteId") REFERENCES "public"."Participante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NumeroReservado" ADD CONSTRAINT "NumeroReservado_rifaId_fkey" FOREIGN KEY ("rifaId") REFERENCES "public"."Rifa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NumeroReservado" ADD CONSTRAINT "NumeroReservado_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "public"."Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sorteio" ADD CONSTRAINT "Sorteio_rifaId_fkey" FOREIGN KEY ("rifaId") REFERENCES "public"."Rifa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sorteio" ADD CONSTRAINT "Sorteio_participanteId_fkey" FOREIGN KEY ("participanteId") REFERENCES "public"."Participante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Auditoria" ADD CONSTRAINT "Auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Auditoria" ADD CONSTRAINT "Auditoria_rifaId_fkey" FOREIGN KEY ("rifaId") REFERENCES "public"."Rifa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Regras de integridade adicionais (defesa em profundidade)
ALTER TABLE "public"."Rifa" ADD CONSTRAINT "Rifa_quantidade_numeros_check" CHECK ("quantidadeNumeros" BETWEEN 1 AND 500);
ALTER TABLE "public"."Rifa" ADD CONSTRAINT "Rifa_valor_numero_check" CHECK ("valorNumero" > 0);
ALTER TABLE "public"."NumeroReservado" ADD CONSTRAINT "NumeroReservado_numero_positivo_check" CHECK ("numero" > 0);
ALTER TABLE "public"."Reserva" ADD CONSTRAINT "Reserva_valor_cobrado_check" CHECK ("valorCobrado" >= 0);
