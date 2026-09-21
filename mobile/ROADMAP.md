# ConcursoMestre Mobile — Roadmap ate publicacao

## Estado atual

**F7/9 — QA e Release Candidate em andamento. F8 possui codigo STORE-CODE-READY, com pendencias externas de loja.**

Concluidas funcionalmente: F0, F1, F2, F3, F4, F5 e F6.

Ainda nao concluidas como macroetapas: **F7, F8 e F9**.

- **F7:** depende da validacao final do RC, CI executavel e testes em aparelhos reais.
- **F8:** a parte de codigo/configuracao interna esta pronta; faltam contas, credenciais, builds assinados, declaracoes e validacoes externas.
- **F9:** submissao e rollout ainda nao iniciados; checklist operacional ja preparado.

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
- nova tela conectada como rota oficial

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
- rota canonica `/simulados/executar`

## F5 — Conta — CONCLUIDA PARA O MVP

- `AccountScreen` propria da feature, sem ponte para o `ProfileScreen` legado
- dados basicos da conta e edicao do nome
- nivel e XP
- plano, status, ciclo e previsao de renovacao
- historico recente de transacoes via TanStack Query
- exibicao de alertas de pagamento retornados pelo backend
- gerenciamento de renovacao automatica no canal direto
- acesso ao portal de cobranca apenas no canal direto quando gerenciavel
- tratamento neutro para assinaturas fora do fluxo gerenciavel
- troca de senha nativa com confirmacao da senha atual
- solicitacao de exclusao da conta com reautenticacao nativa
- endpoint mobile de exclusao sem dependencia do reCAPTCHA web
- logout e limpeza de sessao
- superficie `StoreAccountScreen` separada para builds de loja, sem compra, upgrade, reativacao paga ou redirecionamento para billing externo

Observacao de escopo: o fluxo dedicado de cancelamento com reembolso nao e exposto diretamente no app nesta fase. Builds de loja reconhecem assinaturas existentes e permitem as operacoes seguras previstas para o MVP, sem introduzir compra externa de conteudo digital.

## F6 — Hardening mobile — CONCLUIDA FUNCIONALMENTE

- refresh de token single-flight para impedir corridas de autenticacao
- expiracao de sessao propagada imediatamente do storage para o AuthProvider
- limpeza coerente de sessao e cache ao trocar ou perder identidade autenticada
- timeout HTTP centralizado em 20 segundos
- classificacao padronizada de timeout, offline, 401, 429, 4xx e 5xx
- retry apenas para falhas transitorias e com limite de uma nova tentativa
- mensagens de erro de rede consistentes
- rotas autenticadas protegidas por sessao no Expo Router
- fallback global para deep links/rotas inexistentes
- Error Boundary global para evitar tela branca em falhas de renderizacao
- revisao inicial de permissoes: sem permissao sensivel adicional para o MVP atual
- bridges `MainTabs`, `Checkout` e `SimulationRun` removidas do caminho publicavel
- politica offline documentada em `mobile/OFFLINE_POLICY.md`
- tentativa ativa e historico de Simulados com persistencia/fallback local
- Questoes mantidas online-first, sem replica persistente do banco ou gabarito global em disco
- push notifications adiadas para release posterior ao MVP
- gate automatizado `contracts:check` protege contratos criticos de gabarito/score
- Mobile CI configurado para validar contratos, smoke RC, store readiness e TypeScript

## F7 — QA e Release Candidate — EM ANDAMENTO

Concluido/preparado:

- gates automatizados de contrato, RC e store readiness incorporados ao CI
- arquitetura do Release Candidate congelada no escopo Questoes, Simulados e Conta
- build preview/distribuicao direta preparada
- documentacao de release e politicas offline preparada

Pendente:

- repetir Mobile CI completo quando o GitHub-hosted runner voltar a executar steps
- testes de integracao e E2E dos fluxos principais em ambiente executavel
- matriz de aparelhos Android e iPhone
- acessibilidade basica e tamanhos de tela
- regressao de login/logout/token expirado
- regressao de resposta, simulado e conta
- validacao em API de producao/staging
- observabilidade/telemetria de crash do RC, se adotada para o primeiro release
- verificacao de performance e memoria em aparelhos reais
- congelamento final do binario candidato

### Bloqueio operacional atual

Os ultimos jobs de Mobile CI e captura de screenshots encerraram antes de executar qualquer step (`steps: null`). Portanto, a falha atual nao registra erro de codigo do app. E necessario confirmar disponibilidade/cota/orcamento de GitHub Actions e repetir os gates assim que houver runner.

## F8 — Store readiness e distribuicao — CODIGO PRONTO / EXTERNO PENDENTE

### Concluido no repositorio

- versao nativa `1.0.0`, Android `versionCode=1` e iOS `buildNumber=1`
- Android package e iOS bundle identifier definidos como `com.concursomestre.mobile`
- primeiro release iOS restrito a iPhone (`supportsTablet=false`) ate QA dedicado de iPad
- `mobile/eas.json` com perfis `preview`, `preview-simulator` e `production`
- preview Android configurado para APK de distribuicao interna
- production Android configurado para App Bundle
- API distribuivel fixada em HTTPS publica
- separacao de canal `direct` e `store`
- superficie de Conta segura para o canal de loja, sem redirecionamento para pagamento externo
- Politica de Privacidade e Termos revisados tecnicamente e conectados ao app
- Privacidade, Termos e Suporte acessiveis antes do login
- pagina publica `/account-deletion` conectada ao fluxo autenticado real
- exclusao de conta disponivel dentro do app com reautenticacao
- inventario inicial de dados em `DATA_SAFETY_DRAFT.md`
- metadados de loja preparados em `STORE_METADATA_DRAFT.md`
- requisitos consolidados em `STORE_READINESS.md`
- gate `store:check` para impedir regressoes criticas de configuracao, billing e documentos legais
- checklist de submissao/rollout preparado em `SUBMISSION_ROLLOUT_CHECKLIST.md`

### Pendente fora do codigo

- validacao juridica/titular final da Politica de Privacidade e dos Termos
- deploy e confirmacao das URLs legais/suporte/exclusao no ambiente de producao
- vincular/criar o app no Google Play Console
- vincular/criar o app no Apple Developer/App Store Connect
- vincular o projeto a conta Expo/EAS usada para distribuicao
- configurar credenciais de assinatura Android
- configurar certificados/perfis/credenciais Apple
- reconciliar Data safety/App Privacy com backend, SDKs e provedores efetivamente ativos em producao
- preencher classificacao etaria, categoria, publico-alvo e declaracoes das lojas
- validar icone, splash, feature graphic e screenshots finais nos formatos exigidos
- gerar e validar AAB Android assinado
- gerar e validar build iOS assinada/TestFlight
- executar Internal testing/closed testing no Google Play e TestFlight em iPhone real

**F8 nao e considerada integralmente concluida enquanto essas dependencias externas permanecerem abertas.** O estado correto do repositorio e `STORE-CODE-READY`.

## F9 — Submissao e rollout — PREPARADA / NAO INICIADA

Preparado:

- checklist operacional em `SUBMISSION_ROLLOUT_CHECKLIST.md`
- estrategia de primeira distribuicao Android pela faixa interna
- separacao entre RC, store build e rollout

A executar somente apos os gates de F7/F8:

- corrigir pendencias encontradas nos testes internos
- gerar builds finais assinados
- enviar versao para revisao da Google Play
- enviar versao para revisao da App Store
- responder eventuais apontamentos das lojas
- liberar rollout controlado
- monitorar crashes, autenticacao e APIs apos liberacao
- ampliar rollout somente com indicadores estaveis

## Gate de publicacao

O aplicativo so deve ser considerado **publicavel** quando:

1. F7 tiver Release Candidate validado em CI executavel e aparelhos reais;
2. F8 tiver as pendencias externas concluidas, inclusive builds assinados e testes internos;
3. os documentos/declaracoes de dados estiverem reconciliados com producao.

F9 e a etapa posterior de submissao, revisao e liberacao efetiva nas lojas.
