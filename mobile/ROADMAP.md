# ConcursoMestre Mobile — Roadmap ate publicacao

## Estado atual

**F3/9 — Questoes em andamento.**

Concluidas: F0, F1 e F2.
Apos a F3, restam 6 macroetapas ate submissao/publicacao nas lojas.

> O escopo funcional do primeiro release continua limitado a Questoes, Simulados e Conta. Modulos existentes fora desse escopo permanecem preservados no codigo para releases posteriores.

## F0 — Auditoria e fundacao — CONCLUIDA

- inventario do app mobile existente
- definicao do MVP
- configuracao segura de ambiente da API
- tokens visuais e tema claro/escuro
- documentacao arquitetural
- separacao entre codigo legado e arquitetura alvo

## F1 — Stack e runtime — CONCLUIDA

- Expo SDK 57
- React Native 0.86
- React 19.2
- TypeScript 6
- Expo Router
- TanStack Query
- Zustand
- React Hook Form + Zod
- SecureStore
- remocao do acoplamento `file:..` com o frontend web

## F2 — Arquitetura, providers e dados — CONCLUIDA

- Expo Router como entrypoint real
- grupos autenticado/publico
- tabs do MVP
- AppProviders unico
- QueryClient global
- limpeza de cache por identidade autenticada
- camada canonica de API e storage
- fronteiras por feature
- CI mobile com Expo Doctor, alinhamento de dependencias e typecheck
- build preview Android e iOS Simulator preparado no GitHub Actions

## F3 — Questoes — EM ANDAMENTO

Concluido nesta fase:

- contrato tipado de paginacao server-side
- query keys do dominio
- infinite query para listagem paginada
- mutation de resposta via TanStack Query
- endpoint de resposta endurecido: o servidor calcula `is_correct`
- cliente mobile deixou de enviar `is_correct` como fonte de verdade
- componente de dominio `QuestionCard`
- filtros iniciais server-side
- nova tela paginada F3 criada em paralelo, sem apagar a tela legada

Pendente para concluir F3:

- retirar o gabarito do DTO de questoes ainda nao respondidas sem quebrar a revisao
- conectar definitivamente a nova tela F3 na rota principal
- migrar filtros avancados: materia, assunto, banca, orgao, cargo e ano
- migrar comentarios, anotacoes, estatisticas, historico e conteudos editoriais
- mutation/cache otimista de favoritos no dominio de Questoes
- estados de erro/retry e testes do fluxo completo
- remover a bridge da tela monolitica somente depois de atingir paridade

## F4 — Simulados — PENDENTE

- migrar configuracao do simulado para a arquitetura por feature
- filtros e montagem de prova
- execucao com timer e navegacao entre questoes
- persistencia/resume seguro da tentativa
- finalizacao autoritativa no backend
- resultado e revisao detalhada
- historico e sincronizacao
- remover bridges legadas de Simulados somente apos paridade

## F5 — Conta — PENDENTE

- perfil e preferencias
- assinatura/plano atual
- historico de transacoes quando fizer parte do MVP
- fluxos de cobranca compativeis com a decisao final de gateway
- alteracao de dados pessoais e senha
- exclusao de conta e dados conforme politica aplicavel
- remover bridges legadas de Planos/Checkout somente apos decisao de escopo

## F6 — Hardening mobile — PENDENTE

- estrategia de cache/offline e revalidacao
- comportamento em rede instavel, timeout e retry
- deep links
- notificacoes quando aprovadas para o release
- seguranca de sessao e armazenamento
- revisao de permissoes nativas
- observabilidade de erros
- performance, memoria e listas extensas
- protecao contra regressao de contratos da API

## F7 — QA e Release Candidate — PENDENTE

- testes unitarios dos contratos criticos
- testes de integracao dos tres modulos do MVP
- testes E2E dos fluxos principais
- matriz de aparelhos Android e iOS
- acessibilidade basica e tamanhos de tela
- regressao de login/logout/token expirado
- regressao de resposta, simulado e conta
- validacao em API de producao/staging
- congelamento da versao candidata

## F8 — Store readiness e distribuicao — PENDENTE

- icone, splash e identidade final
- versionamento de build Android/iOS
- assinatura e credenciais de distribuicao
- Android App Bundle para Play Console
- archive iOS para App Store Connect/TestFlight
- politica de privacidade e termos acessiveis
- declaracoes de dados/permissoes exigidas pelas lojas
- classificacao etaria e categoria
- textos, screenshots e metadados das lojas
- links de suporte e exclusao de conta
- testes internos/fechados no Google Play e TestFlight

As exigencias especificas das lojas devem ser revalidadas nas documentacoes oficiais imediatamente antes desta fase, pois mudam com o tempo.

## F9 — Submissao e rollout — PENDENTE

- corrigir pendencias encontradas no beta fechado
- gerar builds finais assinadas
- enviar versao para revisao da Google Play
- enviar versao para revisao da App Store
- responder eventuais apontamentos das lojas
- liberar rollout controlado
- monitorar crashes, autenticacao e APIs apos liberacao
- ampliar rollout somente com indicadores estaveis

## Gate de publicacao

O aplicativo so deve ser considerado **publicavel** quando F0-F8 estiverem concluidas e o Release Candidate tiver passado pelos testes internos. F9 e a etapa de submissao e liberacao efetiva nas lojas.
