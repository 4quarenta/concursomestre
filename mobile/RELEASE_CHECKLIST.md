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
- [x] Rotas legadas `MainTabs`, `Checkout` e `SimulationRun` removidas do caminho publicável
- [x] Simulados usam `/simulados/executar`
- [x] API não-dev exige endpoint público em HTTPS
- [x] Refresh de token com single-flight
- [x] Gate estático contra exposição/regressão de gabarito e `is_correct` calculado pelo cliente
- [x] Política offline do MVP definida

## Quality gates automatizados

- [x] `npm ci` definido no Mobile CI
- [x] `expo install --check`
- [x] `expo-doctor`
- [x] `npm run contract:check`
- [x] TypeScript `typecheck`
- [ ] Execução verde do Mobile CI no head do RC

> Estado em 10/09/2026: o GitHub Actions encerrou execuções recentes antes de iniciar qualquer step (`steps: null`/`steps: []`). Este item permanece pendente até o runner voltar a provisionar jobs normalmente; não deve ser marcado como falha funcional do app sem execução dos steps.

## Build / distribuição

- [x] Workflow de preview Android configurado
- [x] Android publica independentemente do resultado do iOS Simulator
- [x] Checksum SHA-256 previsto para o APK
- [ ] APK Android RC compilado com sucesso no head atual
- [ ] GitHub pre-release `mobile-preview-v1.0.0-b1` criada
- [ ] Asset `ConcursoMestre-Android-preview.apk` confirmado na release
- [ ] Asset `ConcursoMestre-Android-preview.apk.sha256` confirmado na release
- [ ] iOS Simulator compilado/anexado, se disponível

## Smoke test em aparelho físico — Android

Executar somente depois de existir APK do head atual.

- [ ] Instalação limpa do APK
- [ ] Abertura sem Metro/PC
- [ ] Login válido
- [ ] Login inválido apresenta erro e não trava
- [ ] Persistência de sessão após fechar/reabrir
- [ ] Logout e proteção das rotas autenticadas
- [ ] Abrir Questões, aplicar filtros e responder questão
- [ ] Confirmar que correção/gabarito vem do servidor
- [ ] Criar/iniciar simulado
- [ ] Recuperar simulado em andamento após reiniciar o app
- [ ] Concluir simulado e abrir histórico
- [ ] Abrir Conta
- [ ] Testar perda e retorno de conexão
- [ ] Verificar telas em tema claro/escuro
- [ ] Verificar navegação/voltar sem loops ou rotas inexistentes

## iPhone

- [ ] Smoke test em iPhone físico

O `.app.zip` do workflow atual é para **iOS Simulator** e não instala em iPhone físico. Distribuição física deve ser feita por TestFlight/internal distribution em etapa própria.

## Critério para encerrar F7

F7 pode ser considerada concluída quando:

1. os quality gates automatizados executarem e ficarem verdes no commit candidato;
2. o APK Android do mesmo commit for gerado e anexado à GitHub pre-release;
3. o smoke test Android não revelar bloqueador P0/P1;
4. qualquer limitação de iOS ficar explicitamente registrada antes do lançamento público.

Até esses critérios serem atendidos, o código pode estar **RC-ready**, mas não deve ser declarado release validado.
