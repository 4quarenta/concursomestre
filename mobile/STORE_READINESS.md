# ConcursoMestre Mobile — Store Readiness

Atualizado em 10/09/2026.

Este documento registra requisitos que precisam estar resolvidos antes de declarar o app publicavel nas lojas. Requisitos de politica devem ser revalidados imediatamente antes da submissao.

## Estado tecnico

A base mobile agora trabalha com dois canais separados:

- `preview`: distribuicao direta para testes, gerando APK Android instalavel;
- `production`: binario destinado as lojas, com API publica HTTPS e superficie de conta sem compra, upgrade, reativacao paga ou redirecionamento ao Stripe Billing Portal.

Identificadores nativos atuais:

- App: `ConcursoMestre`
- Versao: `1.0.0`
- Android package: `com.concursomestre.mobile`
- Android versionCode: `1`
- iOS bundleIdentifier: `com.concursomestre.mobile`
- iOS buildNumber: `1`

## Recursos publicos

URLs oficiais centralizadas em `mobile/src/config/publicLinks.ts`:

- Politica de Privacidade: `https://concursomestre.com/privacy`
- Termos de Uso: `https://concursomestre.com/terms`
- Suporte: `https://concursomestre.com/support`
- Exclusao de conta: `https://concursomestre.com/account-deletion`

Privacidade, Termos e Suporte ficam acessiveis antes do login. Termos e Privacidade tambem aparecem no cadastro.

A exclusao de conta possui dois caminhos:

1. dentro do app, em Conta > Exclusao da conta, com reautenticacao;
2. fora do app, pela URL publica acima, que encaminha ao fluxo autenticado da plataforma web em `/profile/security`.

### Gate de conteudo legal

A existencia da rota nao significa aprovacao juridica do conteudo. Na auditoria de 10/09/2026, `privacy` e `terms` ainda exibiam ultima atualizacao de 24/05/2024 e continham referencias que precisam ser reconciliadas com o produto atual. Portanto:

- rotas publicas: PRONTAS no codigo;
- conexao com o app: PRONTA;
- revisao juridica/conteudo e publicacao definitiva: PENDENTE antes da submissao.

Nao alterar apenas a data para simular revisao.

## Billing por canal

### Preview / distribuicao direta

O APK de teste continua usando `AccountScreen` e preserva a superficie administrativa ja existente para assinaturas atuais.

### Store

O perfil `production` define `EXPO_PUBLIC_DISTRIBUTION_CHANNEL=store`. Nesse canal a tab Conta usa `StoreAccountScreen`, que:

- reconhece o plano e a assinatura ja associados a conta;
- nao inicia compra, upgrade ou reativacao paga;
- nao abre Stripe Billing Portal;
- permite desativar a renovacao da assinatura existente;
- permite alterar senha;
- permite solicitar exclusao da conta;
- expoe Privacidade, Termos, Suporte e Exclusao web.

Esse isolamento reduz o risco de um binario de loja direcionar o usuario a um metodo de pagamento externo para conteudo digital.

Se compras digitais forem adicionadas dentro do binario de loja, deverao ser implementadas conforme o mecanismo de billing e as regras da loja/regiao aplicavel antes da publicacao.

Referencias oficiais:

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Google Play Payments: https://support.google.com/googleplay/android-developer/answer/9858738
- Google Play Payments FAQ: https://support.google.com/googleplay/android-developer/answer/10281818

## Android / Google Play

### Exclusao de conta

- solicitacao dentro do app: implementada;
- fluxo autenticado web em `/profile/security`: existente;
- pagina publica descobrivel `/account-deletion`: implementada;
- a pagina publica nao permite exclusao anonima e encaminha ao fluxo autenticado.

Pendente antes da submissao:

- confirmar a pagina em producao depois do deploy da branch;
- revisar a descricao de retencao com a Politica de Privacidade;
- informar `https://concursomestre.com/account-deletion` no Play Console.

Referencia oficial:

- https://support.google.com/googleplay/android-developer/answer/13327111

### Pendencias externas Google Play

- [ ] Criar/vincular o app no Google Play Console.
- [ ] Configurar credencial de assinatura Android/EAS.
- [ ] Gerar o primeiro AAB de producao.
- [ ] Enviar inicialmente para a faixa Internal testing.
- [ ] Preencher Data safety com base no inventario real de dados e SDKs.
- [ ] Informar a URL publica de exclusao da conta.
- [ ] Informar a Politica de Privacidade.
- [ ] Preencher classificacao indicativa, categoria, publico-alvo e declaracoes obrigatorias.
- [ ] Adicionar descricao, icone, feature graphic e screenshots finais.
- [ ] Revisar qualquer SDK de anuncios/analytics antes de declarar Data safety.

## iOS / App Store

A Apple exige exclusao de conta dentro do app quando o app permite criacao de conta. O fluxo nativo ja existe no MVP e deve ser validado no RC fisico.

Referencia oficial:

- https://developer.apple.com/support/offering-account-deletion-in-your-app

### Pendencias externas App Store

- [ ] Criar/vincular o app no App Store Connect.
- [ ] Vincular credenciais/certificados Apple ao EAS.
- [ ] Gerar build de producao para dispositivo real/TestFlight.
- [ ] Preencher App Privacy com base no inventario real de dados e SDKs.
- [ ] Informar Politica de Privacidade e URL de Suporte.
- [ ] Revisar declaracao de criptografia/export compliance antes de configurar qualquer flag automatica.
- [ ] Preencher classificacao etaria, categoria e metadados da listagem.
- [ ] Adicionar screenshots finais nos tamanhos exigidos.
- [ ] Submeter primeiro ao TestFlight e executar smoke test em aparelho real.

## EAS

`mobile/eas.json` possui os perfis:

- `preview`: distribuicao interna + APK Android;
- `preview-simulator`: build para iOS Simulator;
- `production`: distribuicao `store` + Android App Bundle;
- `submit.production.android`: primeira submissao na faixa `internal` da Play Console.

A API publica utilizada pelos perfis distribuiveis e:

`https://concursomestre.com/api/`

Nenhuma credencial de assinatura ou chave de loja deve ser versionada no GitHub.

Pendente por depender do titular das contas:

- vincular o projeto a uma conta Expo/EAS;
- configurar credenciais de assinatura Android;
- configurar Apple Developer/App Store Connect;
- configurar Google Play Console/service account quando aplicavel;
- gerar e validar os builds assinados finais.

## Inventario de dados

Antes de preencher Google Data safety ou Apple App Privacy, auditar o binario final e listar exatamente:

- dados cadastrais coletados;
- dados de uso/estudo;
- autenticacao e identificadores;
- dados de pagamento processados por terceiros;
- analytics/crash reporting, se houver;
- SDKs de publicidade, quando forem adicionados;
- finalidade de cada coleta, retencao e compartilhamento.

## Comandos de distribuicao

Executar a partir de `mobile/` apos vincular o projeto a conta Expo/EAS:

```bash
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview-simulator
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile production
```

Primeiro envio Android para a faixa de testes interna:

```bash
npx eas-cli submit --platform android --profile production --latest
```

No iOS, o fluxo recomendado e enviar o build de producao ao TestFlight e so depois iniciar App Review.

## Gate final da F8

F8 nao pode ser marcada como completamente concluida enquanto estes itens externos permanecerem pendentes:

- revisao legal final de Privacidade e Termos;
- URLs publicas confirmadas no ambiente de producao;
- contas e credenciais das lojas;
- inventario/declarações de dados;
- assets e metadados das lojas;
- AAB Android assinado validado;
- build iOS/TestFlight assinado validado;
- smoke test em aparelhos reais.

O codigo pode atingir `STORE-CODE-READY` antes disso, mas nao deve ser chamado de publicado ou aprovado nas lojas.
