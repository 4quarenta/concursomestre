# ConcursoMestre Mobile — arquitetura alvo

## Status

A implementação mobile existente permanece preservada durante a migração. Novas funcionalidades ficam congeladas até a conclusão da fundação.

## Objetivo do primeiro release

A navegação principal do MVP terá apenas:

- Questões
- Simulados
- Conta

Módulos já implementados fora desse escopo não devem ser apagados. Permanecem como código legado até serem migrados e reativados em releases posteriores.

## Stack alvo

- Expo SDK 57
- React Native 0.86
- React 19.2
- TypeScript
- Expo Router para navegação baseada em arquivos
- TanStack Query v5 para estado remoto, cache, paginação, mutations e invalidação
- Zustand somente para estado global local que não pertence ao servidor
- React Hook Form + Zod para formulários e validação
- Expo SecureStore para tokens e dados sensíveis
- Axios como cliente HTTP enquanto a API atual permanecer REST
- @expo/ui como primeira opção para controles nativos/universais; não recriar manualmente controles comuns quando houver componente de plataforma adequado

## Princípios

### 1. Backend autoritativo

Web e mobile são clientes da mesma API. O app não cria uma segunda fonte de verdade e não replica regras de negócio que pertencem ao backend.

### 2. Estado remoto não é estado de tela

Dados de API devem passar por TanStack Query. Telas não devem manter cópias extensas de listagens, estados de loading/error e caches manuais quando a biblioteca já resolve esses problemas.

### 3. Filtros e paginação no servidor

O app não deve baixar todo o banco de questões para filtrar localmente. Filtros suportados pela API devem ser enviados ao backend e a listagem deve usar paginação/infinite query.

### 4. Organização por feature

Estrutura alvo:

```text
mobile/
  app/                    # Expo Router: somente rotas/layouts
  src/
    api/                  # cliente HTTP, contratos e interceptors
    components/           # componentes realmente compartilhados
    config/               # ambiente e configuração runtime
    features/
      auth/
      questions/
      simulations/
      account/
    hooks/                # hooks transversais
    state/                # Zustand: apenas estado local global
    storage/              # SecureStore/AsyncStorage
    theme/                # tokens e tema
    types/                # tipos compartilhados inevitáveis
    utils/                # funções puras transversais
```

Cada feature pode conter `api/`, `components/`, `hooks/`, `schemas/`, `screens/` e `types/` conforme necessidade. Evitar arquivos de tela monolíticos.

### 5. Design system único

A referência visual é a aplicação web atual:

- base neutra Slate
- identidade principal Indigo
- sucesso Emerald
- atenção Amber
- erro Red
- raio predominante de 16 px (`rounded-2xl` na web)

Cores, espaçamentos, raios e tipografia devem vir de `src/theme/tokens.ts`. É proibido introduzir hex de identidade diretamente em telas, salvo exceção documentada.

### 6. Não reinventar controles

Botões, inputs, checkbox, picker, bottom sheet, menu, diálogo, switch e controles equivalentes devem preferir componentes mantidos pelo Expo/plataforma. Componentes próprios devem representar linguagem de domínio, por exemplo `QuestionCard`, `SimulationProgress` ou `PlanBadge`, e não uma reimplementação genérica de `Button`/`TextInput` sem necessidade.

### 7. Contratos compartilháveis, UI não

Podem ser compartilhados entre web e mobile, quando estáveis:

- tipos TypeScript
- schemas Zod
- DTOs
- constantes de domínio
- regras puras

A UI web não deve ser importada pelo mobile.

## Migração

### F0 — Auditoria e fundação

- inventariar dependências e módulos
- consolidar tokens visuais
- limitar navegação do MVP
- definir contratos de ambiente
- identificar estado remoto mantido manualmente

### F1 — Upgrade controlado

Atualizar Expo 52 -> 57 seguindo guias de migração por SDK, executar `expo install --fix`, typecheck e builds Android/iOS. Expo Router entra nesta fase para evitar manter duas arquiteturas de navegação.

### F2 — Providers e dados

- QueryClientProvider
- integração AppState/onlineManager
- auth bootstrap
- cache policy
- error handling

### F3 — Questões

Migrar a tela monolítica para feature, paginação/filtros server-side, mutations e componentes menores.

### F4 — Simulados

Migrar configuração, execução, persistência e resultado.

### F5 — Conta

Migrar perfil, assinatura e preferências necessárias ao MVP.

### F6 — Qualidade e release

Offline/cache controlado, deep links, notificações, testes, segurança, performance e builds de distribuição.

## Regras de transição

- Não remover módulos antigos antes de existir substituto funcional.
- Não misturar migração de SDK com grande refatoração funcional no mesmo commit.
- Cada feature migrada deve sair do fluxo legado somente após typecheck e teste do caminho principal.
- Produção deve exigir `EXPO_PUBLIC_API_BASE_URL`; localhost é permitido apenas em desenvolvimento.
