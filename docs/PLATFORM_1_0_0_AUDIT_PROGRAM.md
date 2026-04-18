# Programa de Auditoria 1.0.0

## Escopo

Preparar a plataforma para producao com a versao `1.0.0`, cobrindo web, painel admin, pagamentos, SEO, seguranca, limpeza tecnica e operacao.

## Regra de changelog

O changelog da versao `1.0.0` deve refletir todas as funcionalidades ativas da plataforma.

Excecao:

- funcionalidades marcadas como `(desativado)` no painel admin nao entram como entrega ativa da versao

## Ondas de auditoria

### Onda 1 - Limpeza e organizacao de diretorios

- identificar arquivos nao utilizados
- identificar backups e artefatos obsoletos
- separar claramente o que e legado, o que e ativo e o que ja pode sair
- consolidar o padrao de diretorios adotado pelo projeto

### Onda 2 - Auditoria de codigo

- revisar duplicacoes, imports nao usados e fluxos mortos
- revisar acoplamentos entre `src/`, `services/`, `components/` e rotas
- revisar cobertura minima dos fluxos criticos

### Onda 3 - Auditoria de seguranca

- revisar variaveis de ambiente e segredos
- revisar fluxos autenticados e privilegios admin
- revisar risco de exposicao de dados e endpoints sensiveis
- revisar superficies de upload, leitura e webhooks

### Onda 4 - Auditoria de pagamentos

- revisar checkout, assinatura, proracao e creditos
- revisar eventos Stripe e reconciliacao
- revisar cancelamento, renovacao, falhas e evidencias operacionais

### Onda 5 - Auditoria de SEO e indexacao

- revisar canonicals
- revisar sitemaps e metadata
- revisar paginas comerciais/publicas
- revisar Search Console e monitoramento pos-corte

### Onda 6 - Auditoria do painel admin

- revisar modulos ativos
- revisar funcionalidades marcadas como `(desativado)`
- revisar consistencia entre configuracoes, feature flags e UI
- revisar operacao financeira e visibilidade de dados

### Onda 7 - Analytics de receita e operacao

- revisar indicadores de receita no admin
- revisar funil de assinatura e pagamentos
- revisar metricas de marketplace, materiais e consumo
- definir o baseline operacional da versao `1.0.0`

## Entregaveis esperados

- mapa de arquivos removiveis
- plano de reorganizacao de diretorios
- relatorio de riscos tecnicos
- relatorio de riscos de seguranca
- relatorio de riscos financeiros/pagamentos
- relatorio de SEO
- relatorio do painel admin
- relatorio de analytics de receita
- changelog funcional consolidado da versao `1.0.0`
