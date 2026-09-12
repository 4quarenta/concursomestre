# ConcursoMestre Mobile — Store Readiness

Atualizado em 11/09/2026.

Este documento registra requisitos que precisam estar resolvidos antes de declarar o app publicavel nas lojas. Requisitos de politica devem ser revalidados imediatamente antes da submissao.

## Estado tecnico

A base mobile trabalha com dois canais separados:

- `preview`: distribuicao direta para testes, gerando APK Android instalavel;
- `production`: binario destinado as lojas, com API publica HTTPS e superficie de conta sem compra, upgrade, reativacao paga ou redirecionamento ao Stripe Billing Portal.

Identificadores nativos atuais:

- App: `ConcursoMestre`
- Versao: `1.0.0`
- Android package: `com.concursomestre.mobile`
- Android versionCode: `1`
- iOS bundleIdentifier: `com.concursomestre.mobile`
- iOS buildNumber: `1`
- iOS primeiro release: iPhone (`supportsTablet=false`); iPad fica fora do escopo ate QA dedicado.

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

A auditoria tecnica de 10/09/2026 encontrou e corrigiu conteudo legado em `privacy` e `terms`.

Corrigido no codigo:

- data de atualizacao movida de 24/05/2024 para 10/09/2026 somente depois da revisao do texto;
- removida referencia combinada `Pagar.me/Stripe`; o backend atual auditado usa integracao Stripe;
- removidas promessas de que metadados do gateway nao passam/nunca ficam no backend;
- exclusao passou a refletir o comportamento real: o pedido e registrado e a conta fica pendente de exclusao, sem prometer eliminacao instantanea;
- incluida possibilidade de retencao por obrigacao legal, fiscal, exercicio de direitos, seguranca ou prevencao a fraude;
- direitos LGPD foram descritos sem prometer funcionalidades que o codigo nao comprova;
- compartilhamento com provedores de IA passou a ser descrito de forma condicional, sem garantir politica de treinamento de terceiros que nao esteja comprovada;
- removidos fallbacks `dpo@concursomestre.ai` e `juridico@concursomestre.ai`; sem e-mail configurado no admin, as paginas encaminham a Central de Suporte;
- Termos passaram a separar contratos por canal e nao prometem reembolso absoluto fora da legislacao/canal aplicavel;
- Termos deixam explicito que IA e conteudo educacional podem conter imprecisoes e que a plataforma nao garante aprovacao.

Estado:

- rotas publicas: PRONTAS no codigo;
- conexao com o app: PRONTA;
- revisao tecnica de coerencia: CONCLUIDA;
- validacao juridica/titular e confirmacao em producao: PENDENTES antes da submissao.

O `store:check` impede a reintroducao das inconsistencias legais mais criticas identificadas nesta auditoria.

## Billing por canal

### Preview / distribuicao direta

O APK de teste usa `AccountScreen` e preserva a superficie administrativa ja existente para assinaturas atuais.

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
- a pagina publica nao permite exclusao anonima e encaminha ao fluxo autenticado;
- backend mobile exige senha atual e marca a conta como pendente de exclusao.

Pendente antes da submissao:

- confirmar as paginas em producao depois do deploy da branch;
- validar o tratamento operacional/final dos pedidos pendentes de exclusao;
- validar a descricao de retencao com o titular/revisao juridica;
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

O primeiro release iOS foi deliberadamente limitado a iPhone. `ios.supportsTablet=false` permanece protegido pelo smoke gate ate existir QA dedicado de iPad. Isso evita anunciar compatibilidade com tablet sem validacao de layout, screenshots e fluxo real.

A Apple exige exclusao de conta dentro do app quando o app permite criacao de conta. O fluxo nativo existe no MVP e deve ser validado no RC fisico.

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
- [ ] Adicionar screenshots finais de iPhone nos tamanhos exigidos.
- [ ] Submeter primeiro ao TestFlight e executar smoke test em iPhone real.

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

`DATA_SAFETY_DRAFT.md` mapeia por categoria o que foi observado no cliente e o que ainda deve ser verificado no backend/provedores.

Antes de finalizar Google Data safety ou Apple App Privacy, confirmar especialmente:

- dados cadastrais e identificadores;
- dados de uso/estudo;
- logs de autenticacao/IP/user-agent e retencao;
- dados de pagamento e processadores efetivamente ativos;
- provedores de IA acionados pelos fluxos finais;
- analytics/crash reporting, se houver;
- SDKs de publicidade, se forem adicionados;
- finalidade, retencao e compartilhamento de cada categoria.

## GitHub Actions / RC

No head desta fase, GitHub-hosted runners passaram a falhar antes do primeiro step (`steps: []`, sem logs). O GitHub Status estava operacional e a mesma conta havia executado CI do SnapGym com sucesso horas antes. Isso aponta para problema de provisionamento/entitlement/uso no nivel do runner ou conta, nao para erro registrado no codigo.

Para repositorios privados, GitHub-hosted runners usam a franquia/orcamento de Actions. Como a conexao GitHub deste ambiente nao expoe Billing, o titular deve confirmar em `Settings > Billing` se ha cota/orcamento disponivel antes de abrir chamado com GitHub Support.

Esse diagnostico permanece como hipotese operacional ate ser confirmado na conta.

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

- validacao juridica/titular final de Privacidade e Termos;
- URLs publicas confirmadas no ambiente de producao;
- contas e credenciais das lojas;
- inventario/declaracoes de dados reconciliados com producao;
- assets e metadados das lojas;
- AAB Android assinado validado;
- build iOS/TestFlight assinado validado;
- smoke test em aparelhos reais.

O codigo esta em estado `STORE-CODE-READY`, mas isso nao equivale a publicado ou aprovado nas lojas.
