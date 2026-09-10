# ConcursoMestre Mobile — Store Readiness

Atualizado em 10/09/2026.

Este documento registra requisitos que precisam estar resolvidos antes de declarar o app publicavel nas lojas. Requisitos de politica devem ser revalidados imediatamente antes da submissao.

## Recursos publicos

Rotas ja existentes/conectadas no projeto:

- Politica de Privacidade: `https://concursomestre.com/privacy`
- Termos de Uso: `https://concursomestre.com/terms`
- Suporte: `https://concursomestre.com/support`
- Exclusao de conta: `https://concursomestre.com/account-deletion`

O app centraliza essas URLs em `mobile/src/config/publicLinks.ts`. Privacidade, Termos e Suporte ficam acessiveis antes do login; Termos e Privacidade tambem aparecem no fluxo de cadastro.

### Gate de conteudo legal

A existencia da rota nao significa aprovacao juridica do conteudo. Na auditoria de 10/09/2026, `privacy` e `terms` ainda exibiam ultima atualizacao de 24/05/2024 e continham referencias que precisam ser reconciliadas com o produto atual. Portanto:

- rotas publicas: PRONTAS no codigo;
- conexao com o app: PRONTA;
- revisao juridica/conteudo e publicacao definitiva: PENDENTE antes da submissao.

Nao alterar apenas a data para simular revisao.

## Android / Google Play

### Compatibilidade tecnica

- Expo SDK 57 usa `compileSdkVersion 36` e `targetSdkVersion 36`.
- Desde 31/08/2026, novos apps e updates para celulares/tablets precisam mirar Android 16 / API 36 ou superior.
- O stack atual atende esse requisito, sujeito a confirmacao no AAB final gerado.

Referencias oficiais:
- https://docs.expo.dev/versions/latest/
- https://developer.android.com/google/play/requirements/target-sdk

### Billing

O ConcursoMestre oferece assinatura para acesso a conteudo/funcionalidade digital. Apps distribuidos pelo Google Play que vendem esse tipo de acesso precisam usar Google Play Billing, salvo programa/excecao aplicavel.

Antes da submissao deve ser escolhida e implementada uma estrategia explicita:

1. Google Play Billing para compras/assinaturas originadas no Android; ou
2. programa de billing alternativo elegivel e devidamente inscrito/configurado; ou
3. app sem oferta/CTA de compra externa dentro da versao Play, preservando apenas acesso a assinatura adquirida por canal permitido, se a politica vigente permitir esse modelo.

Nao considerar o portal Stripe atual como solucao automaticamente compativel com a Play Store.

Referencias oficiais:
- https://support.google.com/googleplay/android-developer/answer/9858738
- https://support.google.com/googleplay/android-developer/answer/10281818

### Exclusao de conta

- solicitacao dentro do app: implementada;
- fluxo autenticado web em `/profile/security`: existente;
- pagina publica descobrivel `/account-deletion`: implementada;
- a pagina publica nao permite exclusao anonima e encaminha ao fluxo autenticado.

Pendente antes da submissao:
- confirmar a pagina em producao depois do deploy da branch;
- revisar a descricao de retencao com a Politica de Privacidade;
- informar a URL no Play Console.

Referencia oficial:
- https://support.google.com/googleplay/android-developer/answer/13327111

## iOS / App Store

### Conta

A Apple exige exclusao de conta dentro do app quando o app permite criacao de conta. O fluxo nativo ja existe no MVP e deve ser validado no RC fisico.

Referencia oficial:
- https://developer.apple.com/app-store/review/guidelines/

### Assinaturas e conteudo digital

O ConcursoMestre desbloqueia conteudo/funcionalidade digital por assinatura. A regra geral da App Store exige In-App Purchase para esse tipo de desbloqueio, salvo excecao aplicavel.

Antes da submissao deve ser definido:
- se o produto se enquadra legitimamente em alguma excecao das diretrizes; ou
- implementar assinatura via StoreKit / In-App Purchase para o iOS; e
- remover/ocultar CTAs de compra externa que nao sejam permitidos na storefront/regiao aplicavel.

Nao considerar o portal Stripe atual como solucao automaticamente compativel com a App Store.

Referencia oficial:
- https://developer.apple.com/app-store/review/guidelines/

## Distribuicao

`mobile/eas.json` ja possui perfis:

- `development`: development client interno;
- `preview`: APK Android interno;
- `preview-simulator`: build de iOS Simulator;
- `production`: distribuicao de loja e Android App Bundle;
- `submit.production`: reservado para submissao depois da vinculacao das contas.

Pendente por depender do titular das contas:
- vincular o projeto a uma conta Expo/EAS;
- configurar credenciais de assinatura Android;
- configurar Apple Developer/App Store Connect;
- configurar Google Play Console/service account quando aplicavel;
- gerar e validar os builds assinados finais.

## Pendencias comuns das duas lojas

- Release Candidate validado em aparelho real.
- Revisao final de Politica de Privacidade e Termos.
- Confirmacao das URLs publicas em producao.
- Declaracoes de coleta/uso de dados coerentes com o codigo e backend.
- Screenshots e textos da loja.
- Classificacao etaria/categoria.
- Credenciais de conta de revisao caso conteudo autenticado seja necessario para avaliacao.
- Estrategia de billing aprovada para Android e iOS.
- AAB Android assinado e validado.
- Archive iOS/TestFlight assinado e validado.

## Gate

F8 nao pode ser marcada como concluida enquanto billing, revisao legal, recursos publicos em producao, credenciais, assets/metadados e builds assinados nao estiverem resolvidos. O codigo pode estar funcionalmente pronto antes disso, mas nao deve ser chamado de publicavel nas lojas.
