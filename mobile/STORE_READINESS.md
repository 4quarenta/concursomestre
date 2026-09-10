# ConcursoMestre Mobile — Store Readiness

Atualizado em 10/09/2026.

Este documento registra requisitos que precisam estar resolvidos antes de declarar o app publicavel nas lojas. Requisitos de politica devem ser revalidados imediatamente antes da submissao.

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

O app ja oferece solicitacao de exclusao dentro da Conta. O Google Play exige tambem um recurso web externo informado no Play Console para usuarios de apps com criacao de conta.

Pendente antes da submissao:
- criar/confirmar URL publica de exclusao de conta no dominio ConcursoMestre;
- garantir que a politica de retencao descreva dados que precisem ser mantidos por obrigacao legal/financeira;
- informar a URL no formulario Data safety / Account deletion do Play Console.

Referencia oficial:
- https://support.google.com/googleplay/android-developer/answer/13327111

## iOS / App Store

### Conta

A Apple exige exclusao de conta dentro do app quando o app permite criacao de conta. O fluxo nativo ja existe no MVP e deve ser validado no RC fisico.

Referencia oficial:
- https://developer.apple.com/app-store/review/guidelines/

### Assinaturas e conteudo digital

O ConcursoMestre desbloqueia conteudo/funcionalidade digital por assinatura. A regra geral da App Store exige In-App Purchase para esse tipo de desbloqueio, salvo excecao aplicavel (por exemplo, categorias especificas previstas nas diretrizes).

Antes da submissao deve ser definido:
- se o produto se enquadra legitimamente em alguma excecao das diretrizes; ou
- implementar assinatura via StoreKit / In-App Purchase para o iOS; e
- remover/ocultar CTAs de compra externa que nao sejam permitidos na storefront/regiao aplicavel.

Nao considerar o portal Stripe atual como solucao automaticamente compativel com a App Store.

Referencia oficial:
- https://developer.apple.com/app-store/review/guidelines/

## Pendencias comuns das duas lojas

- Release Candidate validado em aparelho real.
- Politica de privacidade publica e acessivel.
- Termos de uso publicos e acessiveis.
- URL publica de suporte.
- URL publica de exclusao de conta para Google Play.
- Declaracoes de coleta/uso de dados coerentes com o codigo e backend.
- Icone e splash finais.
- Screenshots e textos da loja.
- Classificacao etaria/categoria.
- Credenciais de conta de revisao caso conteudo autenticado seja necessario para avaliacao.
- Estrategia de billing aprovada para Android e iOS.
- AAB Android assinado e validado.
- Archive iOS/TestFlight assinado e validado.

## Gate

F8 nao pode ser marcada como concluida enquanto billing, exclusao web, documentos legais, assets e builds assinados nao estiverem resolvidos. O codigo pode estar funcionalmente pronto antes disso, mas nao deve ser chamado de publicavel nas lojas.
