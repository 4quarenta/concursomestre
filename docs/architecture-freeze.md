# Arquitetura Oficial Revisada — Plataforma de Questões

## Objetivo

Padronizar a plataforma em uma arquitetura simples, previsível, escalável, orientada por fatias verticais, com separação clara de responsabilidades e sem ambiguidade entre camadas.

Esta versão substitui a arquitetura congelada anterior e passa a ser o único padrão válido do projeto.

## Princípios obrigatórios

1. Organização por fatia vertical
2. Shared só quando for realmente compartilhado
3. Uma responsabilidade por lugar
4. Estrutura previsível
5. Nada de dupla interpretação

## Frontend — estrutura oficial revisada

```text
src/
  app/
    <feature>/
      page.tsx
      components/
      hooks/
      services/
      types.ts
      constants.ts

  components/
    shared/
      ui/
      feedback/
      layout/
      overlays/

  providers/
  state/
  services/
    api/
      client.ts
      interceptors.ts
      response.ts
    <domain>/
      index.ts
      *Service.ts

  utils/
    formatters/
    validators/
    helpers/
    mappers/
    errors/

  constants/
  types/
  router/
    index.tsx
    publicRoutes.tsx
    privateRoutes.tsx
    adminRoutes.tsx
    guards/

  styles/
  assets/
```

## Regras oficiais do frontend

- `src/app/<feature>/page.tsx` é o único entry point oficial da feature.
- Componentes exclusivos ficam em `src/app/<feature>/components/`.
- Componentes realmente reutilizáveis ficam em `src/components/shared/`.
- `src/providers/` contém apenas comportamento global transversal.
- `src/state/` recebe apenas estado global real.
- `src/services/` centraliza integrações HTTP globais.
- `src/utils/` contém apenas funções puras reutilizáveis.
- `src/constants/` e `src/types/` guardam apenas contratos e constantes globais.
- `src/router/` é a camada oficial obrigatória para rotas, guards e segregação pública/privada/admin.

## Convenções obrigatórias do frontend

- `page.tsx` como padrão único de entry point.
- Componentes em `PascalCase.tsx`.
- Hooks em `useNomeDoHook.ts`.
- Tipos locais em `types.ts`.
- Constantes locais em `constants.ts`.
- Serviços locais em nomes descritivos.
- Features com nomes curtos, estáveis e alinhados à rota.

## Áreas proibidas para código novo no frontend

- `pages/`
- `context/`
- `src/features/`
- `src/core/`
- `src/shared/` legado
- qualquer pasta paralela que replique `app`, `components/shared`, `services` ou `router`

## Backend PHP — estrutura oficial revisada

```text
backend/
  public/
    index.php

  modules/
    <domain>/
      controllers/
      services/
      repositories/
      validators/
      routes.php
      dto/

  shared/
    auth/
    db/
    http/
    middleware/
    security/
    utils/
    errors/
    responses/

  config/
  database/
  scripts/
  tests/
  storage/
  uploads/
```

## Regras oficiais do backend PHP

- `modules/<domain>/` concentra a regra por domínio.
- `controllers/` recebem request, delegam e respondem.
- `services/` concentram a regra de negócio.
- `repositories/` concentram SQL e acesso a dados.
- `validators/` validam e normalizam entrada.
- `dto/` é opcional e só entra quando traz ganho real.
- `shared/` é exclusivamente infraestrutura transversal.
- `api/` legado fica apenas como bridge.
- Resposta JSON deve convergir para `success`, `message`, `data` e `pagination`.

## Áreas proibidas para regra nova no backend

- `api/` legado além de bridges
- scripts soltos com regra de domínio
- includes genéricos sem dono claro
- utilitários que concentram regra de negócio

## Estado atual validado em 2026-04-02

### Frontend

- `src/router/` foi formalizado como camada oficial, com segregação pública, privada e admin.
- `src/app/` continua sendo a camada oficial de entry points.
- Ainda existem divergências a resolver para a consolidação total do padrão único de `page.tsx`: parte das features foi recuperada temporariamente por bridge após uma tentativa de migração em lote que removeu wrappers antes da movimentação final dos arquivos.
- `src/components/admin/*` ainda é uma divergência em relação ao desenho revisado; esses componentes precisam migrar para `src/app/admin/components/` ou para `src/components/shared/*` quando realmente forem transversais.
- `src/components/layout/*` e `src/components/ads/*` também seguem como divergência até migração para `src/components/shared/*`.
- `src/features/` e `src/core/` seguem como legado de transição. Não podem receber código novo.
- `context/` foi recriado apenas como bridge temporário para preservar funcionamento durante a recuperação estrutural. Não pode voltar a concentrar implementação.

### Backend

- `shared/http/` foi formalizado.
- `shared/errors/` e `shared/responses/` foram abertos para separar infraestrutura transversal de resposta e erro.
- `modules/admin`, `modules/filters`, `modules/materials`, `modules/rankings`, `modules/subscriptions` e `modules/transactions` já existem.
- Ainda faltam módulos oficiais para `auth`, `users`, `questions`, `comments`, `notifications`, `simulations`, `statistics`, `plans`, `payments` e `reports`.
- Ainda existem endpoints legados em `api/` com resposta manual e lógica fora do módulo final.

## Regra operacional daqui para frente

Nenhuma nova refatoração estrutural deve acontecer fora deste desenho.

Se algum desvio permanecer temporariamente, ele deve ser:
- tratado como bridge fino
- documentado no `docs/audit-report.md`
- removido antes do encerramento da auditoria final
