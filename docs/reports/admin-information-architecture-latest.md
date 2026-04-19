# Arquitetura de Informacao do Novo Admin

Data: `2026-04-19`

## Objetivo

Definir a organizacao do novo painel administrativo antes da implementacao visual.

Esta etapa evita recriar a estrutura antiga com outro visual. A UI atual continua apenas como inventario funcional ate a troca planejada da rota `/admin`.

## Principio de navegacao

O admin novo sera organizado por dominios de trabalho, nao por origem tecnica dos componentes antigos.

Cada dominio deve responder a uma pergunta operacional clara:

| Dominio | Pergunta que responde | Resultado esperado |
| --- | --- | --- |
| Overview | O que precisa de decisao agora? | cockpit executivo, filas criticas, saude e anomalias |
| Operation | O conteudo e a base estao saudaveis? | questoes, provas, importacao, usuarios, materiais e rankings |
| Revenue | O dinheiro esta entrando e sendo conciliado? | receita, assinaturas, transacoes, refund, cupons, sellers e billing |
| Growth | Como estamos convertendo e posicionando? | campanhas, landing pages, SEO, canais e ativos comerciais |
| Support | Quem precisa de atendimento ou moderacao? | feedback, denuncias, threads, SLA e roteamento |
| Security | O que afeta risco, permissao e auditoria? | RBAC, 2FA, segredos, logs, auditoria e incidentes |
| Settings | O que configura a plataforma? | modulos, integracoes, email, ads, SEO, cache e publicacao |

## Hierarquia alvo

### Overview

- Executive cockpit
- Operational queue
- Billing health
- Content health
- Search visibility
- Incident center

### Operation

- Questions
- Manual editor
- Exams
- Import pipeline
- Taxonomies
- Users
- Materials
- Rankings

### Revenue

- Revenue dashboard
- Subscriptions
- Transactions
- Refunds
- Plans and coupons
- Sellers and payouts
- Stripe test matrix
- Automation and cron

### Growth

- Landing pages
- Campaigns
- SEO inventory
- Commercial content
- Acquisition channels
- Public pages

### Support

- Support inbox
- Feedback
- Reports
- Threads
- SLA board
- Resolution history

### Security

- Admin access
- Roles and permissions
- 2FA policies
- Secrets and integrations
- Audit trail
- System logs
- Incident response

### Settings

- General settings
- Module flags
- Checkout settings
- Email settings
- Ads settings
- SEO settings
- Performance and cache
- Versioned config releases

## Objetos de decisao

O novo admin deve separar visualmente tres tipos de objeto:

- Metricas: numeros que explicam saude, risco ou receita
- Filas: itens que exigem decisao humana
- Configuracoes: valores que alteram comportamento do sistema

Essa separacao precisa existir no layout, nos nomes de componentes e na arquitetura de dados.

## Rotas futuras

Formato alvo:

- `/admin/overview`
- `/admin/overview/queue`
- `/admin/operation/questions`
- `/admin/operation/import`
- `/admin/revenue/analytics`
- `/admin/revenue/subscriptions`
- `/admin/growth/seo`
- `/admin/support/inbox`
- `/admin/security/audit`
- `/admin/settings/releases`

Durante o rebuild, a compatibilidade de links antigos deve ser resolvida uma unica vez na fronteira da rota, nao dentro de cada componente.

## Regras de implementacao

- nao portar componentes visuais antigos como base
- nao criar adaptadores de UI para manter a casca antiga viva
- reaproveitar servicos e contratos apenas quando estiverem limpos
- criar componentes de design system antes das telas finais
- cada dominio deve ter arquivos, estado e testes proprios
- dashboards devem nascer de dados reais ou estados explicitamente vazios
- toda funcao existente no inventario deve ter destino definido antes da troca da rota

## Proxima entrega da etapa B

Criar a base privada de rebuild com:

- contrato de navegacao
- tokens visuais
- primitivos de layout
- componentes operacionais iniciais
- preview interno reutilizavel para construir as telas finais
