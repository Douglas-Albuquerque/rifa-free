# Pipeline de segurança (GitHub Actions)

Workflow: [`.github/workflows/security.yml`](../.github/workflows/security.yml)

Ele roda em **push na `main`**, **pull request para a `main`** e também pode ser
disparado manualmente em **Actions → Security Analysis → Run workflow**.

## O que é analisado

| Job | Ferramenta | O que faz |
| --- | --- | --- |
| `semgrep` | Semgrep | SAST em TypeScript/React/Next.js, segredos, Dockerfile, GitHub Actions, OWASP Top 10 e JWT. |
| `trivy` | Trivy | Vulnerabilidades em dependências, misconfigurações (Docker/Compose/IaC) e segredos no código. |
| `sbom` | CycloneDX + Trivy | Gera o SBOM (`bom.json`, CycloneDX 1.6) e correlaciona os componentes com vulnerabilidades via `trivy sbom`. |
| `report` | scripts Python | Consolida os achados, publica o relatório no **job summary** e envia o **email**. |

Não há upload de SARIF nem uso de GitHub Code Scanning, então **não é necessário
`security-events: write`**. O workflow usa apenas:

```yaml
permissions:
  contents: read
```

As actions de terceiros são fixadas por **SHA completo** (não por tag móvel) e os
artefatos JSON ficam disponíveis por **7 dias**.

## Onde ver o resultado

1. **Na tela:** abra a execução em **Actions → Security Analysis**. O job
   **“Relatorio consolidado e email”** escreve o relatório completo no
   **Summary** da execução, com:
   - resultado geral (sucesso/falha);
   - contagem por severidade e categoria;
   - achados bloqueadores com **arquivo/linha**, **versão atual** e **versão para
     corrigir**;
   - SBOM (componentes, licenças, serial);
   - status de cada ferramenta.
2. **No email:** enviado ao final de toda execução, com sucesso ou falha.
3. **Artefatos:** JSONs brutos e resumos de cada job, por 7 dias.

## Política de falha

Por padrão, a pipeline falha quando existe achado **ALTO** ou **CRÍTICO** em
dependências de produção, SAST, misconfiguração ou segredo.

- Para mudar o limite, crie a **variable** `FAIL_ON_SEVERITY` em
  **Settings → Secrets and variables → Actions → Variables** com um destes
  valores: `critical`, `high` (padrão), `medium`, `low` ou `off`.
- Vulnerabilidades em **devDependencies** são exibidas no relatório como
  informativas e **não bloqueiam** o deploy (ferramentas de teste/build).
  A classificação vem do campo `dev` do `package-lock.json`.

> O job de relatório envia o email **antes** de sair com código de falha. Assim,
> você recebe o resultado mesmo quando a pipeline quebra.

## Configurar o envio de email

O envio usa SMTP direto (Python `smtplib`), sem action de terceiros. Cadastre
**7 secrets** em **Settings → Secrets and variables → Actions → New repository
secret**:

| Secret | Exemplo | Obrigatório |
| --- | --- | --- |
| `SMTP_HOST` | `smtp.gmail.com` | sim |
| `SMTP_PORT` | `587` | sim |
| `SMTP_SECURITY` | `starttls` (587), `ssl` (465) ou `none` | não (detecta pela porta) |
| `SMTP_USERNAME` | `seuemail@gmail.com` | sim |
| `SMTP_PASSWORD` | senha de app / chave SMTP | sim |
| `MAIL_FROM` | `seuemail@gmail.com` | sim (precisa ser remetente autorizado) |
| `MAIL_TO` | `voce@dominio.com` | sim (aceita vários, separados por vírgula) |

### Opção A — Gmail (mais simples)

1. Ative a **verificação em duas etapas** na conta Google.
2. Acesse **Conta Google → Segurança → Senhas de app** e gere uma senha para
   “Outro (nome personalizado)”, por exemplo `github-actions-rifas`.
3. Copie os **16 caracteres** gerados (sem espaços) e use como
   `SMTP_PASSWORD`. **Não use a senha normal da conta.**
4. Valores:
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=587`
   - `SMTP_SECURITY=starttls`
   - `SMTP_USERNAME=seuemail@gmail.com`
   - `MAIL_FROM=seuemail@gmail.com`
   - `MAIL_TO=seuemail@gmail.com`

### Opção B — Brevo / SendGrid / Mailgun (SMTP transacional)

Útil se o Gmail bloquear ou se você quiser um remetente próprio.

- **Brevo:** `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`,
  `SMTP_SECURITY=starttls`, `SMTP_USERNAME=<login>`,
  `SMTP_PASSWORD=<SMTP key>`. O `MAIL_FROM` precisa ser um remetente verificado.
- **SendGrid:** `SMTP_HOST=smtp.sendgrid.net`, `SMTP_PORT=587`,
  `SMTP_USERNAME=apikey`, `SMTP_PASSWORD=<API key>`.
- **Mailgun:** `SMTP_HOST=smtp.mailgun.org`, `SMTP_PORT=587`,
  `SMTP_USERNAME=<postmaster@seu-dominio>`, `SMTP_PASSWORD=<SMTP password>`.

### Opção C — Outlook / Microsoft 365

`SMTP_HOST=smtp.office365.com`, `SMTP_PORT=587`, `SMTP_SECURITY=starttls`.
Muitos tenants desativaram autenticação básica para SMTP; se falhar, use Gmail
ou um provedor transacional.

### Testar

1. Cadastre os secrets.
2. Vá em **Actions → Security Analysis → Run workflow** (branch `main`).
3. Ao final, confira o **Summary** e a caixa de entrada. Se o email falhar, o
   relatório mostra o motivo (sem expor a senha).

> **Pull requests de fork e do Dependabot não recebem secrets** do repositório
> por segurança do GitHub. Nesses casos o relatório é publicado na tela e no
> artifact, mas o email é marcado como “não enviado”. Para PRs internos (mesmo
> repositório) o email funciona normalmente.

## Rodar as análises localmente (opcional)

```bash
# Semgrep
python3 -m pip install semgrep==1.183.0
semgrep scan --config=p/security-audit --config=p/secrets \
  --config=p/typescript --config=p/react --config=p/nextjs \
  --config=p/dockerfile --config=p/github-actions --config=p/jwt \
  --exclude=node_modules --exclude=.next --metrics=off \
  --json --output=security-results/semgrep.json
python3 .github/scripts/security/semgrep_report.py

# Trivy (binário oficial)
curl -fsSL -o trivy.tar.gz \
  https://github.com/aquasecurity/trivy/releases/download/v0.76.1/trivy_0.76.1_Linux-64bit.tar.gz
tar -xzf trivy.tar.gz trivy
./trivy fs --scanners vuln --include-dev-deps \
  --skip-dirs .git --skip-dirs node_modules --skip-dirs .next \
  --format json --output=security-results/trivy-vuln.json .
./trivy config --format json --output=security-results/trivy-config.json .
./trivy fs --scanners secret --format json \
  --output=security-results/trivy-secret.json .
python3 .github/scripts/security/trivy_report.py

# CycloneDX
npx --yes @cyclonedx/cyclonedx-npm@6.0.1 --package-lock-only \
  --output-file security-results/bom.json --spec-version 1.6 --validate
./trivy sbom --scanners vuln --format json \
  --output=security-results/sbom-vuln.json security-results/bom.json
python3 .github/scripts/security/sbom_report.py

# Relatório final + email (sem as secrets de SMTP ele apenas avisa e não envia)
GITHUB_REPOSITORY=owner/repo GITHUB_REF_NAME=main GITHUB_SHA=... \
GITHUB_RUN_ID=... GITHUB_SERVER_URL=https://github.com \
GITHUB_STEP_SUMMARY=/tmp/summary.md \
SEMGREP_RESULT=success TRIVY_RESULT=success SBOM_RESULT=success \
python3 .github/scripts/security/final_report.py
```

## Dependências de produção e overrides

- `deepmerge-ts` e `effect`, transitivos de `@prisma/config`, eram **ALTO** nas
  versões antigas. Foram corrigidos com:
  - Prisma `6.19.3` (traz `effect` `3.21.0`);
  - override `"deepmerge-ts": "8.0.2"` no `package.json`, porque o Prisma 6.x
    ainda fixa a linha 7.x.
  Ao atualizar o Prisma, confira se o override continua necessário e remova-o
  quando a versão nativa já vier corrigida (Prisma `7.10.1+`).
- Vulnerabilidades de `vitest`, `tinypool`, `esbuild`, `minimatch` e
  `@vitest/mocker` são de **desenvolvimento** e aparecem como informativas.

## Limitações

- O relatório não substitui revisão manual; regras SAST têm falsos positivos.
- O banco do Trivy é atualizado a cada execução; os resultados podem mudar sem
  alteração no código.
- O email depende de SMTP externo; sem secrets, ele é apenas sinalizado no
  relatório.
- Actions fixadas por SHA precisam ser atualizadas periodicamente (Dependabot
  pode fazer isso).
