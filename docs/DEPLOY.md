# Implantação, operação e backup

Este documento cobre a implantação em produção com Docker Compose, HTTPS, migrações, criação de administradores, backup e restauração. Para desenvolvimento local, consulte o `README.md`.

## Pré-requisitos

- Docker Engine 24+ com Compose v2
- Domínio apontando para o servidor (recomendado para HTTPS)
- Portas 80/443 liberadas apenas para o proxy TLS
- Pelo menos 2 GB de RAM e 10 GB de disco para app + banco

## 1. Configurar o ambiente

```bash
cd /opt/rifas
cp .env.docker.example .env.docker
```

Edite `.env.docker`:

- `POSTGRES_PASSWORD`: senha forte do banco.
- `DATABASE_URL`: mesma senha, host `db`, banco `rifas`.
- `AUTH_SECRET`: gere com `openssl rand -base64 48`.
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`: administrador inicial.

O arquivo `.env.docker` contém segredos e já está no `.gitignore`. Nunca o versione nem o inclua em imagens.

## 2. Subir a stack

```bash
docker compose up -d --build
```

O Compose executa nesta ordem:

1. `db`: PostgreSQL 16 com volume persistente `rifas_pgdata`.
2. `migrate`: aplica `prisma migrate deploy` e roda o seed do administrador. É um serviço one-shot; terminar com código 0 é o esperado.
3. `app`: imagem standalone do Next.js, exposta apenas em `127.0.0.1:3000`. O proxy TLS do host encaminha para ela.

Verifique:

```bash
docker compose ps
docker compose logs -f migrate
docker compose logs -f app
curl -sS http://127.0.0.1:3000/api/health
```

Resposta esperada: `{"status":"ok","database":"ok"}`.

O seed é idempotente: se o e-mail já existe, nada é alterado. A senha do administrador **não** é atualizada pelo seed em execuções seguintes.

## 3. HTTPS

O cookie de sessão usa `Secure` automaticamente quando o proxy envia `X-Forwarded-Proto: https` (ou `Origin` HTTPS). Se o proxy TLS não enviar esses headers, defina `COOKIE_SECURE=true` no `.env.docker`. Em produção, acesse sempre por HTTPS; acesso por IP em HTTP é apenas para testes e não deve ser exposto na internet.

Exemplo com Caddy no host, encaminhando para o app:

```caddyfile
rifas.exemplo.com {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3000
}
```

Com Nginx:

```nginx
server {
  listen 443 ssl http2;
  server_name rifas.exemplo.com;

  ssl_certificate     /etc/letsencrypt/live/rifas.exemplo.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/rifas.exemplo.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 80;
  server_name rifas.exemplo.com;
  return 301 https://$host$request_uri;
}
```

Mantenha a porta 3000 fechada no firewall, ou publique apenas em `127.0.0.1` no Compose. O rate limit de login usa `X-Forwarded-For`/`X-Real-IP`; o proxy deve enviar esses headers.

## 4. Administradores

Criar outro administrador ou redefinir a senha de um existente:

```bash
docker compose run --rm --entrypoint sh migrate \
  -c 'npx tsx prisma/create-admin.ts admin@dominio.com "NovaSenhaForte" "Nome do Admin"'
```

O comando faz upsert por e-mail. A senha deve ter 10+ caracteres.

Se o administrador inicial não tiver sido criado porque as variáveis `ADMIN_*` estavam vazias, preencha o `.env.docker` e rode:

```bash
docker compose run --rm migrate
```

## 5. Atualizações e migrações

Sempre faça backup antes de atualizar.

```bash
docker compose build
docker compose up -d db
docker compose run --rm migrate
docker compose up -d app
docker compose ps
curl -sS https://rifas.exemplo.com/api/health
```

Se `migrate` falhar, o app não deve ser promovido. O serviço `migrate` do Compose impede o start do app quando executado via `docker compose up`; nos comandos manuais acima, verifique o código de saída antes de subir o app.

Nunca use `prisma migrate dev` ou `prisma migrate reset` em produção: eles podem apagar dados. Use apenas `prisma migrate deploy`.

## 6. Backup

### Backup manual

```bash
mkdir -p /var/backups/rifas
docker compose exec -T db pg_dump -U rifas -d rifas -Fc \
  | gzip > "/var/backups/rifas/rifas-$(date +%F-%H%M).dump.gz"
```

### Backup diário com cron

```cron
0 3 * * * cd /opt/rifas && docker compose exec -T db pg_dump -U rifas -d rifas -Fc | gzip > /var/backups/rifas/rifas-$(date +\%F).dump.gz
```

Defina retenção (por exemplo, 30 diários + 12 mensais) e copie os arquivos para outro servidor ou storage externo. Backup no mesmo disco do banco não protege contra falha de hardware.

### Testar a restauração

Sempre valide o backup em um banco separado:

```bash
docker compose exec db createdb -U rifas rifas_restore
gunzip -c /var/backups/rifas/rifas-2026-10-29.dump.gz \
  | docker compose exec -T db pg_restore -U rifas -d rifas_restore --no-owner
docker compose exec db psql -U rifas -d rifas_restore -c \
  'SELECT (SELECT count(*) FROM "Rifa") AS rifas, (SELECT count(*) FROM "Reserva") AS reservas;'
docker compose exec db dropdb -U rifas rifas_restore
```

### Restaurar em produção

Pare o app para evitar escritas durante a restauração:

```bash
docker compose stop app
docker compose exec db psql -U rifas -d postgres -c 'DROP DATABASE rifas WITH (FORCE);'
docker compose exec db psql -U rifas -d postgres -c 'CREATE DATABASE rifas OWNER rifas;'
gunzip -c /var/backups/rifas/rifas-2026-10-29.dump.gz \
  | docker compose exec -T db pg_restore -U rifas -d rifas --no-owner
docker compose run --rm migrate
docker compose up -d app
```

Depois, confira o health check, o login e a contagem de rifas/reservas.

## 7. Operação

- **Logs**: `docker compose logs -f app` e `docker compose logs -f db`.
- **Restart**: `docker compose restart app`.
- **Health check**: `GET /api/health` valida a conexão com o banco.
- **Disco**: monitore o volume `rifas_pgdata` e os backups. A auditoria cresce com o uso.
- **Relógio**: mantenha NTP ativo no host; datas e auditoria dependem disso.
- **Senha do banco**: para rotacionar, altere no PostgreSQL (`ALTER USER rifas WITH PASSWORD ...`), atualize `.env.docker` e recrie `app`/`migrate`.

## 8. Implantação sem Docker

```bash
cp .env.example .env
# edite DATABASE_URL, AUTH_SECRET e ADMIN_*
npm ci
npm run db:deploy
npm run db:seed
npm run build
NODE_ENV=production PORT=3000 npm start
```

Exemplo de unit systemd:

```ini
[Unit]
Description=Sistema de Rifas
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=suporte
WorkingDirectory=/opt/rifas
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/opt/rifas/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Coloque o Nginx/Caddy na frente e aplique HTTPS. O app não deve ficar exposto diretamente na internet sem TLS.

## 9. Checklist de segurança

- [ ] `AUTH_SECRET` aleatório, com 32+ caracteres, diferente do desenvolvimento.
- [ ] Senha forte no PostgreSQL e no administrador.
- [ ] HTTPS ativo e HTTP redirecionando para HTTPS.
- [ ] Porta 3000 fechada externamente; acesso apenas pelo proxy.
- [ ] `.env`, `.env.docker` e backups com permissão restrita.
- [ ] Backup diário testado e cópia externa.
- [ ] Migrações aplicadas com `migrate deploy` antes de subir o app.
- [ ] Monitoramento do health check e do disco.
- [ ] Acesso administrativo removido de quem não precisa.
- [ ] Rate limit distribuído se houver mais de uma réplica (ver limitações em `ARCHITECTURE.md`).
- [ ] Plano de atualização do Prisma 7 para resolver os advisories da CLI do Prisma 6 (ver limitações em `ARCHITECTURE.md`).
