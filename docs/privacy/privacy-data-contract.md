# ConcursoMestre - contrato tecnico de dados e exclusao

Este documento e uma referencia tecnica do runtime. Nao substitui politica de
privacidade, termos de uso ou parecer juridico. Prazos e bases legais devem ser
definidos pelo responsavel juridico antes do Production GO.

## Autoridades tecnicas

- Identidade de conta: `users.id`.
- Autenticacao: `auth_sessions` e `auth_refresh_tokens`; tokens opacos sao
  armazenados por hash.
- Pedido de exclusao: `users.deletion_requested_at` e
  `users.deletion_reason`.
- Estado de cobranca: tabelas Stripe locais e referencias historicas; nao sao
  apagadas automaticamente por este fluxo.
- Configuracao operacional: migrations e contratos do backend, nao a UI.

## Fluxo de pedido de exclusao

1. `POST /api/users/delete.php` exige sessao autenticada.
2. Quando existe cookie CSRF, o par cookie/header e validado.
3. O reCAPTCHA existente continua sendo aplicado pela rota.
4. O pedido grava o marcador de exclusao em uma transacao.
5. Todas as familias de sessao ativas do usuario sao revogadas na mesma
   transacao; historico de autenticacao nao e apagado.
6. Login por senha, login social, refresh, acesso por cookie e JWT recusam
   contas com marcador de exclusao ou status `deleted`/`pending_deletion`.

Este fluxo e um pedido de tratamento, nao uma promessa de apagamento imediato.
A decisao de apagar, anonimizar ou reter cada classe de dado ainda depende de
politica aprovada e revisao juridica.

## Dados e superficies

| Categoria | Exemplos tecnicos | Superficie | Estado atual |
| --- | --- | --- | --- |
| ACCOUNT | id, nome, email, foto, CPF, telefone, endereco | perfil autenticado, admin restrito | usado; DTO privado explicito |
| AUTHENTICATION | hash de senha, reset/verificacao, sessoes, refresh | backend e tabelas de auth | tokens nao retornados; cookies protegidos |
| BILLING | assinatura, customer id, payment method tokenizado, transacao | billing autenticado/admin | Stripe ativo; historico separado |
| STUDY_ACTIVITY | respostas, sessoes, estatisticas, favoritos, progresso | endpoints autenticados | ownership por `user_id` |
| CONTENT_CREATION | notas, comentarios, uploads quando aplicavel | endpoints autenticados/publicacao conforme recurso | regra por recurso |
| SUPPORT | tickets, respostas, feedback | perfil/admin | ownership e RBAC existentes |
| SECURITY_LOG | IP, user-agent, ids de sessao, eventos de auth | logs operacionais | sem tokens/senhas |
| ANALYTICS | evento, origem, campanha, session key, email legado | first-party analytics | Macrostep 19; retenção ainda pendente |
| MARKETING | preferencias de notificacao e campanhas | perfil/automacoes | Macrostep 19; nao expandir nesta etapa |
| OPERATIONAL | ids tecnicos e estado de sincronizacao | backend/admin | nao publico |

## Terceiros

- Stripe: recebe dados necessarios ao cliente, assinatura e cobranca; ids de
  provider nao pertencem a DTOs publicos.
- Google, Facebook e Apple: autenticacao social e atributos basicos recebidos
  do provedor; tokens nao sao persistidos como credencial publica.
- Google Gemini e OpenAI: recebem prompt e anexos quando o recurso de IA e
  acionado por fluxo autorizado. Conteudo privado deve ser evitado no prompt;
  a decisao editorial e de uso e revisao juridica permanecem abertas.
- reCAPTCHA: recebe o token de desafio quando habilitado.
- Email: recebe destinatario e dados necessarios ao template transacional.

Nao foi encontrada integracao ativa com Mercado Pago no fluxo corrente; menções
historicas devem permanecer apenas em auditoria/migration quando necessárias.

## Cookies e armazenamento local

- `cm_refresh`: cookie HttpOnly, Secure quando aplicavel, SameSite configurado;
  contem refresh token opaco.
- `cm_csrf`: cookie legivel pelo frontend para double-submit CSRF; nao e
  credencial de autenticacao.
- `cm_session_hint`: sinal nao sensivel de presenca de sessao.
- Web `sessionStorage`/`localStorage`: preferências, sinais de sessão,
  redirecionamento e estado efemero; o consentimento opcional usa a chave
  versionada `cm:cookie-consent:v1` com `analytics` e `marketing` negados por
  padrão; nao devem receber refresh token.
- Mobile `SecureStore`: access token, refresh token, CSRF e resumo local de
  sessão; nao usar AsyncStorage para credenciais.

O consent manager client-side é a autoridade técnica para bloquear analytics e
marketing opcionais até a escolha explícita. Estado ausente, inválido ou de
versão desconhecida mantém as categorias opcionais desabilitadas. Isso não
substitui a política pública: categorias, base legal, retenção e redação final
continuam sujeitos a revisão jurídica e à Macrostep 19.

## Grafo de exclusao e retenção

| Recurso | Estado tecnico no pedido | Decisao pendente |
| --- | --- | --- |
| auth_sessions | revogar | retenção operacional |
| auth_refresh_tokens | revogar | retenção operacional |
| users identity | marcar para fluxo | apagar ou anonimizar |
| addresses/profile | não apagado automaticamente | política de identidade |
| user_answers/statistics/study_sessions | vinculado ao usuario | apagar, anonimizar ou reter |
| notes/comments/support | depende do recurso e ownership | produto e juridico |
| user_cards | tokenizado e vinculado ao billing | revogar/remover localmente |
| subscriptions/transactions/ledger | preservar histórico até decisão | retenção financeira |
| notifications | vinculado ao usuario | limpeza controlada |
| backups | permanecem conforme contrato de backup | Macrostep 18 e jurídico |

## Lacunas deliberadamente abertas

- Exportação self-service não existe como contrato implementado; atendimento de
  acesso/portabilidade deve usar canal controlado até ser criado.
- O cumprimento final do apagamento/anonymização requer política aprovada,
  workflow operacional e evidência de execução.
- Retenção de logs, analytics, backups e histórico financeiro não recebe prazo
  inventado neste documento.
