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
- [x] TypeScript `typecheck`
- [ ] Execução verde do Mobile CI no head do RC

O `qa:smoke` valida versão/build, identificadores nativos, scheme, HTTPS, rotas do MVP, remoção das bridges, proteção de sessão, recursos web públicos e links legais pré-login.

> Estado em 10/09/2026: execuções recentes do GitHub Actions encerraram antes de iniciar qualquer step (`steps: []`, `runner_id: 0`). Este item permanece pendente até o runner voltar a provisionar jobs normalmente.

## Build / distribuição

- [x] Workflow de preview Android configurado
- [x] Android publica independentemente do resultado do iOS Simulator
- [x] iOS Simulator opcional/`continue-on-error`
- [x] Checksum SHA-256 previsto para o APK
- [x] `eas.json` preparado para development, preview, simulator e production/store
- [ ] Projeto vinculado a Expo/EAS do titular
- [ ] Credenciais Android/iOS configuradas
- [ ] APK Android RC compilado com sucesso no head atual
- [ ] GitHub pre-release `mobile-preview-v1.0.0-b1` criada
- [ ] APK e SHA-256 confirmados na release
- [ ] iOS Simulator compilado/anexado, se disponível

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
- [ ] Deploy/validação das quatro URLs em produção
- [ ] Revisão jurídica/conteúdo de Privacidade e Termos

Observação: na auditoria de 10/09/2026, Privacidade e Termos ainda exibiam data de atualização de 24/05/2024 e referências que precisam ser reconciliadas com o produto atual. A rota pronta não equivale a conteúdo legal aprovado.

## Smoke test em aparelho físico — Android

Executar somente depois de existir APK do head atual.

- [ ] Instalação limpa do APK
- [ ] Abertura sem Metro/PC
- [ ] Login válido e inválido
- [ ] Persistência de sessão
- [ ] Logout e proteção das rotas
- [ ] Questões: filtros, resposta e correção server-side
- [ ] Simulado: criar, retomar, concluir e revisar
- [ ] Conta e exclusão
- [ ] Perda/retorno de conexão
- [ ] Tema claro/escuro
- [ ] Navegação/voltar/deep links

## iPhone

- [ ] Smoke test em iPhone físico via distribuição apropriada

O `.app.zip` do workflow atual é apenas para iOS Simulator. iPhone físico deve usar TestFlight/internal distribution.

## Store readiness

- [x] Expo SDK 57 / target Android API 36 compatível com a exigência técnica atual
- [x] Exclusão de conta dentro do app
- [x] Recurso web externo de exclusão implementado no código
- [x] Política/Termos/Suporte possuem rotas públicas
- [x] Perfis EAS de distribuição preparados
- [ ] Estratégia de billing compatível com Google Play definida/implementada
- [ ] Estratégia de billing compatível com App Store definida/implementada
- [ ] Revisão legal final
- [ ] URLs confirmadas em produção
- [ ] Credenciais/contas de desenvolvedor e assinatura configuradas
- [ ] AAB Android final validado
- [ ] TestFlight/archive iOS final validado
- [ ] Metadados, screenshots, classificação etária e Data safety/App Privacy preenchidos

## Critério para encerrar F7

F7 pode ser considerada concluída quando:

1. os quality gates executarem e ficarem verdes no commit candidato;
2. o APK Android do mesmo commit for gerado e anexado à GitHub pre-release;
3. o smoke test Android não revelar bloqueador P0/P1;
4. qualquer limitação de iOS ficar explicitamente registrada.

Até esses critérios serem atendidos, o código pode estar RC-ready, mas não deve ser declarado release validado.
