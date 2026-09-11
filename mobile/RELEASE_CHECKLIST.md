# ConcursoMestre Mobile — Release Candidate Checklist

## Versão candidata

- App: `1.0.0`
- Android versionCode: `1`
- iOS buildNumber: `1`
- Preview tag planejada: `mobile-preview-v1.0.0-b1`
- API de produção: `https://concursomestre.com/api/`

## Escopo do primeiro release

- [x] Autenticação protegida por sessão
- [x] Questões
- [x] Simulados
- [x] Conta
- [x] Expo Router como navegação canônica
- [x] Rotas legadas removidas do caminho publicável
- [x] Simulados usam `/simulados/executar`
- [x] API não-dev exige endpoint público em HTTPS
- [x] Refresh de token com single-flight
- [x] Gate estático contra regressão de gabarito/score confiado pelo cliente
- [x] Política offline do MVP definida

## Quality gates automatizados

- [x] `npm ci` definido no Mobile CI
- [x] `expo install --check`
- [x] `expo-doctor`
- [x] `npm run contracts:check`
- [x] `npm run qa:smoke`
- [x] `npm run store:check`
- [x] TypeScript `typecheck`
- [ ] Execução verde do Mobile CI no head do RC

O `qa:smoke` valida versão/build, identificadores nativos, scheme, HTTPS, rotas do MVP, remoção das bridges, proteção de sessão, EAS, recursos web públicos e links legais pré-login.

O `store:check` valida especificamente:

- canal `preview=direct` e `production=store`;
- APK interno no preview e AAB no production Android;
- API pública HTTPS nos perfis distribuíveis;
- seleção de `StoreAccountScreen` no canal de loja;
- ausência de Stripe Billing Portal/checkout/CTA externo na superfície de Conta da loja;
- cancelamento de renovação existente sem reativação paga;
- exclusão de conta nativa e web;
- URLs de Privacidade, Termos e Suporte.

> Estado em 10/09/2026: execuções recentes do GitHub Actions encerraram antes de iniciar qualquer step (`steps: []`). Este item permanece pendente até o runner voltar a provisionar jobs normalmente.

## Build / distribuição

- [x] Workflow de preview Android configurado
- [x] Android publica independentemente do resultado do iOS Simulator
- [x] iOS Simulator opcional/`continue-on-error`
- [x] Checksum SHA-256 previsto para o APK
- [x] `eas.json` preparado para preview, iOS Simulator e production/store
- [x] Preview usa canal `direct`
- [x] Production usa canal `store`
- [x] Production Android gera App Bundle
- [x] Primeiro submit Android configurado para faixa `internal`
- [ ] Projeto vinculado a Expo/EAS do titular
- [ ] Credenciais Android/iOS configuradas
- [ ] APK Android RC compilado com sucesso no head atual
- [ ] GitHub pre-release `mobile-preview-v1.0.0-b1` criada
- [ ] APK e SHA-256 confirmados na release
- [ ] iOS Simulator compilado/anexado, se disponível
- [ ] AAB Android `production` gerado e assinado
- [ ] Build iOS `production` enviado ao TestFlight

## Identidade nativa

- [x] Nome `ConcursoMestre`
- [x] Scheme `concursomestre`
- [x] Android package `com.concursomestre.mobile`
- [x] iOS bundle identifier `com.concursomestre.mobile`
- [x] Ícone oficial
- [x] Splash oficial
- [x] Adaptive icon Android

## Recursos públicos / legais

- [x] Rota `/privacy` existente
- [x] Rota `/terms` existente
- [x] Rota `/support` existente
- [x] Rota pública `/account-deletion` criada
- [x] Fluxo web autenticado de exclusão em `/profile/security`
- [x] Links públicos centralizados no mobile
- [x] Privacidade, Termos e Suporte acessíveis antes do login
- [x] Termos e Privacidade acessíveis no cadastro
- [x] Exclusão de conta acessível dentro do app
- [ ] Deploy/validação das quatro URLs em produção
- [ ] Revisão jurídica/conteúdo de Privacidade e Termos

Observação: na auditoria de 10/09/2026, Privacidade e Termos ainda exibiam data de atualização de 24/05/2024 e referências que precisam ser reconciliadas com o produto atual. A rota pronta não equivale a conteúdo legal aprovado.

## Billing / política de loja

### Preview / APK direto

- [x] `AccountScreen` completo preservado para distribuição direta/testes.
- [x] Fluxos administrativos existentes podem continuar disponíveis fora do binário de loja.

### Store

- [x] `StoreAccountScreen` selecionada por `EXPO_PUBLIC_DISTRIBUTION_CHANNEL=store`.
- [x] Sem compra dentro do app.
- [x] Sem upgrade/checkout externo.
- [x] Sem Stripe Billing Portal.
- [x] Sem reativação paga de assinatura externa.
- [x] Assinatura já associada à conta pode ser reconhecida para liberar acesso.
- [x] Usuário pode desativar renovação existente.
- [x] Documentos, suporte e exclusão de conta permanecem acessíveis.

Se futuramente o app vender assinatura/conteúdo digital dentro do binário de loja, integrar o mecanismo de billing permitido pela loja/região antes de publicar essa mudança.

## Smoke test em aparelho físico — Android Preview

Executar somente depois de existir APK do head atual.

- [ ] Instalação limpa do APK
- [ ] Abertura sem Metro/PC
- [ ] Login válido e inválido
- [ ] Persistência de sessão
- [ ] Logout e proteção das rotas
- [ ] Questões: filtros, resposta e correção server-side
- [ ] Simulado: criar, retomar, concluir e revisar
- [ ] Conta e exclusão
- [ ] Administração de assinatura existente no canal direto
- [ ] Perda/retorno de conexão
- [ ] Tema claro/escuro
- [ ] Navegação/voltar/deep links

## Smoke test da variante Store

Obrigatório antes da submissão, porque a tab Conta muda de superfície conforme o canal.

- [ ] Build iniciado com `EXPO_PUBLIC_DISTRIBUTION_CHANNEL=store`
- [ ] Conta exibe plano/status existente
- [ ] Nenhum botão abre Stripe, checkout ou página de compra
- [ ] Desativar renovação funciona quando aplicável
- [ ] Alterar senha funciona
- [ ] Solicitar exclusão funciona
- [ ] Privacidade abre URL oficial
- [ ] Termos abre URL oficial
- [ ] Suporte abre URL oficial
- [ ] Exclusão web abre URL oficial

## iPhone

- [ ] Smoke test em iPhone físico via TestFlight/internal distribution

O `.app.zip` do workflow de preview é apenas para iOS Simulator. iPhone físico deve usar TestFlight ou distribuição apropriada.

## Store readiness

- [x] Expo SDK 57 / target Android API atual compatível com o stack previsto
- [x] Exclusão de conta dentro do app
- [x] Recurso web externo de exclusão implementado no código
- [x] Política/Termos/Suporte possuem rotas públicas
- [x] Perfis EAS de distribuição preparados
- [x] Estratégia técnica de billing para o primeiro binário Google Play definida: sem compra externa no canal `store`
- [x] Estratégia técnica de billing para o primeiro binário App Store definida: sem compra externa no canal `store`
- [x] `DATA_SAFETY_DRAFT.md` mapeado por categoria
- [x] `STORE_METADATA_DRAFT.md` preparado com campos por loja
- [ ] Revisão legal final
- [ ] URLs confirmadas em produção
- [ ] Credenciais/contas de desenvolvedor e assinatura configuradas
- [ ] AAB Android final validado
- [ ] TestFlight/archive iOS final validado
- [ ] Google Data Safety preenchido e revisado
- [ ] Apple App Privacy preenchido e revisado
- [ ] Screenshots/feature graphic/classificação e demais metadados enviados

## Critério para encerrar F7

F7 pode ser considerada concluída quando:

1. os quality gates executarem e ficarem verdes no commit candidato;
2. o APK Android do mesmo commit for gerado e anexado à GitHub pre-release;
3. o smoke test Android não revelar bloqueador P0/P1;
4. qualquer limitação de iOS ficar explicitamente registrada.

Até esses critérios serem atendidos, o código pode estar RC-ready, mas não deve ser declarado release validado.

## Critério para encerrar F8

F8 pode ser considerada concluída para submissão quando:

1. Privacidade e Termos forem revisados e publicados;
2. URLs públicas forem verificadas em produção;
3. contas/credenciais EAS, Google Play e Apple estiverem vinculadas;
4. inventário de dados for reconciliado com backend/provedores;
5. Data Safety/App Privacy forem preenchidos;
6. AAB Android e build TestFlight forem gerados e testados;
7. screenshots, classificação e metadados finais forem inseridos nos consoles.

Enquanto esses itens externos estiverem pendentes, o estado correto é `STORE-CODE-READY`, não “publicado”.
