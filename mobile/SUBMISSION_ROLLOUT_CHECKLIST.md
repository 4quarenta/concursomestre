# ConcursoMestre Mobile — Submissão e Rollout

## Objetivo

Checklist operacional da F9. Esta fase só começa de fato depois que o Release Candidate passar pelos testes da F7 e as pendências externas da F8 forem encerradas.

## Pré-condições obrigatórias

- [ ] Mobile CI completo em verde no commit candidato.
- [ ] `npm run contracts:check`, `npm run qa:smoke`, `npm run store:check` e `npm run typecheck` aprovados.
- [ ] Android RC validado em aparelho físico.
- [ ] iPhone RC validado em aparelho físico via TestFlight ou distribuição equivalente.
- [ ] `/privacy`, `/terms`, `/support` e `/account-deletion` publicados e acessíveis em produção.
- [ ] Política de Privacidade e Termos revisados juridicamente.
- [ ] Google Data Safety preenchido com base na auditoria final do app/backend/provedores.
- [ ] Apple App Privacy preenchido com base na mesma auditoria final.
- [ ] Conta Google Play Console ativa e app `com.concursomestre.mobile` reservado/criado.
- [ ] Conta Apple Developer/App Store Connect ativa e bundle `com.concursomestre.mobile` registrado.
- [ ] Credenciais de assinatura Android e iOS configuradas no EAS ou processo equivalente.
- [ ] Screenshots e metadados finais aprovados.
- [ ] Versão, `versionCode` e `buildNumber` congelados para o release.

## Build final

### Android

1. Confirmar `mobile/app.json` com versão final e `android.versionCode` incrementado.
2. Gerar build de produção usando o perfil `production` do `mobile/eas.json`.
3. Validar que o artefato é AAB assinado.
4. Instalar/testar o build equivalente de release em dispositivo real antes do envio.
5. Registrar SHA/checksum do artefato aprovado.

### iOS

1. Confirmar `mobile/app.json` com versão final e `ios.buildNumber` incrementado.
2. Gerar build de produção assinado para App Store Connect.
3. Enviar primeiro ao TestFlight.
4. Executar smoke test em iPhone real usando exatamente o build que seguirá para revisão.
5. Registrar o build aprovado e manter o mesmo binário para submissão, salvo correção obrigatória.

## Google Play — ordem recomendada

1. Subir o AAB na faixa de teste interno.
2. Validar instalação, login, Questões, Simulados, Conta, troca de senha, exclusão e logout.
3. Promover para teste fechado somente após o smoke interno.
4. Corrigir qualquer bloqueio apontado pelo Play Console antes de produção.
5. Preencher ficha da loja, política de privacidade, exclusão de conta, classificação etária e Data Safety.
6. Enviar para revisão.
7. Após aprovação, usar rollout gradual em vez de 100% imediato.

## App Store — ordem recomendada

1. Enviar o build ao TestFlight.
2. Validar o build em iPhone real.
3. Configurar App Privacy, classificação etária, suporte e política de privacidade.
4. Vincular screenshots e metadados finais.
5. Preencher notas de revisão com instruções de login/teste, se necessário.
6. Enviar para App Review.
7. Após aprovação, liberar de forma manual/controlada.

## Rollout controlado

### Android

Sugestão inicial:

- 5% — observar por 24 h.
- 20% — ampliar se não houver regressão relevante.
- 50% — ampliar após nova janela de estabilidade.
- 100% — somente com autenticação, API e crashes estáveis.

### iOS

Usar liberação manual ou phased release quando disponível e coerente com a estratégia escolhida. Não liberar automaticamente se ainda houver validação operacional pendente.

## Métricas mínimas pós-release

Monitorar prioritariamente:

- falhas de login/refresh de sessão;
- HTTP 401/429/5xx;
- crashes e ANRs;
- falhas ao carregar Questões;
- falhas ao iniciar, retomar ou concluir Simulados;
- inconsistências de plano/assinatura na Conta;
- falhas de exclusão de conta;
- tempo de resposta da API;
- aumento anormal de tickets de suporte.

## Critérios de rollback/interrupção

Interromper expansão do rollout se ocorrer qualquer um dos seguintes:

- regressão de autenticação em massa;
- crash recorrente em fluxo principal;
- vazamento de gabarito/score antes da submissão autorizada;
- indisponibilidade relevante de Questões ou Simulados;
- erro que exponha cobrança/upgrade indevido em build de loja;
- falha grave no fluxo de exclusão/privacidade;
- aumento expressivo de 5xx ou timeout sem mitigação rápida.

## Versionamento

Antes de qualquer novo binário enviado às lojas:

- manter `expo.version` como versão pública (`x.y.z`);
- incrementar `android.versionCode` a cada AAB enviado;
- incrementar `ios.buildNumber` a cada build enviado ao App Store Connect;
- nunca reutilizar número de build já submetido;
- registrar tag Git correspondente ao binário efetivamente aprovado.

## Estado

**F9 — PREPARADA, NÃO INICIADA.**

A automação/configuração de build já está preparada, mas a submissão real depende de concluir F7 e as pendências externas da F8, além de credenciais válidas Google/Apple.
