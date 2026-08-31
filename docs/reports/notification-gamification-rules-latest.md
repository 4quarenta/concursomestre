# Matriz de Notificacoes e Gamificacao

Data: `2026-05-01`

## Estado atual

Correcoes aplicadas nesta auditoria:

- Notificacoes apagadas logicamente deixam de aparecer na listagem.
- Schema de notificacoes agora e garantido em bancos criados pelo SQL antigo.
- Admins sao notificados quando entram comentarios pendentes, denuncias, feedback/respostas de usuario e materiais pendentes.
- Moderacao de comentarios notifica o autor quando aprova, marca como spam ou remove.
- Comentarios aprovados disparam notificacoes sociais para autor do comentario pai ou dono do material, quando aplicavel.
- Respostas a questoes atualizam `user_streaks` e concedem badges idempotentes em `user_badges`.
- Espelho de cartao Stripe evita duplicidade local quando o mesmo cartao volta com outro PaymentMethod.
- Falha de cobranca Stripe (`past_due`) notifica o aluno e agora tambem todos os admins ativos com link para financeiro.
- Renovacao Stripe roda por cron CLI independente de sessao do usuario; recibos, falhas e lembretes usam e-mail + notificacao in-app quando aplicavel.
- Renovacao Stripe confirmada por invoice paga agora usa notificacao in-app especifica de `Assinatura renovada`, com valor e novo ciclo quando disponiveis; a tela de assinatura recarrega as notificacoes quando a sincronizacao materializa uma invoice.
- Lembrete de 5 dias so existe para ciclos maiores que 5 dias; ciclos curtos usam o aviso de renovacao no dia seguinte.
- Webhook Stripe grava heartbeat privado (`stripe_webhook_health.json`) em eventos validos e exposto como `webhook_health` no admin/preflight, para detectar quando notificacoes financeiras deixam de chegar por falha de endpoint ou segredo.
- E-mails transacionais passaram a depender de um resolvedor unico de SMTP (`shared/utils/MailConfiguration.php`) e o preflight de producao reprova SMTP/remetente/templates essenciais ausentes, reduzindo risco de regras de notificacao ficarem sem canal de e-mail no go-live.
- Reembolso de assinatura pendente agora gera notificacao in-app para todos os admins ativos, com link direto para a transacao.
- Eventos de analytics agora ignoram `userId` enviado pelo cliente, usam o usuario autenticado da sessao quando existir e ficam rate-limited para reduzir ruido em campanhas e funis.
- Avaliacao da plataforma exige dados publicos separados, notifica admin como feedback e so entra na home apos aprovacao administrativa com campos completos.
- Compras e reembolsos de materiais do marketplace agora notificam comprador, vendedor e admins quando a venda e liberada, entra em analise de reembolso ou e estornada; venda/aprovacao/reembolso tambem passam por ledger idempotente de gamificacao.
- Comentarios aprovados, spam/trash, curtidas recebidas, denuncias aceitas e resultados de rankings agora tambem usam `user_gamification_events` para XP/reputacao/badges sem duplicidade.
- Denuncias resolvidas pelo admin notificam o usuario denunciante com o resultado da moderacao.
- Respostas administrativas em feedback/suporte notificam o dono da conversa no app e apontam para `/support?threadId=...`, abrindo a conversa correta no frontend.
- Rankings agora exigem usuario autenticado para criar/enviar gabarito, ignoram `userId` vindo do cliente, notificam admins sobre rankings pendentes, avisam o criador sobre aprovacao/rejeicao, notificam o participante no primeiro envio e avisam participantes quando o gabarito oficial e publicado.
- Campanhas automaticas ganharam executor CLI idempotente com dry-run, lock de cron, tabela `marketing_automation_events`, selecao de usuarios por condicoes e envio por notificacao/e-mail conforme a regra.

## Regras esperadas

| Evento | Destinatario | Canal | Persistencia | Gamificacao | Estado |
| --- | --- | --- | --- | --- | --- |
| Usuario cria conta | Usuario | In-app/email | `notifications` + email | XP inicial opcional | Parcial |
| Email confirmado | Usuario | In-app | Auth retorna `newXp` | XP por confirmacao | Parcial |
| Usuario responde questao correta | Usuario | UI imediata + in-app quando badge/streak | `user_answers`, `question_stats`, `users.xp`, `user_streaks`, `user_badges` | +10 XP, possivel level up, streak e badge | Corrigido local |
| Usuario responde questao errada | Usuario | UI imediata + in-app quando badge/streak | `user_answers`, `question_stats`, `users.xp`, `user_streaks`, `user_badges` | +2 XP, streak e badge | Corrigido local |
| Level up | Usuario | In-app | `notifications` | bonus plano/dias | OK local |
| Streak diario | Usuario | In-app em marcos | `user_streaks`, `notifications` | 3/7/15/30 dias | Corrigido local |
| Badge por meta de questoes | Usuario | In-app | `user_badges`, `notifications` | primeira resposta, 10 acertos, 100 respostas, streaks | Corrigido local |
| Ranking criado pela comunidade | Admin | In-app | `notifications`, `rankings.created_by_user_id` | nenhum | Corrigido local |
| Ranking aprovado/rejeitado | Criador | In-app | `notifications`, `rankings.status`, `user_gamification_events`, `user_badges` | se aprovado: +25 XP, +1 reputacao e badge de ranking aprovado | Corrigido local |
| Participacao em ranking registrada | Usuario | In-app | `ranking_entries`, `notifications`, `user_gamification_events`, `user_badges` | +20 XP e badge de primeiro ranking | Corrigido local |
| Ranking com gabarito oficial publicado | Participantes | In-app | `ranking_entries`, `notifications`, `user_gamification_events`, `user_badges` | XP por participacao consolidada; top 10/top 3/1o lugar recebem reputacao e badges | Corrigido local parcial |
| Comentario enviado | Admin | In-app | `notifications` | nenhum | Corrigido |
| Comentario aprovado | Autor | In-app | `notifications`, `user_gamification_events`, `user_badges` | +10 XP, +1 reputacao e badge de primeiro comentario aprovado | Corrigido local |
| Comentario marcado como spam/trash | Autor | In-app | `notifications`, `user_gamification_events` | -3 reputacao idempotente por comentario | Corrigido local |
| Resposta a comentario | Autor do comentario pai | In-app | `notifications` | reputacao opcional | Corrigido local apos aprovacao |
| Like em comentario | Autor do comentario | In-app | `notifications`, `comment_likes`, `user_gamification_events`, `user_badges` | +2 XP, +1 reputacao e badge de primeira curtida recebida | Corrigido local |
| Denuncia criada | Admin | In-app | `notifications`, `reports` | nenhum | Corrigido |
| Denuncia resolvida | Reporter | In-app | `notifications`, `user_gamification_events`, `user_badges` | se aceita: +15 XP, +1 reputacao e badge de denuncia aceita | Corrigido local |
| Feedback criado | Admin | In-app | `notifications`, `user_feedback` | nenhum | Corrigido |
| Avaliacao da plataforma enviada | Admin | In-app | `notifications`, `user_feedback.public_*` | nenhum | Corrigido local |
| Avaliacao da plataforma aprovada para home | Visitantes | Home publica | `user_feedback.status=resolved`, `home_published_at` | nenhum | Corrigido local parcial |
| Admin responde feedback | Usuario | Email + in-app | email + `notifications` | nenhum | Corrigido local |
| Material enviado | Autor + admin | In-app | `notifications`, `materials` | vendedor opcional | Corrigido |
| Material aprovado | Autor | In-app | `notifications`, `user_gamification_events`, `user_badges` | +30 XP, +1 reputacao e badge de primeiro material aprovado | Corrigido local parcial |
| Material rejeitado | Autor | In-app | `notifications` | nenhum | Corrigido local parcial |
| Compra de material | Comprador/vendedor/admin | In-app | `transactions`, `notifications`, `user_gamification_events`, `user_badges` | comprador +25 XP/badge inicial; vendedor +50 XP, +2 reputacao e badge de primeira venda | Corrigido local parcial; falta Stripe sandbox |
| Assinatura aprovada | Usuario | In-app/email | `user_subscriptions`, `transactions` | badge premium opcional | Parcial |
| Assinatura renova em 5 dias | Usuario | In-app/email | `user_subscriptions.renewal_reminder_sent_for` | nenhum | Corrigido local; apenas ciclos maiores que 5 dias |
| Assinatura renova amanha | Usuario | In-app/email | `user_subscriptions.renewal_reminder_sent_for` | nenhum | Corrigido local |
| Assinatura `past_due` | Usuario/admin | In-app/email | subscription status | nenhum | Corrigido local parcial |
| Cancelamento solicitado | Usuario/admin | In-app/email | subscription/transaction | nenhum | Parcial |
| Reembolso solicitado | Admin/vendedor | In-app/email admin | transaction status | nenhum | Corrigido local |
| Reembolso concluido | Usuario/vendedor/admin | In-app/email usuario | transaction status, `user_gamification_events` | vendedor -2 reputacao idempotente quando for material | Corrigido local parcial; falta gateway real |
| Campanha segmentada | Segmento alvo | In-app/email/banner | `marketing_automation_events` | nenhum | Corrigido local parcial |
| Evento de analytics de campanha/landing | Admin/marketing em relatorio | Dashboard/log operacional | `analytics_events` | nenhum | Parcial local; identidade do usuario blindada, falta relatorio de funil |

## Regras tecnicas recomendadas

- Para gamificacao de marketplace, `user_gamification_events` ja registra eventos idempotentes com `event_key`, XP, reputacao, badge e metadata.
- Para notificacoes/e-mail/ranking futuros, ainda vale evoluir para uma tabela `platform_events` ou `event_outbox` geral.
- Cada evento deve ter `event_key`, `actor_user_id`, `target_user_id`, `target_type`, `target_id`, `payload_json`, `status`, `created_at`, `processed_at`.
- Notificacao, XP, badge, email e ranking devem ser consumidores do evento, nao logica espalhada em cada service.
- Cada regra precisa de chave idempotente, por exemplo `question_answer:{answer_id}:xp`.
- Admin notifications devem usar links canonicos: `/admin/support/comments`, `/admin/support/reports`, `/admin/support/feedback`, `/admin/marketplace/materials`, `/admin/financial/refunds`, `/admin/financial/transactions`.
- Enquanto o `event_outbox` nao existir, regras novas devem ser idempotentes no proprio storage, como `PRIMARY KEY (user_id, badge_key)` em `user_badges`.

## Testes minimos por evento

- Evento cria exatamente uma notificacao por destinatario.
- Reprocessamento do mesmo evento nao duplica XP, badge ou notificacao.
- Usuario nao recebe notificacao da propria acao quando nao faz sentido.
- Admin suspenso/deletado nao recebe notificacao.
- Link da notificacao abre a subarea correta do painel.
