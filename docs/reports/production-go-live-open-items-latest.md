# Pendencias de Go-live - ConcursoMestre

Data: `2026-05-31`

Status geral: `Pronto localmente para homologacao controlada; nao pronto para producao publica sem VPS/staging real`.

Este arquivo lista somente o que ainda falta provar fora do ambiente local. A base local possui gates, testes e runbook; o bloqueio atual e operacional: executar tudo em servidor real com dominio, HTTPS, credenciais e crons.

## Resumo Executivo

| Prioridade | Quantidade | Estado |
| --- | ---: | --- |
| P0 | 10 | Bloqueiam venda/go-live publico |
| P1 | 8 | Validacoes funcionais obrigatorias em staging |
| P2 | 5 | Ajustes pos-homologacao e operacao assistida |

Proxima acao recomendada: contratar/provisionar VPS de staging e executar os itens `P0-01` a `P0-10` em ordem. Sem evidencia desses 10 itens no servidor, o veredito permanece `Nao pronto`.

## P0 - Bloqueadores Antes De Vender

1. `P0-01` VPS/staging
   - Provisionar servidor com Nginx, PHP-FPM, MySQL e Node/PM2 ou systemd.
   - Publicar frontend e backend em caminhos separados.
   - Aplicar os templates de `config/deploy/` para Nginx, systemd, cron e logrotate.

2. `P0-02` Dominio e HTTPS
   - Configurar dominio final ou subdominio de staging.
   - Ativar TLS real.
   - Confirmar `APP_URL`, `CORS_ALLOWED_ORIGINS` e URLs publicas sem localhost, HTTP ou wildcard.

3. `P0-03` Ambiente e segredos
   - Configurar `.env` real do backend e variaveis do frontend.
   - Usar usuario MySQL dedicado, nunca `root`.
   - Garantir `APP_ENV=production`, `APP_DEBUG=false`, senhas fortes e secrets reais.

4. `P0-04` SMTP e e-mails
   - Configurar SMTP real.
   - Testar envio pelo painel admin.
   - Validar recebimento de confirmacao de conta, reset, recibo, falha de pagamento, renovacao, suporte, reembolso e campanha.

5. `P0-05` OAuth/reCAPTCHA
   - Configurar Google OAuth com dominio autorizado.
   - Configurar reCAPTCHA v3 real para login/cadastro/reset.
   - Facebook/Apple so devem aparecer quando SDK/chaves estiverem 100% configurados.

6. `P0-06` Stripe
   - Configurar chaves finais/teste de staging coerentes.
   - Configurar webhook publico para `api/subscriptions/stripe_webhook.php`.
   - Provar checkout, renovacao, `past_due`, cancelamento, reembolso e webhook duplicado/fora de ordem.
   - Confirmar heartbeat `stripe_webhook_health.json` recente.

7. `P0-07` Crons reais
   - Ativar `reconcile_stripe_subscriptions.php`.
   - Ativar `backup_mysql.php`.
   - Ativar `production_log_audit.php`.
   - Ativar `operational_log_alerts.php`.
   - Ativar `operational_log_maintenance.php`.
   - Ativar automacoes de marketing e expiracao de cartao quando aplicavel.
   - Confirmar locks e heartbeats recentes no painel/preflight.

8. `P0-08` Backup e restore
   - Fazer backup real no servidor.
   - Validar checksum.
   - Restaurar em banco temporario.
   - Rodar smoke apontando para o banco temporario antes de considerar rollback pronto.

9. `P0-09` Gates obrigatorios no servidor
   - Rodar `production_preflight.php`.
   - Rodar `production_smoke.php` com auth/admin obrigatorios.
   - Rodar `production_readiness_suite.php --profile=production`.
   - Rodar `staging_homologation_gate.php` em staging.
   - Rodar `vps_operations_gate.php --profile=production`.
   - Rodar `npm run check:visual-smoke -- --strict=true` contra o build publicado.

10. `P0-10` Carga e observabilidade
    - Executar carga moderada em janela controlada.
    - Monitorar MySQL, PHP-FPM, Nginx, CPU, memoria, conexoes e logs.
    - Confirmar que nao ha `Too many connections`, timeouts de IA, 401 em loop, hydration errors ou fetches duplicados criticos.

## P1 - Validacoes Funcionais Em Staging

1. `P1-01` Login/cadastro/reset
   - Cadastro com CPF/telefone obrigatorios.
   - Login comum, Google OAuth e recaptcha real.
   - Reset de senha sem carregar home intermediaria.

2. `P1-02` Questoes e pratica
   - Listagem com total correto.
   - Responder questao.
   - Questao anulada bloqueada.
   - Comentarios, reportar erro e moderacao.

3. `P1-03` Lei Comentada
   - Importar lei do Planalto.
   - Editar estrutura, capitulos, artigos e notas.
   - Gerar analise detalhada e conteudos por artigo.
   - Validar aluno: lista, leitura, progresso, favoritos por secao, comentarios, questoes relacionadas e notas inline.

4. `P1-04` Admin WordPress-like
   - Tabelas, acoes em massa, add/edit e modais principais.
   - Suporte, feedback, denuncias, comentarios, logs, campanhas, landing pages e vendedores.

5. `P1-05` Notificacoes e gamificacao
   - Deep links de notificacao.
   - XP, badges, ranking, reputacao e streak em eventos reais.
   - Alertas admin para moderacao/suporte/logs.

6. `P1-06` Assinaturas
   - Plano mensal, trimestral, anual e teste.
   - Renovacao automatica sem usuario logado.
   - Cancelamento com saldo de faturas pre-aprovadas quando aplicavel.
   - Janela de reembolso apenas nos 7 primeiros dias da primeira assinatura.

7. `P1-07` Campanhas e e-mails
   - Campanha manual.
   - Campanha automatica com dry-run.
   - Idempotencia sem envio duplicado.

8. `P1-08` Importador em massa de questoes
   - Testar com PDF oficial de banca e gabarito oficial, incluindo ENEM e concursos.
   - Confirmar que instrucoes da prova, capa, folha de resposta e avisos nao viram questoes.
   - Confirmar que o admin escolhe o foco manualmente ou cria um novo foco antes da importacao; o foco deve ser aplicado a prova e a todas as questoes.
   - Confirmar criacao do item `prova` com metadados extraidos, banca, ano, orgao/fonte, cargo/concurso, nivel, modalidade e PDF original vinculado.
   - Confirmar que textos de apoio compartilhados sao criados como contexto de questoes e vinculados as questoes corretas.
   - Confirmar extracao de alternativas A-E em provas ENEM e provas com alternativas em colunas.
   - Confirmar que imagens/figuras/tabelas do PDF ficam registradas como contexto visual da questao, com descricao e arquivo associado quando detectado.
   - Confirmar que materia, topico e assunto continuam por questao, respeitando a hierarquia da plataforma.

## P2 - Pos-homologacao

1. `P2-01` Search Console, sitemap e robots no dominio final.
2. `P2-02` Lighthouse/performance em home, dashboard, pratica, lei comentada e checkout.
3. `P2-03` Ajuste fino de rate limits com trafego real.
4. `P2-04` Monitoramento externo de uptime e alertas fora da aplicacao.
5. `P2-05` Politica final de retencao de logs, backups e dados de teste.

## Comandos De Liberacao

```bash
/usr/bin/php /var/www/questao-pro-backend/scripts/tasks/production_preflight.php
/usr/bin/php /var/www/questao-pro-backend/scripts/tasks/production_smoke.php --api-base-url=https://api.seu-dominio.com/api --web-base-url=https://app.seu-dominio.com --auth-required=true --admin-required=true
/usr/bin/php /var/www/questao-pro-backend/scripts/tasks/production_readiness_suite.php --profile=production --api-base-url=https://api.seu-dominio.com/api --web-base-url=https://app.seu-dominio.com --with-backup-rehearsal=true
/usr/bin/php /var/www/questao-pro-backend/scripts/tasks/staging_homologation_gate.php --profile=staging --api-base-url=https://api-staging.seu-dominio.com/api --web-base-url=https://staging.seu-dominio.com
/usr/bin/php /var/www/questao-pro-backend/scripts/tasks/vps_operations_gate.php --profile=production --restore-target-db=concursomestre_restore_test --notify-admins=true
cd /var/www/concursomestre && npm run check:visual-smoke -- --strict=true --base-url=https://staging.seu-dominio.com
```

## Veredito Atual

Localmente, os mecanismos de bloqueio estao prontos. Para producao publica, faltam as provas reais acima. Enquanto qualquer item P0 estiver sem evidencia no servidor, o veredito permanece `Nao pronto`.
