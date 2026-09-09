# ConcursoMestre Mobile — arquitetura alvo

## Status

A fundação e a arquitetura transversal do mobile foram implantadas na branch de refatoração. O Expo Router é o shell de navegação efetivo e a expansão funcional permanece congelada até a migração das features do MVP.

### Progresso atual

- F0 — Auditoria e fundação: concluída
- F1 — Upgrade controlado para Expo 57 / RN 0.86: concluída
- F2 — Arquitetura, providers e dados: concluída
- F3 — Questões: próxima etapa
- F4 — Simulados: pendente
- F5 — Conta: pendente
- F6 — Qualidade e release: pendente

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

Estrutura canônica:

```text
mobile/
  app/                    # Expo Router: somente rotas/layouts
  src/
    api/                  # cliente HTTP, catálogo de endpoints e normalização
    components/           # componentes realmente compartilhados
    config/               # ambiente e configuração runtime
    features/
      auth/
      questions/
      simulations/
      account/
    hooks/                # hooks transversais
    providers/            # composição global, QueryClient e autenticação
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

## Limites arquiteturais implantados na F2

### Navegação

`mobile/app/` é a fonte canônica de rotas. O entrypoint do aplicativo é `expo-router/entry`.

O root layout:

- centraliza os providers;
- aguarda o bootstrap da sessão;
- protege o grupo autenticado e o grupo público;
- expõe apenas Questões, Simulados e Conta na navegação principal.

`src/navigation/` permanece temporariamente apenas para telas legadas ainda não migradas. Novas rotas não devem ser adicionadas ali.

### API

Os caminhos canônicos são:

- `src/api/client.ts`
- `src/api/endpoints.ts`
- `src/api/response.ts`

Os arquivos equivalentes em `src/services/api/` são bridges temporárias de compatibilidade e não devem receber nova lógica.

### Storage

`src/storage/sessionStorage.ts` é a fonte canônica de persistência da sessão com SecureStore. `src/services/auth/sessionStore.ts` existe somente como bridge para imports antigos.

### Estado

- TanStack Query: estado remoto e cache.
- Zustand: estado local global/efêmero que não pertence ao backend.
- React state: estado estritamente local de UI.
- URL/params: estado navegável e compartilhável.

Não duplicar o mesmo dado em mais de uma dessas camadas sem justificativa explícita.

### Cache e sessão

O QueryClient é único para o aplicativo e o cache é limpo quando a identidade autenticada muda. Isso impede reaproveitamento de dados privados entre sessões diferentes.

### Features

As fronteiras `features/auth`, `features/questions`, `features/simulations` e `features/account` já existem. Onde a feature ainda não foi internamente decomposta, há uma bridge explícita para a tela legada. Essa bridge deve desaparecer na fase correspondente da feature.

## Migração

### F0 — Auditoria e fundação — concluída

- inventário de dependências e módulos
- consolidação de tokens visuais
- limitação da navegação do MVP
- contratos de ambiente
- identificação de estado remoto mantido manualmente

### F1 — Upgrade controlado — concluída

Expo 57, React Native 0.86, React 19.2 e TypeScript 6, com dependências alinhadas e validação por Expo Doctor/typecheck.

### F2 — Arquitetura, providers e dados — concluída

- Expo Router como shell efetivo
- grupos públicos/privados protegidos por sessão
- tabs do MVP por arquivo
- `AppProviders` único
- `QueryClientProvider`
- integração com AppState/focusManager
- cache policy
- isolamento do cache por usuário
- camada `src/api`
- camada `src/storage`
- fronteiras por feature
- Zustand reservado para estado local global
- Simulados já usando TanStack Query na listagem como primeira migração de referência

### F3 — Questões

Migrar a tela monolítica para feature, paginação/filtros server-side, infinite query, mutations e componentes menores.

### F4 — Simulados

Migrar configuração, execução, persistência e resultado. As rotas `SimulationRun` e partes internas do fluxo continuam como bridges até esta fase.

### F5 — Conta

Migrar perfil, assinatura e preferências necessárias ao MVP. As bridges de Planos/Checkout deixam de existir nesta fase.

### F6 — Qualidade e release

Offline/cache controlado, deep links, notificações, testes, segurança, performance e builds de distribuição.

## Regras de transição

- Não remover módulos antigos antes de existir substituto funcional.
- Não adicionar novas telas ao navigator legado.
- Não adicionar nova lógica aos bridges em `src/services/api/` e `src/services/auth/sessionStore.ts`.
- Cada feature migrada deve sair do fluxo legado somente após typecheck e teste do caminho principal.
- Produção deve exigir `EXPO_PUBLIC_API_BASE_URL`; localhost é permitido apenas em desenvolvimento.
- Bridges de compatibilidade são dívida temporária com fase de remoção definida, não arquitetura permanente.
