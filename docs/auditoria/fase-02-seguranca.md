# Fase 02 - Seguranca, autenticacao e autorizacao

**Data:** 10 de julho de 2026
**Branch/checkpoint:** 4quarenta/auditoria-fase-02-seguranca
**Escopo:** controles de identidade, autorizacao, exposicao de gabarito,
tokens, superficie administrativa e protecoes de borda. Nenhuma migration foi
executada e nada foi publicado em producao nesta fase.

## Resultado executivo

Os achados P0 confirmados na fase anterior receberam correcao no codigo:

1. O navegador nao decide mais se uma resposta esta correta nem o XP associado.
2. DTOs publicos de questoes nao incluem gabarito antes da resposta.
3. A listagem de transacoes exige sessao e impede que aluno ou staff escolham
   outro user_id.
4. O crawler legado da Gran saiu da navegacao e das entradas operacionais; os
   entrypoints antigos devolvem HTTP 410.

Tambem foram reduzidas superficies administrativas e de sessao, com escopo
proprio de staff, redacao de logs, segredos novos preferencialmente por ambiente
e rate limit compartilhado obrigatorio em producao.

## Controles implementados

| Area | Correcao | Evidencia principal |
| --- | --- | --- |
| Correcao de questoes | QuestionAnswerEvaluator resolve a resposta pelo registro canonico; is_correct do cliente e ignorado. | backend/modules/questions/services/QuestionAnswerEvaluator.php |
| Simulados | A correcao final busca o gabarito no servidor; o cliente envia apenas a alternativa escolhida. | backend/modules/simulations/services/SimulationsService.php |
| DTO publico | resposta e correctOptionIndex so saem em respostas editoriais/admin. | backend/modules/questions/services/QuestionsService.php |
| Transacoes | Sessao obrigatoria; somente admin pode consultar user_id de outro usuario. | backend/modules/transactions/routes.php |
| Staff | Conteudo proprio apenas; sem estatisticas globais, financeiro, usuarios ou escopo de aluno. | backend/modules/questions/services/QuestionsService.php, backend/modules/admin/routes.php |
| Sessao web | Access token fica em memoria; sinal entre abas nao carrega token nem perfil. | src/services/auth/session.ts |
| Rotas admin | Ausencia de sessao em /admin devolve 404 sem cache no proxy; a API continua como autoridade final de RBAC. | src/proxy.ts |
| Proxy headers | IP, HTTPS e rate limit usam X-Forwarded somente quando o IP remoto esta em AUTH_TRUSTED_PROXY_CIDRS. | backend/shared/auth/AuthConfig.php, backend/shared/middleware/RateLimiter.php |
| Logs | Contextos removem token, secret, senha, cookie e chave de API antes de persistir. | backend/shared/auth/AuthLogger.php |
| Segredos novos | Escritas novas de credenciais de integracao usam ambiente, nao banco. | backend/modules/admin/services/AdminSettingsService.php |
| Rate limit | Producao exige Redis compartilhado e falha fechada sem store configurado. | backend/shared/middleware/RateLimiter.php |
| Crawler legado | UI removida; scripts respondem 410; diretivas de borda bloqueiam scripts e diretorios internos. | backend/.htaccess, config/deploy/nginx.concursomestre.conf.example |

## Decisoes de autorizacao

| Papel | Pode | Nao pode |
| --- | --- | --- |
| Aluno | operar dados e recursos proprios | consultar transacoes de outro usuario ou receber gabarito antes da resposta |
| Staff | moderar/publicar o proprio conteudo autorizado | editar conteudo de outro autor, acessar financeiro, usuarios ou estatisticas globais |
| Admin | operar os escopos administrativos previstos | depender de controle visual do frontend para autorizar a API |

## Validacoes executadas

| Comando | Resultado |
| --- | --- |
| npm run typecheck | passou |
| npm --prefix mobile run typecheck | passou |
| npx vitest run src/services/questions/__tests__/questionService.test.ts src/services/simulations/__tests__/simulationsService.test.ts --reporter=dot | 14 testes passaram |
| npm run check:next-proxy | passou |
| npm run build | passou |
| C:\\xampp\\php\\php.exe backend\\tests\\QuestionAnswerEvaluatorTest.php | passou |
| C:\\xampp\\php\\php.exe backend\\tests\\AuthClientIpBehaviorTest.php | passou |
| C:\\xampp\\php\\php.exe backend\\tests\\RateLimiterHardeningWiringTest.php | passou |
| C:\\xampp\\php\\php.exe backend\\tests\\Phase02SecurityWiringTest.php | passou |
| C:\\xampp\\php\\php.exe backend\\tests\\BackendRootCleanupWiringTest.php | passou |
| php -l em todos os PHPs alterados | passou |
| git diff --check | sem erro de whitespace; somente avisos CRLF/LF do Git |

Os testes PHP usam este checkout, sem o caminho fixo legado do XAMPP.

## Pendencias operacionais antes de deploy

1. Provisionar Redis e configurar APP_ENV=production, RATE_LIMIT_STORE=redis,
   RATE_LIMIT_REDIS_DSN e RATE_LIMIT_REDIS_PREFIX. Sem isso, a protecao recusa
   requests em producao por seguranca.
2. Se houver proxy, configurar AUTH_TRUST_PROXY_HEADERS=true junto de
   AUTH_TRUSTED_PROXY_CIDRS com somente os IPs/CIDRs reais de Nginx,
   Cloudflare ou balanceador. Sem allowlist, os headers encaminhados ficam
   corretamente ignorados.
3. Aplicar no CloudPanel/Nginx as regras equivalentes ao template versionado:
   bloqueio de questao-pro-backend, scripts, setup, testes e diretorios internos.
4. Rotacionar as chaves historicamente gravadas em system_settings depois de
   validar as variaveis de ambiente. Nao apagar valores antigos antes da nova
   configuracao estar confirmada.
5. Executar em staging uma matriz com aluno, staff e admin para login, refresh,
   logout, 2FA, OAuth, respostas, simulados, transacoes, moderacao e upload.
6. A varredura npm audit --omit=dev encontrou 7 vulnerabilidades de producao:
   5 altas e 2 moderadas. As diretas mais relevantes sao next 16.2.4 e axios
   1.15.2; o audit indica correcao sem major em next 16.2.10 e versao corrigida
   de axios. Tratar a atualizacao e os transitivos protobufjs, form-data e ws
   na Fase 10, com build e regressao completos.

## Rollback

Reverter apenas o commit desta fase em ambiente controlado. Nao usar reset
destrutivo. Antes de reverter qualquer parte do rate limit, confirmar Redis,
logs de 429/500 e a configuracao de proxy para nao reduzir a protecao de
autenticacao acidentalmente.

## Arquivos mais relevantes

- backend/modules/questions/services/QuestionAnswerEvaluator.php
- backend/modules/questions/services/QuestionsService.php
- backend/modules/simulations/services/SimulationsService.php
- backend/modules/transactions/routes.php
- backend/shared/auth/AuthConfig.php
- backend/shared/auth/AuthLogger.php
- backend/shared/middleware/RateLimiter.php
- src/proxy.ts
- src/services/auth/session.ts
- config/deploy/nginx.concursomestre.conf.example
