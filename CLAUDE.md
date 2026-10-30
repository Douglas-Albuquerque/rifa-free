# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

Sistema de Rifas: app Next.js 15 (App Router, Server Components, Server Actions) + React 19 + TypeScript + Tailwind 3.4 + PostgreSQL 16 via Prisma 6. Interface, código de domínio, mensagens e documentação são em pt-BR — mantenha esse padrão (nomes como `criarReserva`, `rifaId`, `statusPagamento`). Uso exclusivo de administradores autenticados. Requisitos de produto vêm de um PRD (cadastro de rifas 1–500 números, reservas, pagamentos manuais, pesquisa, sorteio auditável, histórico).

Documentação de referência: `README.md`, `docs/ARCHITECTURE.md` (decisões e limitações conhecidas), `docs/DEPLOY.md` (Docker, HTTPS, backup/restauração).

## Comandos

```bash
npm run dev                 # desenvolvimento
npm run build && npm start  # produção (PORT define a porta)
npm run lint                # next lint
npm run typecheck           # tsc --noEmit
npm test                    # Vitest (integração, banco real)
npx vitest run tests/reserva.test.ts        # um arquivo
npx vitest run tests/sorteio.test.ts -t "trecho do nome do teste"  # um teste
npm run test:e2e            # smoke E2E (playwright-core) contra servidor já rodando; E2E_BASE_URL etc.
npm run db:migrate          # prisma migrate dev (cria migração)
npm run db:deploy           # aplica migrações existentes
npm run db:seed             # cria admin inicial a partir de ADMIN_* do .env
npm run admin:create -- email senha [nome]
```

Banco de dev: container `rifas-postgres-dev` na porta 55432. Testes usam `rifas_test` (criar com `docker exec rifas-postgres-dev createdb -U rifas rifas_test`); `TEST_DATABASE_URL` sobrescreve. **`tests/helpers.ts#resetDatabase` faz TRUNCATE em todas as tabelas — nunca aponte `TEST_DATABASE_URL`/`E2E_DATABASE_URL` para o banco `rifas`.** Testes rodam sem paralelismo de arquivos (`fileParallelism: false`).

## Deploy sem Docker (cuidado)

**`npm run build` sobrescreve `.next`; se um `next start` estiver rodando na mesma pasta, ele passa a referenciar CSS/chunks que não existem mais (página sem estilo, 400 nos assets).** Depois de todo build, reinicie o `next start` imediatamente e verifique que os assets de `/login` respondem 200. Em bancos com dados reais, não use `db:reset` nem `prisma migrate dev`; faça `pg_dump` antes de migrações.

## Arquitetura

Monolito sem API pública (única rota HTTP: `/api/health`). Fluxo de escrita:

```
Componente cliente → Server Action (src/server/actions) → Service (src/server/services) → Prisma/PostgreSQL
```

- **Actions** (`"use server"`): chamam `requireSession()` primeiro, validam com schemas Zod de `src/lib/validation.ts`, chamam o service, fazem `revalidatePath` de todas as telas afetadas (dashboard, `/rifas`, `/pesquisa`, `/historico` e sub-rotas da rifa) e retornam `ActionResult` (`{ ok, message, code?, fieldErrors? }`) via `success`/`fail`/`actionFailureFromZod`. Erros passam por `publicErrorMessage` — nunca exponha erro interno.
- **Services**: regras de negócio dentro de `prisma.$transaction`; lançam `AppError(code, message)` com mensagem amigável; toda mutação grava auditoria com `registrarAuditoria(tx, ...)` **na mesma transação** (novas ações de auditoria precisam de rótulo em `AUDITORIA_LABEL` em `src/lib/status.ts`).
- **Leituras**: Server Components chamam `src/server/queries.ts` diretamente (inclui `calcularResumo` para KPIs). Componentes de UI não acessam o banco.
- **Auth**: `middleware.ts` bloqueia tudo exceto `/login` e `/api/health`; layout `(app)` e actions chamam `requireSession` (`src/lib/auth.ts`), que valida o JWT (`jose`, cookie `rifas_session`) e confirma o admin no banco.

### Modelo e invariantes

- `Reserva` agrupa números de um participante (pagamento é por reserva inteira); cada número é uma linha em `NumeroReservado` com `@@unique([rifaId, numero])` — essa constraint é a garantia contra venda dupla; P2002 vira "número ocupado".
- `Participante` é criado junto com cada reserva (não há deduplicação por nome).
- `valorCobrado` é calculado no servidor (quantidade × `valorNumero`); nunca aceitar valor do cliente.
- Dinheiro sempre em **centavos inteiros**; conversão só em `src/lib/format.ts` (`parseMoneyToCents`, `formatCurrency`). Datas de formulário (`datetime-local`) são interpretadas em `America/Sao_Paulo` (`parseDateTimeLocal`); exibição usa `APP_TIMEZONE`. Números exibidos com 3 dígitos (`formatNumber`).
- Status de rifa: `RASCUNHO`, `ABERTA`, `ENCERRADA`, `SORTEADA` — `SORTEADA` só é definido pelo sorteio, nunca pelo formulário.
- Sorteio (`sorteio-service.ts`): transação `Serializable` + `SELECT ... FOR UPDATE` na rifa, `crypto.randomInt` **somente sobre números de reservas `PAGO`** (pendentes ficam fora; regra alterada em relação ao PRD original), snapshot em `numerosElegiveis`, `Sorteio.rifaId @unique`, retry em P2034. O cliente nunca envia o número. Reserva vencedora / rifa sorteada não podem ser editadas ou liberadas, e o pagamento da reserva vencedora não pode mudar (`definirPagamento` é `Serializable` para conflitar com o sorteio); `quantidadeNumeros` nunca pode ficar abaixo do maior número reservado.
- Reservas não expiram; só voltam a ficar livres por liberação manual (que grava snapshot na auditoria antes de apagar).

### UI

Tailwind com paletas customizadas `ink` (neutros) e `brand` (verde) em `tailwind.config.ts`, mais classes utilitárias em `src/app/globals.css` (`btn-primary`, `btn-secondary`, `card`, `badge`, `eyebrow`...). Primitivas em `src/components/ui.tsx`, `modal.tsx` (tamanhos `sm|md|lg|xl`), `toast.tsx`. Mobile-first com navegação inferior (`app-shell.tsx`); estados de número precisam de cor **e** rótulo.

## Docker

`Dockerfile` multi-stage (`migrator` e `runner`, build com `NEXT_OUTPUT=standalone`) + `docker-compose.yml` (`db`, `migrate`, `app` em `127.0.0.1:3000`) usando `.env.docker` (modelo em `.env.docker.example`). Ver `docs/DEPLOY.md`.
