# ConcursoMestre Mobile — Roadmap ate publicacao

## Estado atual

**F4/9 — Simulados em andamento.**

Concluidas: F0, F1, F2 e F3.
Restam 5 macroetapas apos a F4 ate submissao/publicacao nas lojas.

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

## F3 — Questoes — CONCLUIDA

- contrato tipado de paginacao server-side
- query keys e infinite query do dominio
- endpoint de resposta autoritativo: servidor calcula `is_correct`
- cliente mobile nao envia `is_correct` como fonte de verdade
- endpoint mobile de listagem remove gabarito antes da resposta
- gabarito retorna somente apos submissao/revisao do usuario
- `QuestionCard` e paineis secundarios de dominio
- busca com debounce e filtros server-side
- `filtersList` como fonte oficial de taxonomias
- seletores pesquisaveis para materia, assunto, banca, orgao, cargo e ano
- salvos integrados ao cache/listagem
- comentarios, respostas a comentarios e curtidas
- anotacoes com persistencia local e hidratacao remota existente
- estatisticas e historico sob demanda
- comentario do professor e analise detalhada preservados conforme beneficio de plano
- modos Lista e Foco
- estados de loading, vazio, erro e retry
- nova tela conectada como rota oficial; monolito preservado apenas para rollback controlado
- Mobile CI verde com Expo Doctor e TypeScript

## F4 — Simulados — EM ANDAMENTO

Diagnostico inicial confirmado:

- listagem/historico ja usa TanStack Query
- configurador ainda depende de `questionService.getAllQuestions()` e filtra todo o banco no aparelho
- configurador ainda usa React Navigation legado
- execucao/detalhe ainda possuem bridges legadas
- service mistura historico remoto e fallback local; precisa separar tentativa ativa de historico concluido

Objetivos da fase:

- migrar configuracao para `features/simulations`
- usar taxonomias oficiais e filtros server-side para montar a prova
- remover download integral do banco de questoes
- usar Expo Router no fluxo completo
- execucao com timer e navegacao entre questoes
- persistencia/resume seguro da tentativa ativa
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
