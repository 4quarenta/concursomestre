# R6.2 - Integracao seletiva da R6.1

Data: 17/07/2026
Branch: `1.0.0`
Base preservada: `294fff839a56a04a5099b70bb9a407eccaf64cc8`
Pacote avaliado: `Kit_revisao_ConcursoMestre_R6_1 (1).zip`
Checkpoint local: `C:\dev\concursomestre-r62-checkpoint-20260716-232736`

## Veredito

- **R6.1 integral:** REPROVADA. Nao deve ser sobreposta a arvore atual.
- **R6.2 seletiva:** GO para staging controlado.
- **Producao:** HOLD ate deploy em staging, smoke HTTP autenticado e janela de mudanca aprovada. Nenhum deploy de producao foi executado nesta integracao.

## Metodo de comparacao

Foi feita comparacao normalizada de fim de linha entre a base atual, a arvore final e a R6.1. A matriz completa esta em `docs/auditoria/r6-2-comparacao-arquivos.csv` e cobre 1.634 caminhos.

| Estado | Arquivos |
|---|---:|
| Identicos nas tres arvores | 588 |
| Adotados exatamente da R6.1 | 27 |
| Novos adotados exatamente | 2 |
| Novos incorporados seletivamente | 7 |
| Mesclados ou divergentes por preservacao da base | 86 |
| Mudancas da R6.1 rejeitadas | 659 |
| Novos da R6.1 nao adotados | 157 |
| Remocoes propostas pela R6.1 rejeitadas | 92 |
| Arquivos atuais alterados que a R6.1 removeria | 4 |
| Arquivos novos exclusivos da arvore atual | 12 |

## Incorporado

### Dependencias e CI

- Next.js e `eslint-config-next` 16.2.10, Axios 1.18.1, Vitest 3.2.7 e override PostCSS 8.5.19.
- Node minimo 20.19 e lock npm regenerado. O projeto permanece npm-only.
- Composer travado com PHPMailer 7.1.1, FPDI 2.6.8, TCPDF 6.11.3 e Stripe PHP 17.6.0.
- Workflow PHP dedicado em `.github/workflows/backend-ci.yml`.
- Validacao estrita de Composer, auditoria npm/Composer, scanner de segredos, encoding e artefatos gerados.

### Backend e seguranca

- Resolver seguro e testavel para logs administrativos.
- Uploads com negacao de execucao e arquivos de configuracao fora da area publica.
- Preflight de producao com allowlist explicita.
- Exemplo de ambiente de producao sanitizado.
- Ingestao privada reorganizada em rotas canonicas, mantendo HMAC, nonce e idempotencia.
- Bridge de feedback editorial reduzida a rota fina, com servico e testes proprios.
- Remocao de readiness DDL de assinatura no caminho normal de requisicao.
- Correcao da autorizacao de conteudo premium da Lei Comentada.

### Sessao e financeiro preservados da Fase 02

- DTO canonico de sessao e fluxo de login sem `/auth/me.php` redundante foram mantidos.
- Status de pagamento continua fora do DTO global em `/api/v2/users/me/billing/payment-status.php`.
- Banner financeiro usa estado autoritativo, sem interpretar request ausente ou com erro como falta de cartao.
- Compatibilidade Stripe Basil para invoices via `payments`, sem depender do antigo `payment_intent` expandido.
- Renovacao, prorrata, reembolso concorrente e webhooks foram exercitados contra Stripe em modo de teste.

### Produto

- Validade de parcelamento do cartao centralizada e coberta por teste.
- Oferta de plano e fallback de landing page preservados sem regressao da sessao.
- Feedback editorial de questoes ganhou migration e contrato canonico.
- Scanner de encoding passou a usar `backend/`, nao um caminho XAMPP externo, e deixou de remover a letra legitima `Â`.
- Textos corrompidos ativos do Banco de Provas, importador e servicos PHP foram corrigidos.

## Migrations incorporadas

1. `20260716_010000_transactions_provider_identity_unique.php`
   - adiciona unicidade da identidade da transacao no provedor;
   - rollback remove apenas o indice unico criado pela migration.
2. `20260716_020000_question_editorial_feedback.php`
   - cria a tabela de feedback editorial de questoes;
   - rollback remove somente a tabela criada.

As duas foram aplicadas em banco MySQL isolado, registradas com checksum e repetidas em `--dry-run`, que retornou `pending_count: 0`. Nenhuma migration foi aplicada no banco de producao.

## Rejeitado da R6.1

- Baseline destrutiva e migrations paralelas de 13 a 15/07 que competiam com o historico real.
- Nova pilha paralela de DTOs e leitura v2 de questoes, que duplicaria os contratos canonicos atuais.
- Fila Stripe e ledger financeiro paralelos sem homologacao de migracao, rollback e conciliacao.
- Modulo privado de ingestao duplicado ao fluxo HMAC existente.
- Manifestos e scripts que declaravam release pronta sem executar PHP, MySQL e Stripe reais.
- Remocao de 92 migrations, seeds, rotas canonicas, crawler, sitemap e documentacao historica.
- Alegacoes do pacote de "zero warnings" e suite PHP completa, nao comprovadas pelo conteudo recebido.

## Removido ou substituido na arvore final

- `pnpm-lock.yaml` e `pnpm-workspace.yaml` do pacote nao foram mantidos; npm e a fonte unica.
- Log direto do objeto completo do importador no console foi removido; o mini console controlado permanece.
- Inicializacao duplicada do alias de webhook foi substituida por bridge documentada para `stripe_webhook.php`.
- Regras de encoding com caminho XAMPP e remocao indiscriminada de `Â` foram substituidas.
- A bridge monolitica de feedback editorial foi substituida por rotas e servico dedicados.

## Validacoes executadas

| Gate | Resultado |
|---|---|
| `npm audit --json` | 0 vulnerabilidades em 784 dependencias |
| `npm run typecheck` | OK |
| `npm test -- --reporter=dot` | 421/421 testes OK |
| `npm run lint` | OK, 0 erros e 57 warnings legados |
| `npm run build` | OK, 41 paginas geradas |
| Testes focados de edital/importador | 75/75 testes OK |
| `npm run check:text-encoding` | OK |
| `npm run check:secrets` | OK |
| `npm run check:generated-artifacts` | OK |
| `git diff --check` | OK |
| PHP lint na VPS isolada | 666/666 arquivos OK |
| Suite PHP deterministica | 113/113 testes OK |
| `composer validate --strict` | OK |
| `composer audit --locked` | 0 advisories |
| Migrations `--dry-run` | 0 pendentes |
| Stripe operacional | GO, 7/7 cenarios |

Os sete cenarios Stripe foram: renovacao ponta a ponta, auto-renew off/on, upgrade com pro-rata, reembolso concorrente, webhook duplicado, webhook fora de ordem e webhook atrasado com reconciliacao.

## Excecao tecnica registrada

`src/app/admin/components/import/useAdminImportWorkflow.ts` possui aproximadamente 13,6 mil linhas. As regras de analise global do React Compiler esgotavam memoria no lint. O `eslint.config.mjs` desativa somente essas regras de analise global para esse arquivo; regras de hooks, dependencias, TypeScript e o restante do ESLint continuam ativas. A divisao desse arquivo permanece divida tecnica, nao bloqueio da R6.2.

## Rollback operacional

1. Restaurar o checkpoint local ou reverter o futuro commit da R6.2.
2. Executar o rollback das duas migrations somente em ordem inversa e apos backup.
3. Restaurar `package-lock.json` e `composer.lock` da base se houver incompatibilidade de runtime.
4. Invalidar caches da aplicacao apos rollback.
5. Executar novamente typecheck, build, suite PHP e smoke HTTP.

## Segredos e producao

- Nenhum segredo novo foi versionado; o scanner oficial e uma busca independente encontraram apenas chaves ficticias de testes.
- O banco temporario e a arvore de validacao usam ambiente isolado.
- O banco temporario `cmr6207170400`, a arvore de validacao e os relatorios temporarios da VPS foram removidos ao final.
- O codigo e o banco de producao nao foram alterados.
- A aprovacao para producao depende de staging real, smoke HTTP autenticado, backup e janela de mudanca.
