# Sistema de Rifas

Aplicação web para organizar rifas numéricas de ponta a ponta: cadastro da rifa, grade interativa de números, reservas, controle de pagamentos, pesquisa de participantes, cartela para divulgação e sorteio auditável. A interface é em português, mobile-first, e o uso é exclusivo do organizador autenticado.

> Feito para substituir planilhas e anotações: os dados ficam em PostgreSQL, toda operação crítica é transacional e cada alteração relevante fica registrada em auditoria.

## Funcionalidades

- **Rifas** de 1 a 500 números, com valor por número, datas e status (`Rascunho`, `Aberta`, `Encerrada`, `Sorteada`).
- **Grade interativa** com estados distintos (disponível, pendente, pago, sorteado), seleção de vários números e filtro para mostrar só os disponíveis.
- **Reservas** de vários números para o mesmo participante em uma única operação; o valor total é calculado no servidor.
- **Pagamentos** confirmados manualmente por reserva, com data/hora registrada e indicadores financeiros (arrecadado, a receber, ocupação).
- **Pesquisa** global e por rifa, por nome (parcial, sem diferenciar maiúsculas) ou número exato.
- **Cartela para divulgação** com todos os números vendidos/disponíveis, cópia da lista de disponíveis e versão para imprimir ou salvar em PDF.
- **Sorteio** no servidor com gerador criptograficamente seguro. **Somente números de reservas pagas concorrem.** O resultado é único por rifa, imutável e guarda o conjunto de números elegíveis.
- **Histórico de sorteios** e **trilha de auditoria** por rifa (criação, edição, pagamentos, liberações e sorteios).
- **Login administrativo** com rate limit e sessão em cookie httpOnly.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 15 (App Router, Server Components, Server Actions) |
| UI | React 19, TypeScript, Tailwind CSS 3.4, lucide-react |
| Banco | PostgreSQL 16 + Prisma 6 |
| Validação / Auth | Zod, jose (JWT HS256), bcryptjs |
| Testes | Vitest (integração com banco real) e playwright-core (smoke E2E) |
| Deploy | Docker multi-stage + Docker Compose |

## Começando

### Requisitos

- Node.js 26+ (LTS)
- Docker (para o PostgreSQL) ou um PostgreSQL 16 local
- Chrome/Chromium apenas para o teste E2E

### 1. Banco de desenvolvimento

```bash
docker run -d --name rifas-postgres-dev \
  -e POSTGRES_USER=rifas \
  -e POSTGRES_PASSWORD=rifas_dev_password \
  -e POSTGRES_DB=rifas \
  -p 127.0.0.1:55432:5432 \
  postgres:16-alpine
```

> Essa senha é apenas para desenvolvimento local. Em produção use uma senha forte e não exponha a porta do banco.

### 2. Configuração e migrações

```bash
git clone <url-do-repositorio> rifas
cd rifas
cp .env.example .env      # ajuste AUTH_SECRET e ADMIN_*
npm ci
npm run db:deploy
npm run db:seed           # cria o administrador inicial
```

### 3. Executar

```bash
npm run dev               # http://localhost:3000
```

Entre com `ADMIN_EMAIL` / `ADMIN_PASSWORD` do `.env`. Para simular produção: `npm run build && npm start`.

### Com Docker Compose

```bash
cp .env.docker.example .env.docker   # defina senhas e AUTH_SECRET
docker compose up -d --build
```

Sobe banco, migrações e aplicação em `127.0.0.1:3000`. HTTPS, backup e restauração estão em [docs/DEPLOY.md](docs/DEPLOY.md).

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | sim | Conexão PostgreSQL usada pelo Prisma. |
| `AUTH_SECRET` | sim | Segredo da sessão, 32+ caracteres (`openssl rand -base64 48`). |
| `ADMIN_NAME` | no seed | Nome do administrador inicial. |
| `ADMIN_EMAIL` | no seed | E-mail do administrador inicial. |
| `ADMIN_PASSWORD` | no seed | Senha com 10+ caracteres. |
| `APP_TIMEZONE` | não | Fuso de exibição, padrão `America/Sao_Paulo`. |
| `COOKIE_SECURE` | não | Força `Secure` no cookie. Em branco, detecta HTTPS pelos headers do proxy. |

Nunca versione `.env` ou `.env.docker`.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Ambiente de desenvolvimento. |
| `npm run build` / `npm start` | Build e servidor de produção. |
| `npm run lint` / `npm run typecheck` | ESLint e verificação de tipos. |
| `npm test` | Testes de integração. |
| `npm run test:e2e` | Smoke test E2E contra um servidor em execução. |
| `npm run db:migrate` | Cria/aplica migrações em desenvolvimento. |
| `npm run db:deploy` | Aplica migrações existentes. |
| `npm run db:seed` | Cria o administrador inicial, se não existir. |
| `npm run db:reset` | Recria o banco de desenvolvimento (**apaga os dados**). |
| `npm run admin:create -- email senha [nome]` | Cria ou redefine um administrador. |

> Se rodar `npm run build` com um `npm start` já em execução na mesma pasta, reinicie o servidor logo em seguida; caso contrário ele continuará apontando para CSS/JS do build anterior.

## Testes

Os testes de integração usam um banco separado e aplicam as migrações automaticamente. **Eles apagam todas as tabelas do banco de teste** — nunca aponte `TEST_DATABASE_URL` para um banco com dados reais.

```bash
docker exec rifas-postgres-dev createdb -U rifas rifas_test
npm test
npx vitest run tests/sorteio.test.ts                 # um arquivo
npx vitest run tests/sorteio.test.ts -t "pendentes"  # testes pelo nome
```

Banco padrão: `postgresql://rifas:rifas_dev_password@localhost:55432/rifas_test` (sobrescreva com `TEST_DATABASE_URL`).

Smoke test E2E (com o app rodando):

```bash
PORT=3100 npm start
npm run test:e2e
```

Ele cria uma rifa temporária com título iniciado em `[E2E]`, reserva números, marca pagamento, pesquisa, sorteia e valida o layout mobile; depois remove apenas essas rifas. Variáveis opcionais: `E2E_BASE_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_CHROME_PATH`, `E2E_SHOTS_DIR`, `E2E_DATABASE_URL`.

## Arquitetura

Monolito Next.js sem API pública. Leituras acontecem em Server Components; escritas passam por Server Actions:

```text
Navegador ──▶ Server Action ──▶ Service (transação Prisma) ──▶ PostgreSQL
              Zod + sessão       regras, locks, auditoria
```

```text
src/
  app/                 rotas, layouts e páginas (App Router)
  components/          UI, grade de números, cartela, formulários e painéis
  lib/                 sessão, validação, formatação, erros e Prisma
  server/
    actions/           Server Actions (entrada das mutações)
    services/          regras de negócio e transações
    queries.ts         consultas de leitura e indicadores
prisma/                schema, migrações, seed e criação de admin
tests/                 integração (Vitest) e smoke E2E
docs/                  arquitetura, implantação e relatório de segurança
```

Decisões técnicas e limitações conhecidas: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Regras de negócio principais

- Um número nunca é vendido duas vezes: além da checagem transacional, existe `UNIQUE (rifaId, numero)` no PostgreSQL.
- Valores são inteiros em centavos; o valor da reserva é sempre `quantidade × valor do número`, calculado no servidor.
- O pagamento é por reserva (todo o grupo de números). Reservas pendentes continuam ocupando o número até serem liberadas manualmente — não há expiração automática.
- O sorteio roda em transação `Serializable` com `SELECT ... FOR UPDATE`, usa `crypto.randomInt` sobre os números **pagos** e grava o conjunto elegível. O navegador nunca escolhe o número; um segundo sorteio da mesma rifa é bloqueado pelo banco.
- Após o sorteio, a reserva vencedora não pode ser editada, liberada nem ter o pagamento alterado.
- Datas de formulário são interpretadas em `America/Sao_Paulo`.

## Segurança

- Todas as rotas, exceto `/login` e `/api/health`, exigem sessão válida (middleware e servidor).
- Senhas com bcrypt (custo 12); sessão JWT em cookie httpOnly, `SameSite=Lax` e `Secure` sob HTTPS.
- Rate limit de login por IP + e-mail.
- Validação Zod no servidor, consultas parametrizadas e headers de segurança (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`).
- Em produção use HTTPS e siga o checklist de [docs/DEPLOY.md](docs/DEPLOY.md).
- Pipeline de segurança (Semgrep, Trivy e CycloneDX) com relatório e email em
  [docs/SECURITY-PIPELINE.md](docs/SECURITY-PIPELINE.md).
- Histórico da análise, correções e resultados em
  [docs/RELATORIO-SEGURANCA.md](docs/RELATORIO-SEGURANCA.md).

## Licença

[MIT](LICENSE)
