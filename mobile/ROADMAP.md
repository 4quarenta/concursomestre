# ConcursoMestre Mobile — Roadmap ate publicacao

## Estado atual

**F6/9 — Hardening mobile em andamento.**

Concluidas: F0, F1, F2, F3, F4 e F5.
Restam F6, F7 e F8 para o aplicativo ficar publicavel; F9 e a submissao/rollout nas lojas.

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

## F4 — Simulados — CONCLUIDA

- configurador migrado para `features/simulations`
- taxonomias oficiais e filtros server-side na montagem do simulado
- remocao do download integral do banco de questoes
- execucao pela arquitetura Expo Router
- timer baseado em timestamp, resistente ao fechamento do app
- tentativa ativa persistida localmente com Zustand + AsyncStorage
- sincronizacao e retomada de tentativa ativa remota
- backend autoritativo para correcao, score e gamificacao
- tentativa `in_progress` sem gabarito, `is_correct` ou score parcial exposto
- modo de feedback imediato preservado sem vazar gabarito das demais questoes
- historico server-side hidratado com as questoes originais
- revisao detalhada de acertos, erros e itens em branco
- cache local usado apenas como fallback do historico remoto
- telas legadas removidas do caminho funcional principal

## F5 — Conta — CONCLUIDA PARA O MVP

- `AccountScreen` propria da feature, sem ponte para o `ProfileScreen` legado
- dados basicos da conta e edicao do nome
- nivel e XP
- plano, status, ciclo e previsao de renovacao
- historico recente de transacoes via TanStack Query
- exibicao de alertas de pagamento retornados pelo backend
- gerenciamento de renovacao automatica usando o contrato oficial Stripe
- acesso ao portal de cobranca quando a assinatura Stripe e gerenciavel
- tratamento neutro para assinaturas fora do fluxo Stripe gerenciavel
- troca de senha nativa com confirmacao da senha atual
- solicitacao de exclusao da conta com reautenticacao nativa
- endpoint mobile de exclusao sem dependencia do reCAPTCHA web
- logout e limpeza de sessao

Observacao de escopo: o fluxo dedicado de cancelamento com reembolso nao e exposto diretamente no app nesta fase porque o endpoint legado ainda possui regras web/reCAPTCHA e regras financeiras especificas. O MVP permite desativar a renovacao e acessar o gerenciamento do provedor. A politica de compra/cancelamento dentro das lojas sera revalidada na F8 antes da submissao.

## F6 — Hardening mobile — EM ANDAMENTO

Concluido nesta fase:

- refresh de token single-flight para impedir corridas de autenticacao
- expiracao de sessao propagada imediatamente do storage para o AuthProvider
- limpeza coerente de sessao e cache ao trocar ou perder identidade autenticada
- timeout HTTP centralizado em 20 segundos
- classificacao padronizada de timeout, offline, 401, 429, 4xx e 5xx
- retry apenas para falhas transitórias e com limite de uma nova tentativa
- mensagens de erro de rede consistentes para o usuario
- rotas autenticadas protegidas por sessao no Expo Router
- rota canonica de execucao de simulado em `/simulados/executar`
- alias legado `/SimulationRun` reduzido a redirecionamento temporario
- fallback global para deep links/rotas inexistentes
- Error Boundary global para evitar tela branca em falhas de renderizacao
- revisao inicial de permissoes: `app.json` nao declara permissao sensivel adicional para o MVP atual

Pendente nesta fase:

- atualizar os ultimos chamadores internos de `/SimulationRun` para a rota canonica e remover o alias
- estrategia explicita de cache/offline para leituras que podem operar com dados anteriores
- revisar notificacoes e decidir se entram no primeiro release
- observabilidade remota de crashes/logs antes do Release Candidate
- revisar performance, memoria e listas extensas em aparelho real
- protecao automatizada contra regressao dos contratos criticos da API
- limpeza das bridges `MainTabs`/`Checkout` conforme decisao final de escopo
- validar o Mobile CI assim que o GitHub Actions voltar a alocar runner normalmente

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
- revisao das regras vigentes das lojas para assinatura/pagamento de conteudo digital
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
