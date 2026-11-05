# Relatório de segurança e evolução — Sistema de Rifas

**Período:** 30/10/2026 a 05/11/2026
**Repositório:** `Douglas-Albuquerque/rifa-free` (público)
**Objetivo:** registrar a análise de segurança do projeto, as correções aplicadas e os
resultados, servindo de base para um post no LinkedIn.

---

## 1. Resumo executivo

- O projeto saiu de **23 vulnerabilidades no `npm audit`** (2 críticas) para **0**.
- A imagem Docker saiu de **42 achados do Trivy** — sendo **22 HIGH/CRÍTICO** — para **0**.
- A pipeline de segurança foi criada do zero e evoluiu de **3 para 5 jobs**, com
  relatório na tela, artefatos e **email em sucesso e falha**.
- **26/26 testes** passaram após todas as atualizações, em Node 26 LTS.
- O Node 20 da imagem estava **EOL desde abril/2026** (sem patches) e foi trocado
  por **Node 26 LTS**, com build e deploy validados.
- A senha do administrador foi rotacionada e validada por hash bcrypt.
- O HTTPS real ficou **bloqueado por pré-requisito externo** (sem domínio e conta
  Tailscale sem suporte a certificados TLS); o cenário foi documentado com
  alternativas, em vez de usar certificado self-signed.

**Mensagem central:** o maior ganho não foi “passar no scanner”, foi criar um
**processo contínuo** que impede a regressão — e descobrir que parte relevante do
risco não estava no código da aplicação.

---

## 2. Contexto do projeto

O **Sistema de Rifas** é uma aplicação web para organizar rifas numéricas de ponta
a ponta: cadastro, grade de números, reservas, pagamentos, cartela para divulgação,
sorteio auditável e trilha de auditoria. O uso é exclusivo do organizador
autenticado.

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 15 (App Router, Server Components, Server Actions) |
| UI | React 19, TypeScript, Tailwind CSS 3.4, lucide-react |
| Banco | PostgreSQL 16 + Prisma 6 |
| Validação / Auth | Zod, jose (JWT HS256), bcryptjs |
| Testes | Vitest (integração com banco real) e playwright-core |
| Deploy | Docker multi-stage + Docker Compose + Caddy |

O sistema já estava funcional. O pedido foi: **analisar a segurança e depois
corrigir tudo o que fosse encontrado**, mantendo a pipeline verde.

---

## 3. Ponto de partida (diagnóstico)

A análise inicial encontrou cinco frentes principais:

1. **Credencial fraca em produção** — o administrador usava uma senha óbvia e
   exposta em documentação/histórico.
2. **Nenhum scan da imagem Docker** — a pipeline olhava dependências do
   `package-lock.json`, mas não o que realmente ia para produção.
3. **Dependências de desenvolvimento vulneráveis** — `vitest`, `tinypool`,
   `esbuild`, `minimatch`, `@vitest/mocker`.
4. **Dependências transitivas de produção** — `deepmerge-ts` e `effect`, via
   `@prisma/config`, com severidade ALTA.
5. **HTTPS inexistente** — acesso por IP em HTTP, sem TLS.

Além disso:

- Não havia pipeline de segurança nem política de falha.
- As actions do GitHub não estavam fixadas por SHA.
- Não havia atualização automatizada de dependências (Dependabot).
- A imagem final carregava ferramentas desnecessárias (npm/yarn/corepack).

---

## 4. O que foi feito

### 4.1 Pipeline de segurança (commit `f03887a`)

Criada uma pipeline no GitHub Actions com **Semgrep** (SAST), **Trivy**
(dependências, misconfiguração e segredos) e **CycloneDX** (SBOM), mais um job de
relatório consolidado.

Requisitos respeitados:

- Dispara em **pull request** e **push na `main`** (e manualmente).
- **Sem SARIF/GitHub Code Scanning**, porque a conta gratuita não oferece o
  recurso — o relatório vai para o **job summary**, artefatos e email.
- **Menor privilégio:** apenas `permissions: contents: read`.
- Actions de terceiros **fixadas por SHA completo**.
- **Email em sucesso e falha**, com achados, arquivo/linha e versão de correção.
- Artefatos JSON disponíveis por **7 dias**.

### 4.2 Vulnerabilidades de produção (commit `1d4d5e3`)

- Prisma atualizado para **6.19.3**.
- Override `deepmerge-ts: 8.0.2` para corrigir a cadeia transitiva do Prisma 6.
- Resultado: as **2 CVEs HIGH de produção** eliminadas sem migrar para o Prisma 7.

### 4.3 Dependências de desenvolvimento (commit `d6d81b8`)

- `vitest` **3.0.5 → 4.1.12** (remove `tinypool` e corrige `@vitest/mocker`).
- `tsx` **4.19.2 → 4.23.15** (traz `esbuild` 0.28).
- Override global `minimatch: 11.0.1` (advisory `GHSA-g3hv-75wg-m249`).
- `.eslintignore` para o `next-env.d.ts` gerado pelo Next.
- Resultado: `npm audit` **23 → 0** (produção e desenvolvimento).

### 4.4 Hardening da imagem (commit `093bac6`)

- `apk upgrade` no estágio base (correções de musl, zlib etc.).
- Remoção de **npm, npx, yarn e corepack** do estágio final.
- Descoberta principal: **quase todas as 22 CVEs HIGH/CRÍTICO vinham do npm
  embutido na imagem `node:20-alpine`** (node-tar, sigstore, pacote,
  brace-expansion…), não do código da aplicação.
- Resultado: imagem final **sem vulnerabilidades conhecidas**, `npm removido`,
  `node` presente, app saudável.

### 4.5 Scan da imagem na pipeline (commit `76e2413`)

- Novo job `image`: `docker build` + `trivy image`, com artefato próprio.
- O relatório consolidado passou a incluir a categoria **Imagem**, sempre tratada
  como produção (a imagem não tem separação dev/prod).
- O gate passou a bloquear achados da imagem a partir de `high`.
- Testado com JSON sintético: achado HIGH na imagem derruba a pipeline e aparece
  no relatório com pacote, versão atual e versão corrigida.

### 4.6 Dependabot (commit `76e2413`, ajustado em `1586292`)

- Atualizações **semanais** para npm, GitHub Actions e Docker.
- Grupos de produção e desenvolvimento.
- Ajuste importante: os grupos passaram a incluir **apenas minor/patch**.
  Majors (Prisma 7, Next 16, Tailwind 4, TypeScript 7, Node 26) quebravam o build
  quando vinham agrupados; agora abrem PRs individuais para migração planejada.

### 4.7 Node 20 → Node 26 LTS (commit `1a02669`)

- Node 20 estava **EOL desde abril/2026**, sem correções de segurança.
- Imagem base trocada para **`node:26-alpine`**.
- Validação completa antes do commit:
  - `tsc --noEmit` OK
  - ESLint OK
  - **26/26 testes** passaram
  - build da imagem Docker OK
  - `prisma migrate deploy` + seed OK
  - app `healthy` (`{"status":"ok","database":"ok"}`)
  - `npm` continua ausente no runtime

### 4.8 Senha do administrador

- Senha antiga substituída por uma senha aleatória forte.
- Validação por bcrypt: **nova senha confere = true** e **senha antiga confere =
  false**.
- `ADMIN_PASSWORD` atualizado no `.env.docker` (arquivo com permissão `600` e
  fora do Git).
- O valor **não deve ser divulgado** em post, print ou repositório.

### 4.9 Documentação

- `docs/SECURITY-PIPELINE.md`: jobs, gate, artefatos, email, overrides,
  Dependabot e limitações.
- `docs/DEPLOY.md`: seção “Situação atual desta máquina (ainda sem HTTPS)” com os
  caminhos para TLS real.
- `docs/ARCHITECTURE.md`: advisories do Prisma 6 registrados como mitigados por
  override.
- `README.md`: requisito de Node 26+.

---

## 5. A pipeline final

| Job | Ferramenta | Função |
| --- | --- | --- |
| `semgrep` | Semgrep 1.183.0 | SAST em TypeScript/React/Next.js, segredos, Dockerfile, Actions, OWASP e JWT |
| `trivy` | Trivy v0.76.1 | Vulnerabilidades em dependências, misconfigurações e segredos no código |
| `sbom` | CycloneDX 6.0.1 + Trivy | SBOM CycloneDX 1.6 + correlação com vulnerabilidades |
| `image` | Docker + Trivy | `docker build` + scan de **SO e runtime** da imagem final |
| `report` | Python | Consolida os 4 jobs, publica o resumo, envia email e aplica o gate |

**Política de falha:** bloqueia a partir de `high` (configurável pela variable
`FAIL_ON_SEVERITY`). Achados em devDependencies são informativos; achados da
imagem são sempre produção.

**Execuções de referência:**

| Run | Data | Resultado | Duração |
| --- | --- | --- | --- |
| `41655262906` | 03/11/2026 | sucesso (pipeline inicial) | ~49 s |
| `42020520386` | 05/11/2026 | sucesso (estado final, 5 jobs) | ~106 s |

---

## 6. Resultados (antes × depois)

| Métrica | Antes | Depois |
| --- | --- | --- |
| `npm audit` | 23 (2 críticas, 21 moderadas) | **0** |
| Trivy — imagem Docker | 42 achados (21 HIGH + 1 CRITICAL + 15 MEDIUM + 3 LOW + 2 UNKNOWN) | **0** |
| Vulnerabilidades de produção (Prisma) | 2 HIGH | **0** |
| Node da imagem | 20 (EOL) | **26 LTS** |
| Jobs da pipeline | 3 | **5** |
| Scan da imagem no CI | não existia | **docker build + trivy image** |
| Atualização de dependências | manual | **Dependabot semanal** |
| Testes | 26 | **26/26 passando** |
| Baseline de segurança | desconhecido | **0 conhecido (fs + imagem)** |

---

## 7. Decisões técnicas e trade-offs

- **Sem SARIF:** a conta GitHub gratuita não tem Code Scanning; a solução foi
  relatório no job summary + artefatos + email, sem depender de recurso pago.
- **Prisma 6 + override em vez de Prisma 7:** correção cirúrgica das CVEs
  transitivas sem uma migração major de gerador/configuração.
- **Remover npm do runtime:** o app standalone não precisa de npm; o `migrate` usa
  um estágio separado. Isso eliminou a maior parte da superfície de ataque.
- **Node 26 em vez de 24:** escolha pela LTS atual, com validação completa antes
  do merge.
- **Dependabot só agrupa minor/patch:** majors exigem migração e revisão; agrupar
  tudo gera PRs que quebram o build.
- **HTTPS documentado, não “gambiarrado”:** sem domínio e sem TLS no Tailscale,
  a alternativa seria self-signed (pior experiência e falsa sensação de
  segurança). O correto foi documentar os caminhos e manter o acesso restrito.
- **Dev ≠ prod:** vulnerabilidade em ferramenta de teste não bloqueia deploy, mas
  continua visível. A imagem, por não ter separação, é sempre tratada como
  produção.

---

## 8. Bloqueios e pendências

### HTTPS (bloqueio externo)

- Não há domínio apontando para o servidor.
- `tailscale cert` retorna: *“your Tailscale account does not support getting TLS
  certs”* (`CertDomains: None`).
- O IP público não é alcançável (CGNAT/sem port forwarding).
- Acesso atual: LAN e Tailscale (transporte criptografado pelo WireGuard), com
  Caddy em HTTP apenas no trecho final.
- Caminhos documentados: domínio próprio, Cloudflare Tunnel com Access, ou plano
  Tailscale compatível com certificados.

### Dependências

- Dois PRs do Dependabot com apenas minor/patch estavam abertos e **verdes nos 5
  jobs** (`#4` dev e `#5` produção).
- Majors (Next 16, Prisma 7, Tailwind 4, TypeScript 7) ficam para migrações
  planejadas, com regressão completa.

---

## 9. Aprendizados

1. **A imagem não é o filesystem.** O scan de dependências do projeto não via o
   npm embutido na imagem — e era ali que estava a maioria das CVEs.
2. **Fim de vida não aparece no scanner.** Node 20 estava sem patches e o Trivy
   não “reclama” de EOL; foi preciso olhar a versão da base.
3. **Ferramenta embutida é superfície de ataque.** Remover npm/yarn/corepack do
   runtime valeu mais que dezenas de atualizações pontuais.
4. **Dependabot agrupando majors é armadilha.** O PR “bonito” com 8 atualizações
   quebrava o build; separar minor/patch de major trouxe previsibilidade.
5. **Gate bom é gate que avisa.** Relatório na tela, artefato e email em sucesso
   e falha tornam a segurança visível para quem não abre o log.
6. **Nem todo risco é código.** Senha fraca e falta de HTTPS são processos e
   infraestrutura, não bugs de aplicação.
7. **“Zero” é um estado, não um destino.** O valor real está no baseline + scan
   contínuo + atualização automatizada.

---

## 10. Material para o post no LinkedIn

### 10.1 Números que valem highlight

- **23 → 0** vulnerabilidades no `npm audit`.
- **42 → 0** achados na imagem Docker, sendo **22 HIGH/CRÍTICO → 0**.
- **5 jobs** de segurança em ~1min40s.
- **26/26** testes passando após tudo.
- **Node 20 (EOL) → Node 26 LTS**.
- **0** vulnerabilidades conhecidas no baseline final (filesystem + imagem).

### 10.2 Ganchos possíveis (escolher um)

1. “As 22 vulnerabilidades críticas da minha imagem Docker não estavam no meu
   código.”
2. “Meu `npm audit` estava limpo. Minha imagem de produção tinha 22 CVEs
   HIGH/CRÍTICO.”
3. “Descobri que meu Node 20 estava sem patches há meses — e o scanner não avisou.”
4. “Eu achava que ‘passar no scanner’ era segurança. Era só o começo.”

### 10.3 Estrutura sugerida

1. **Contexto curto:** app Next.js 15 + PostgreSQL + Docker, projeto real.
2. **O problema:** achados do diagnóstico (senha fraca, sem scan de imagem, dev
   deps, HTTPS).
3. **O que foi feito:** pipeline com Semgrep/Trivy/CycloneDX, scan da imagem,
   hardening, atualização de dependências, Node LTS, Dependabot.
4. **Resultado com números:** 23 → 0, 22 HIGH/CRÍTICO → 0, 26 testes.
5. **Aprendizado:** imagem ≠ filesystem; EOL invisível; ferramenta embutida é
   risco; gate precisa notificar.
6. **CTA:** “Qual foi a maior surpresa que um scan de segurança já te deu?”

### 10.4 O que NÃO incluir

- Senha do administrador (mesmo após rotação).
- IPs, domínios internos, URLs de acesso ou dados de produção.
- Trechos de `.env`, tokens ou secrets.
- Prints com dados reais de rifas/participantes.
- A palavra “100% seguro” — o correto é “0 vulnerabilidades conhecidas no
  baseline atual”.

### 10.5 Hashtags sugeridas

`#Segurança #DevSecOps #AppSec #Docker #NextJS #Prisma #GitHubActions #OpenSource #BuildInPublic`

---

## 11. Referências

- Pipeline: `.github/workflows/security.yml`
- Documentação: `docs/SECURITY-PIPELINE.md`, `docs/DEPLOY.md`, `docs/ARCHITECTURE.md`
- Scripts: `.github/scripts/security/`
- Commits principais:
  - `f03887a` — pipeline Semgrep + Trivy + CycloneDX + email
  - `1d4d5e3` — correção das CVEs do Prisma
  - `d6d81b8` — dependências de desenvolvimento
  - `093bac6` — hardening da imagem
  - `76e2413` — scan da imagem + Dependabot
  - `63b0be4` — documentação do baseline e HTTPS
  - `1a02669` — Node 26 LTS
  - `1586292` — Dependabot minor/patch
- Runs verdes: `41655262906` (inicial) e `42020520386` (final)
