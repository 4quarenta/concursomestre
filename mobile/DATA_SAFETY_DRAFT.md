# ConcursoMestre Mobile — Data Safety / App Privacy

Atualizado em 10/09/2026.

Este arquivo e um inventario tecnico para preencher Google Play Data safety e Apple App Privacy. Nao substitui revisao juridica nem a auditoria final do backend/provedores.

## Escopo auditado

Primeiro release mobile:

- Questoes;
- Simulados;
- Conta;
- autenticacao/cadastro;
- links externos para Privacidade, Termos, Suporte e Exclusao de conta.

Dependencias nativas atuais nao incluem SDK de publicidade, Firebase Analytics, Sentry, camera, fotos, localizacao ou notificacoes push.

O `app.json` atual nao solicita permissao sensivel de camera, microfone, contatos, localizacao, fotos, saude, SMS ou chamadas.

Se qualquer dependencia nativa for adicionada antes da submissao, este inventario deve ser refeito.

---

## Dados observados no codigo mobile

### Identidade e conta

Dados:

- nome;
- e-mail;
- identificador interno do usuario;
- nivel/XP e configuracoes vinculadas a conta.

Finalidades observadas:

- autenticacao;
- identificacao da conta;
- funcionalidade do app;
- personalizacao/progresso.

### Credenciais e sessao

- senha e usada nos fluxos de login, cadastro, troca de senha e reautenticacao para exclusao;
- access/refresh tokens sao mantidos no armazenamento seguro do dispositivo;
- o app nao persiste senha em texto puro pelo fluxo auditado.

Pendente confirmar no backend:

- algoritmo/hash de senha em producao;
- logs de autenticacao;
- retencao de eventos de seguranca;
- tratamento de tentativas de login e antifraude.

### Atividade educacional

O app envia/consulta informacoes relacionadas a:

- questoes respondidas;
- alternativas/respostas enviadas;
- acertos/erros devolvidos pelo servidor;
- filtros e parametros de pesquisa;
- historico de pratica;
- simulados criados/iniciados/concluidos;
- respostas de simulados;
- score calculado pelo servidor;
- estatisticas, XP e progresso.

Finalidades observadas:

- funcionalidade principal;
- sincronizacao entre sessoes;
- historico de estudo;
- personalizacao e gamificacao.

### Conteudo informado pelo usuario

Conforme os fluxos presentes no projeto, podem existir:

- anotacoes/comentarios ligados ao estudo;
- motivo informado na solicitacao de exclusao;
- chamados/sugestoes enviados pela plataforma web quando o usuario abre a central de suporte.

Para a declaracao mobile final, diferenciar o que e enviado diretamente pelo binario do que e coletado somente na pagina web aberta no navegador externo.

### Assinatura e informacao financeira

O app pode consultar do backend:

- plano/status da assinatura;
- periodo/ciclo;
- renovacao;
- provedor de pagamento;
- transacoes/valores/status quando a superficie direta estiver em uso.

O primeiro binario `store` nao inicia compra, upgrade, reativacao paga, checkout nem Stripe Billing Portal.

O MVP nao possui formulario nativo para numero integral de cartao.

Pendente na declaracao final:

- confirmar se historico de compra deve ser declarado como dado coletado pelo app nas lojas, considerando que parte da informacao se origina fora do binario e e apenas consultada pelo cliente;
- auditar quais processadores estao ativos em producao;
- auditar CPF/endereco/dados fiscais mantidos pelo backend e se algum deles trafega no mobile.

---

## Google Play Data safety — mapa provisório

> Estado `PROVISORIO` significa: a categoria e suportada pelo codigo auditado, mas as colunas "coletado/compartilhado", finalidade e retencao precisam ser confirmadas contra backend e provedores antes de salvar o formulario no Play Console.

| Categoria Google | Dado | Estado tecnico | Finalidade observada | Observacao |
| --- | --- | --- | --- | --- |
| Personal info | Name | PROVISORIO | App functionality / Account management | Enviado no cadastro/perfil. |
| Personal info | Email address | PROVISORIO | App functionality / Account management | Usado para autenticacao/conta. |
| Personal info | User IDs | PROVISORIO | App functionality | Identificador interno acompanha recursos autenticados. |
| App activity | App interactions | PROVISORIO | App functionality | Respostas, simulados, progresso e interacoes de estudo. |
| App activity | Search history | AUDITAR | App functionality | Filtros/pesquisas trafegam para API; confirmar retencao/logs. |
| User-generated content | Other user-generated content | AUDITAR | App functionality | Anotacoes/comentarios somente se realmente ativos no primeiro binario. |
| Financial info | Purchase history | AUDITAR | Account management | Consultado do servidor; confirmar enquadramento final do formulario. |
| App info and performance | Crash logs | NAO OBSERVADO | - | Nenhum crash SDK atual. Reavaliar se adicionar telemetria. |
| App info and performance | Diagnostics | NAO OBSERVADO | - | Nenhum SDK dedicado atual. |
| Device or other IDs | Device or other IDs | NAO OBSERVADO DIRETAMENTE | - | Auditar servidor/provedores para IDs de dispositivo/rede. |
| Location | Approximate/precise location | NAO SOLICITADO | - | Auditar apenas eventual inferencia por IP no backend. |

### Exclusao de conta — Play

Confirmado no codigo:

- caminho dentro do app;
- recurso web publico em `https://concursomestre.com/account-deletion`;
- pagina publica identifica o ConcursoMestre e leva ao fluxo autenticado real;
- o pedido nativo exige reautenticacao.

Pendente:

- confirmar deploy em producao;
- confirmar tratamento efetivo do pedido no backend;
- definir claramente prazos/hipoteses de retencao na Politica de Privacidade;
- preencher o campo de account deletion no Play Console.

Referencia:
- https://support.google.com/googleplay/android-developer/answer/13327111

---

## Apple App Privacy — mapa provisório

| Categoria Apple | Tipo de dado | Estado tecnico | Vinculado ao usuario? | Uso observado |
| --- | --- | --- | --- | --- |
| Contact Info | Name | PROVISORIO | Sim | App Functionality / Account Management |
| Contact Info | Email Address | PROVISORIO | Sim | App Functionality / Account Management |
| Identifiers | User ID | PROVISORIO | Sim | App Functionality |
| User Content | Other User Content | AUDITAR | Sim | Respostas/anotacoes quando persistidas pelo servidor |
| Usage Data | Product Interaction | PROVISORIO | Sim | Questoes, simulados, progresso |
| Purchases | Purchase History | AUDITAR | Sim | Estado da assinatura consultado do backend |
| Diagnostics | Crash Data | NAO OBSERVADO | - | Nenhum crash SDK atual |
| Diagnostics | Performance Data | NAO OBSERVADO | - | Nenhum SDK dedicado atual |
| Location | Precise/Coarse Location | NAO SOLICITADO | - | Sem permissao de localizacao no app |
| Contacts | Contacts | NAO SOLICITADO | - | Sem permissao/dependencia |
| Photos or Videos | Photos/Videos | NAO SOLICITADO | - | Sem permissao/dependencia no primeiro release |
| Audio Data | Audio | NAO SOLICITADO | - | Sem permissao/dependencia |
| Health & Fitness | Health/Fitness | NAO SOLICITADO | - | Sem permissao/dependencia |

### Tracking Apple

Pelo conjunto atual de dependencias mobile:

- nao ha SDK de publicidade;
- nao ha SDK de attribution;
- nao ha pedido de ATT;
- nao foi observado uso de IDFA;
- nao deve ser declarado tracking como `Yes` sem que outro SDK/provedor final introduza esse comportamento.

Estado: `NAO OBSERVADO NO BINARIO ATUAL`, sujeito a auditoria final.

---

## Dados nao solicitados diretamente pelo primeiro release

Pelo codigo mobile auditado nesta fase, o MVP nao solicita diretamente:

- localizacao precisa/aproximada;
- contatos;
- calendario;
- microfone;
- biblioteca de fotos;
- camera;
- dados de saude/fitness;
- SMS/chamadas;
- arquivos pessoais arbitrarios.

Nao ha push notification no primeiro release e nao ha SDK de publicidade/analytics mobile incluido no `package.json` atual.

---

## Auditoria final obrigatoria do backend/provedores

Antes de preencher os consoles como definitivo, confirmar:

- IP, user-agent, device/network identifiers e retencao em logs;
- cookies/trackers nas paginas web externas;
- Stripe e demais processadores efetivamente ativos;
- dados enviados a provedores de IA, se algum fluxo do MVP mobile os acionar;
- backups e prazos de retencao;
- dados preservados depois de pedido de exclusao por obrigacao legal/fiscal/antifraude;
- eventual telemetria/crash SDK adicionada depois desta auditoria;
- compartilhamento com terceiros versus processamento por prestador de servico;
- se dados sao usados apenas para funcionalidade da conta ou tambem para analytics, marketing/personalizacao publicitaria.

## Gate

As declaracoes Google Data safety e Apple App Privacy so devem ser marcadas como finais depois de:

1. auditar backend e provedores em producao;
2. validar o AAB/IPA final e suas dependencias nativas;
3. confirmar a Politica de Privacidade revisada;
4. reconciliar as respostas dos consoles com o comportamento real do produto.

Este arquivo deve ser atualizado sempre que dependencia nativa, permissao, SDK ou categoria de dado mudar.
