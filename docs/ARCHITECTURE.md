# Arquitetura e decisões técnicas

## Visão geral

Aplicação monolítica Next.js com renderização no servidor e operações de escrita via Server Actions. Não há API pública separada: as páginas leem dados diretamente pelo Prisma em Server Components, e as mutações passam por Server Actions que validam, autorizam, executam regras de negócio e revalidam a rota.

```text
Navegador
  │  formulário / clique
  ▼
Server Action  ── validação Zod ── sessão ── rate limit
  │
  ▼
Service (transação Prisma)
  │  regras, locks, constraints, auditoria
  ▼
PostgreSQL
```

Leituras usam `src/server/queries.ts`; escritas usam `src/server/services/`. Componentes de UI não acessam o banco.

## Camadas

| Camada | Responsabilidade |
| --- | --- |
| `src/app` | Rotas, layouts, páginas e estados de erro. |
| `src/components` | UI reutilizável, formulários, modais, grade de números e painéis. |
| `src/server/actions` | Entrada das mutações, parsing de `FormData`, validação Zod, sessão e revalidação. |
| `src/server/services` | Regras de negócio, transações, locks e auditoria. |
| `src/server/queries.ts` | Consultas de leitura, agregações e tipos de tela. |
| `src/lib` | Sessão, validação, formatação, erros, rate limit e cliente Prisma. |
| `prisma` | Schema, migrações e seed. |

## Autenticação e autorização

- Login por e-mail/senha, com bcrypt custo 12 e comparação de hash fictício quando o usuário não existe (reduz diferença de tempo).
- Rate limit de 5 tentativas por IP + e-mail em janela de 15 minutos. O contador é em memória do processo.
- Sessão JWT assinada com `jose` HS256, prazo de 7 dias, cookie `rifas_session` httpOnly, `SameSite=Lax` e `Secure` quando a requisição é HTTPS (`X-Forwarded-Proto`/`Origin`) ou quando `COOKIE_SECURE=true`.
- `middleware.ts` protege todas as rotas, exceto `/login` e `/api/health`, e redireciona usuários autenticados para fora do login.
- O layout autenticado chama `requireSession`, que valida o token e confirma que o administrador ainda existe no banco.
- Toda Server Action chama `requireSession` antes de mutar dados.

## Modelo de dados

- **AdminUser**: administradores; e-mail único.
- **Rifa**: configuração, status (`RASCUNHO`, `ABERTA`, `ENCERRADA`, `SORTEADA`) e datas.
- **Participante**: nome e telefone. É criado junto com cada reserva; o mesmo nome pode existir em reservas diferentes.
- **Reserva**: agrupamento de números de um participante em uma rifa, com status de pagamento, valor total cobrado e observações.
- **NumeroReservado**: um registro por número; `@@unique([rifaId, numero])` é a garantia física de que um número não é vendido duas vezes.
- **Sorteio**: um por rifa (`rifaId @unique`), com número vencedor, participante, data/hora, quantidade elegível e snapshot dos números elegíveis.
- **Auditoria**: quem fez, quando, qual ação, entidade, valores anteriores e novos. A rifa pode ser removida sem apagar o histórico (`onDelete: SetNull`), mas o usuário autor é preservado (`Restrict`).

### Invariantes no PostgreSQL

- `quantidadeNumeros` entre 1 e 500.
- `valorNumero` maior que zero.
- `valorCobrado` maior ou igual a zero.
- Número reservado positivo e único por rifa.
- Um único sorteio por rifa.

As constraints são a última linha de defesa; a aplicação valida antes para produzir mensagens melhores.

## Reservas e pagamentos

- O organizador seleciona vários números; o servidor remove duplicatas, ordena e valida o intervalo da rifa.
- A transação bloqueia a rifa com `SELECT ... FOR SHARE` para impedir alteração concorrente da quantidade.
- Números ocupados são verificados antes da criação, mas a constraint única resolve a corrida entre duas reservas simultâneas. O erro P2002 é convertido em mensagem de número ocupado.
- `valorCobrado` é calculado no servidor (`quantidade × valorNumero`), nunca aceito do navegador.
- O pagamento é por reserva (todo o grupo), não por número individual. Marcar como pago registra `pagoEm`; voltar para pendente limpa a data.
- Liberar uma reserva apaga o grupo e seus números dentro de uma transação, após gravar um snapshot completo na auditoria. Reservas de rifa sorteada não podem ser liberadas nem editadas.
- Não há expiração automática de reserva: números só voltam a ficar disponíveis por liberação manual.
- A pesquisa de reservas aceita nome parcial ou número exato, tanto na busca global quanto na lista de participantes de uma rifa. A grade pode ocultar números reservados sem alterar a seleção dos disponíveis.

## Sorteio

O sorteio é definitivo e executado inteiramente no servidor:

1. Transação com isolamento `Serializable`.
2. `SELECT ... FOR UPDATE` na rifa, serializando sorteios concorrentes.
3. Rejeição de rifa inexistente, em rascunho, já sorteada ou com sorteio existente.
4. Leitura dos números de reservas com pagamento `PAGO`; se não houver nenhum, o sorteio é recusado.
5. `crypto.randomInt(0, quantidadeElegivel)` escolhe uniformemente um índice entre os números elegíveis.
6. Criação do `Sorteio` com o conjunto elegível, atualização da rifa para `SORTEADA` e registro de auditoria na mesma transação.
7. Erros de serialização (P2034) são repetidos até 3 vezes; violação da unicidade é reportada como sorteio já realizado.

O navegador não envia nem escolhe o número. **Somente números de reservas pagas concorrem**; reservas pendentes continuam ocupando o número, mas ficam fora do sorteio. A alteração de pagamento roda em transação `Serializable` para conflitar com um sorteio concorrente, e o pagamento da reserva vencedora não pode ser alterado após o sorteio.

O resultado do sorteio é imutável. Após o sorteio, o status não pode ser alterado pelas operações comuns e a reserva vencedora não pode ser editada ou liberada. Os demais metadados da rifa ainda podem ser ajustados, e a quantidade de números só pode crescer (nunca abaixo do maior número reservado). Se for necessário congelar toda a rifa após o sorteio, essa regra deve ser adicionada em `atualizarRifa`.

## Dinheiro, datas e fuso

- Valores são inteiros em centavos no banco (`valorNumero`, `valorCobrado`) para evitar erros de ponto flutuante. A conversão para reais acontece apenas na formatação.
- A entrada `R$ 1.234,56` é convertida para `123456` no servidor, com limite de R$ 1.000.000,00 por número.
- Datas de formulário (`datetime-local`) são interpretadas como horário de `America/Sao_Paulo` (offset `-03:00`) antes de serem salvas em UTC.
- A exibição usa `Intl.DateTimeFormat` com `APP_TIMEZONE`, padrão `America/Sao_Paulo`.

## Auditoria

Ações registradas: criação/edição/status de rifa, criação/edição/liberação de reserva, alteração de pagamento e sorteio. O registro inclui usuário, data/hora, entidade, id e snapshots anteriores/novos quando aplicável.

A auditoria é gravada na mesma transação da mutação: se a operação falhar, o registro não permanece. A tela de auditoria é somente leitura.

## Segurança

- Validação Zod no servidor para todos os formulários; mensagens amigáveis sem expor detalhes internos.
- Sessão httpOnly + SameSite=Lax e verificação de origem embutida nas Server Actions do Next.js.
- Headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` e desativação do header `X-Powered-By`.
- `AUTH_SECRET` obrigatório e validado; nenhum segredo é enviado ao cliente.
- Consultas parametrizadas pelo Prisma; os poucos trechos de SQL usam template parametrizado.
- Sem upload de arquivos, sem HTML rico e sem integração de pagamento, reduzindo a superfície de ataque.

## Limitações conhecidas

- **Rate limit em memória**: com múltiplas réplicas, cada instância tem seu contador. Para escala horizontal, usar Redis ou rate limit no proxy.
- **Sessão sem revogação central**: desativar um usuário no banco invalida o acesso na próxima requisição, mas trocar a senha não invalida tokens já emitidos. Para revogação imediata, incluir versão de sessão no usuário.
- **Sem expiração de reserva**: reservas pendentes permanecem até liberação manual.
- **Sem página pública de rifa**: a operação é exclusiva do administrador; não há autoatendimento para o participante.
- **Sem pagamento online**: o status é controlado manualmente pelo organizador.
- **Edição pós-sorteio**: número vencedor e reserva vencedora são imutáveis, mas os demais campos da rifa ainda podem ser editados.
- **Auditoria sem UI de filtros avançados**: a listagem é por rifa/histórico, sem exportação.
- **Avisos de dependência do Prisma 6**: o `npm audit` reporta advisories na cadeia de CLI/config do Prisma 6 (`@prisma/config`, `effect`, `deepmerge-ts`). A correção exige Prisma 7, que muda o gerador e a configuração do client; a atualização deve ser feita com regressão completa de migrações, testes e Docker. Não execute `npm audit fix --force` em produção sem esse plano. O client de consulta usado em runtime não executa esses componentes de CLI.

## Extensões naturais

- Página pública por rifa com reserva pelo participante.
- Expiração automática de reservas pendentes e job de limpeza.
- Gateway de pagamento (Pix/cartão) com webhook idempotente.
- Exportação CSV/PDF de participantes e prestação de contas.
- Notificações por WhatsApp/e-mail.
- Rate limit distribuído e trilha de auditoria com exportação.
