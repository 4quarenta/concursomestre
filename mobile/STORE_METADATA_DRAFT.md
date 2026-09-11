# ConcursoMestre Mobile — Metadados de loja

Atualizado em 10/09/2026.

Este arquivo prepara o conteudo operacional para Google Play Console e App Store Connect. Os textos abaixo foram escritos para refletir o escopo do primeiro release: Questoes, Simulados e Conta.

## Identidade comum

- Nome do app: `ConcursoMestre`
- Categoria primaria sugerida: Educacao
- Idioma principal: Portugues (Brasil)
- Versao inicial: `1.0.0`
- Android package: `com.concursomestre.mobile`
- iOS bundle identifier: `com.concursomestre.mobile`

## URLs oficiais

- Politica de Privacidade: `https://concursomestre.com/privacy`
- Termos de Uso: `https://concursomestre.com/terms`
- Suporte: `https://concursomestre.com/support`
- Exclusao de conta: `https://concursomestre.com/account-deletion`
- Site: `https://concursomestre.com`

As rotas precisam ser confirmadas no ambiente de producao antes do envio definitivo.

---

## Google Play

### Nome

`ConcursoMestre`

Limite vigente: 30 caracteres.

### Descricao curta

`Questões, simulados e desempenho para sua preparação em concursos.`

66 caracteres; dentro do limite vigente de 80.

### Descricao completa

`ConcursoMestre é uma plataforma de estudos para quem se prepara para concursos públicos.`

`Resolva questões, aplique filtros para encontrar conteúdos relevantes e acompanhe seu histórico de estudo. Monte simulados personalizados, retome tentativas em andamento e consulte o resultado após a conclusão.`

`Na área Conta, você acompanha os dados vinculados ao seu acesso, configurações de segurança e o estado da assinatura associada ao seu perfil.`

`O primeiro release do aplicativo é focado em três áreas principais:`

`• Questões: pratique pelo banco de questões e organize sua resolução com filtros.`

`• Simulados: crie, execute, retome e revise simulados personalizados.`

`• Conta: consulte seus dados, altere sua senha, acompanhe seu acesso e solicite a exclusão da conta.`

`Alguns recursos e conteúdos podem variar conforme o plano associado à conta e a disponibilidade do conteúdo na plataforma.`

### URL de exclusao de conta

`https://concursomestre.com/account-deletion`

Essa URL deve ser informada no campo especifico de exclusao de conta/Data safety da Play Console.

### Primeira faixa de distribuicao

`Internal testing`

O `mobile/eas.json` ja deixa `submit.production.android.track=internal` para o primeiro envio controlado.

---

## App Store

### Nome

`ConcursoMestre`

Limite vigente: 30 caracteres.

### Subtitle

`Questões e simulados`

20 caracteres; dentro do limite vigente de 30.

### Promotional Text

`Resolva questões, monte simulados personalizados e acompanhe seu desempenho em uma experiência de estudo focada em concursos públicos.`

134 caracteres; dentro do limite vigente de 170.

### Description

`ConcursoMestre é uma plataforma de estudos para quem se prepara para concursos públicos.`

`Pratique com questões, use filtros para organizar sua sessão de estudo e acompanhe sua evolução. Crie simulados personalizados, retome tentativas em andamento e revise os resultados após a conclusão.`

`O aplicativo inicial concentra a experiência em três áreas:`

`• Questões — resolução e filtros do banco de questões.`

`• Simulados — criação, execução, retomada, resultado e histórico.`

`• Conta — informações do perfil, segurança, estado do acesso e exclusão de conta.`

`Alguns recursos e conteúdos podem variar conforme o plano associado à conta e a disponibilidade do conteúdo na plataforma.`

### Keywords

`concursos,questões,simulados,estudo,provas,bancas,desempenho`

61 bytes em UTF-8; dentro do limite vigente de 100 bytes.

### Support URL

`https://concursomestre.com/support`

### Privacy Policy URL

`https://concursomestre.com/privacy`

### Fluxo inicial de distribuicao

Primeiro build assinado -> TestFlight -> smoke test em aparelho real -> App Review.

---

## Notas para o revisor

Adaptar para o campo de App Review/Play review quando a conta de teste estiver pronta:

- O aplicativo exige autenticacao para Questoes, Simulados e Conta.
- Uma conta de revisao dedicada sera fornecida no console; nunca versionar a senha no repositorio.
- A opcao de exclusao esta em `Conta > Exclusao da conta`.
- A versao `store` nao inicia compra, upgrade, checkout, reativacao paga ou Stripe Billing Portal.
- O app reconhece o acesso/assinatura ja associado a conta e permite desativar renovacao existente.
- Politica de Privacidade, Termos, Suporte e recurso web de exclusao estao publicados no dominio oficial.

## Screenshots planejadas

Capturar somente do Release Candidate validado, sem dados pessoais reais:

1. Login / entrada do app;
2. Questoes — listagem;
3. Questoes — filtros;
4. Questao respondida/revisao;
5. Simulados — lista;
6. Criacao de simulado;
7. Execucao do simulado;
8. Resultado/historico;
9. Conta na variante `store`.

As screenshots de loja devem ser produzidas a partir do canal `store`, nao da tela de Conta completa do APK direto, para refletir exatamente o binario submetido.

## Assets ainda dependentes do RC

- screenshots finais por tamanho de dispositivo;
- feature graphic do Google Play;
- eventual App Preview/video;
- verificacao visual final do icone e splash em aparelhos reais.

## Itens que permanecem externos

- conta de revisao dedicada;
- classificacao etaria respondida nos questionarios vigentes;
- dados oficiais do titular/desenvolvedor;
- Digital Services Act/Trader status quando exigido pelo App Store Connect;
- formularios Google Data safety e Apple App Privacy;
- revisao legal final de Privacidade e Termos;
- builds assinados e aprovacao das lojas.

## Referencias oficiais verificadas em 10/09/2026

Google Play:
- https://support.google.com/googleplay/android-developer/answer/9859152
- https://support.google.com/googleplay/android-developer/answer/9866151

App Store Connect:
- https://developer.apple.com/help/app-store-connect/reference/app-information/app-information
- https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information
