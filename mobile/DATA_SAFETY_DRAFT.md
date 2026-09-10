# ConcursoMestre Mobile — Data Safety / App Privacy (rascunho tecnico)

Atualizado em 10/09/2026.

Este arquivo e um inventario tecnico para preencher Google Play Data safety e Apple App Privacy. Nao substitui revisao juridica nem a auditoria final do backend/provedores.

## Dados usados pelo MVP mobile

### Identidade e conta

- nome;
- e-mail;
- identificador interno do usuario;
- nivel/XP e configuracoes vinculadas a conta.

Finalidades observadas no app: autenticacao, identificacao da conta, personalizacao e progresso.

### Credenciais e sessao

- senha e usada nos fluxos de login, troca de senha, cadastro e reautenticacao para exclusao;
- access/refresh tokens sao mantidos no armazenamento seguro do dispositivo;
- o app nao deve persistir senha em texto puro.

A declaracao final deve confirmar no backend hashing, retencao e logs relacionados a credenciais.

### Conteudo gerado pelo usuario

- respostas de questoes;
- comentarios e respostas a comentarios;
- anotacoes;
- simulados e respostas;
- chamados/sugestoes de suporte, quando usados;
- motivo informado em solicitacao de exclusao.

Finalidades observadas: funcionalidade educacional, historico, sincronizacao, suporte e seguranca da conta.

### Atividade e desempenho educacional

- questoes respondidas;
- acertos/erros;
- historico de pratica;
- simulados iniciados/concluidos;
- score calculado pelo servidor;
- estatisticas, XP e progresso.

Finalidades observadas: recurso principal do produto, progresso, personalizacao e gamificacao.

### Assinatura e historico financeiro

O app consulta:
- plano/status da assinatura;
- periodo/ciclo;
- renovacao;
- provedor de pagamento;
- transacoes recentes e valores/status retornados pelo backend.

O MVP atual nao coleta numero integral de cartao em formulario nativo. O portal Stripe, quando habilitado em distribuicao direta, abre fluxo externo do provedor.

A declaracao final deve auditar o backend e o provedor de pagamento para determinar exatamente quais dados de pagamento/purchase history entram nas declaracoes das lojas.

## Categorias nao usadas pelo MVP atual

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

Nao ha push notification no primeiro release e nao ha SDK de publicidade/analytics mobile incluido no conjunto de dependencias atual.

Se qualquer SDK for adicionado antes da submissao, este inventario deve ser refeito.

## Pontos que exigem auditoria final

Antes de preencher os consoles das lojas, confirmar:

- logs do servidor: IP, user-agent, device/network identifiers e retencao;
- cookies/trackers quando o app abre paginas web externas;
- Stripe e demais processadores efetivamente ativos;
- dados enviados a provedores de IA, se algum fluxo do MVP mobile os acionar;
- backups e prazos de retencao;
- dados preservados depois de pedido de exclusao por obrigacao legal/fiscal/antifraude;
- eventual telemetria/crash SDK adicionada na F7/F8;
- compartilhamento com terceiros versus processamento por prestador de servico.

## Gate

As declaracoes Google Data safety e Apple App Privacy so devem ser preenchidas como finais depois da auditoria de backend/provedores e da decisao de billing. Este arquivo deve ser atualizado sempre que dependencia nativa ou categoria de dado mudar.
