# Registro de implementacao - Admin, Billing, Lei Comentada e Questoes

Data de fechamento: 25/04/2026

Este documento registra a rodada de implementacoes dos ultimos dias no ConcursoMestre. A ideia e deixar rastreavel o que mudou, por que mudou e quais contratos de produto passaram a valer.

## Resumo executivo

- O painel admin foi reorganizado para um padrao inspirado no WordPress: menu lateral compacto, grupos com submenus, paginas proprias por contexto e telas de adicionar/editar encaixadas no layout administrativo.
- O billing Stripe foi consolidado em torno de uma regra unica: contrato atual preservado, renovacao futura pelo preco efetivo vigente, recibos/notificacoes obrigatorios e bloqueio real por inadimplencia ou ausencia de cartao em assinatura ativa.
- A area de Lei Comentada ganhou ferramentas de leitura, melhor performance, comentarios recolhidos por padrao, destaques mais leves, taxonomia hierarquica e editor administrativo mais claro.
- A pratica de questoes recebeu filtros pesquisaveis e multisselecao, com hierarquia Materia > Topico > Assunto, contagem real dos resultados e renderizacao correta de formulas matematicas em KaTeX.
- O perfil passou a centralizar anotacoes, materiais e leis favoritas com navegacao para a origem de cada item.

## Admin WordPress-like

### Navegacao e arquitetura

- Refeito o menu lateral do admin para trabalhar com grupos e submenus suspensos, seguindo o comportamento visual do WordPress.
- O antigo agrupamento "Operacao" foi ajustado para "Conteudo", por representar melhor questoes, provas, importacao, taxonomias e Lei Comentada.
- Submenus de moderacao ligados a suporte/relacionamento foram movidos para fora de conteudo quando nao pertenciam ao fluxo editorial principal.
- Criado um bloco especifico para marketplace, reunindo vendedores, materiais/conteudo e revisao bloqueada.
- Corrigidos problemas de submenu preso ao scroll e menus escondidos na parte inferior da tela.
- Reduzida a altura visual dos itens do menu para aproximar do padrao WordPress.

### Padrao visual das paginas

- Removidos cabecalhos redundantes e breadcrumbs desnecessarios do admin.
- Adotado layout mais proximo do WordPress nas paginas de listagem: titulo da pagina, botao de acao contextual, busca, filtros e tabela.
- O botao de adicionar deixou de ser fixo/global e passou a ser especifico de cada pagina.
- Foram criados componentes compartilhados para colecoes, badges de estado editorial, shell standalone e estilos administrativos.
- Status editorial passou a representar visibilidade/publicacao: publicado, rascunho, programado, etc.

### Add/Edit editorial

- Add/edit de questoes foi migrado para layout encaixado, nao tela cheia.
- Add/edit de leis, provas e usuarios seguem a mesma logica.
- O box "Publicar" foi ajustado para contexto da plataforma, exibindo estado editorial, visibilidade e data/hora de publicacao.
- A tabela de questoes ganhou coluna de data de publicacao com hora, ordenada por itens mais recentes.
- Remocao de questoes passou a usar confirmacao no padrao WordPress e remover a linha da tabela apos sucesso.
- A geracao de Comentario e Analise Detalhada pode ser acionada direto da tabela, com modal de progresso, resultado gerado e acao de salvar.
- Acoes em massa foram adicionadas para selecionar multiplas questoes e aplicar geracao editorial.

## Analytics e moderacao

### Dashboard admin

- Removido o bloco "Questoes recentes".
- O dashboard passou a exibir dados gerais mais relevantes: usuarios, questoes, leis, provas, rankings, comentarios, marketplace e sinais operacionais.
- Foram adicionados insights e indicadores de saude da plataforma em vez de apenas cards estaticos.

### Financeiro

- Criada visao de analytics financeiro/comercial para SaaS:
  - MRR/ARR e receita;
  - churn, inadimplencia, recuperacao e reembolso;
  - funil de cadastro/checkout;
  - segmentos acionaveis.
- Segmentos foram ajustados para nao incluir assinantes vigentes em listas como "ativo sem assinatura".
- Exportacao CSV foi revisada para usar fluxo autenticado correto.
- Receita projetada confirmada passou a usar a tabela padrao de transferencias com status pre-aprovado, em vez de uma tabela isolada.
- A projecao tambem ganhou visao mes a mes para estimar entradas futuras de parcelas/renovacoes.

### Comentarios

- Criada pagina de moderacao de comentarios dentro de Suporte/Relacionamento.
- A tela consolida comentarios de questoes, materiais e Lei Comentada.
- Foram adicionadas abas de Pendente, Aprovado e Spam.
- A tabela resume o alvo/trecho para manter largura padrao e evitar quebra visual.

## Billing Stripe

### Customer e cartoes

- Reforcada a regra de customer canonico: um usuario deve permanecer vinculado ao mesmo `stripe_customer_id`.
- A resolucao do customer prioriza assinatura ativa, usuario local, historico Stripe local e busca remota antes de criar um novo customer.
- A listagem de cartoes passou a buscar a Stripe como fonte de verdade e sincronizar o espelho local.
- Cartoes vinculados a assinatura ativa, especialmente em ciclos mensal, trimestral ou anual, nao podem ser removidos se isso deixaria a assinatura sem metodo de pagamento.
- Quando assinatura ativa nao possui cartao salvo, a plataforma deve exibir banner global e bloquear interacoes premium ate regularizacao.

### Checkout e assinatura duplicada

- O checkout foi protegido para nao abrir quando o usuario ja possui a assinatura vigente do mesmo plano.
- Nesses casos, o usuario e direcionado para a area de assinatura/billing do perfil com toast informativo.
- Ajustada a linguagem de renovacao/cancelamento para evitar confusao entre "renovacao desligada" e "assinatura cancelada".

### Renovacao, recibos e inadimplencia

- O contrato atual fica congelado no preco aceito na contratacao.
- A proxima renovacao usa o preco efetivo vigente: preco publico atual, promocoes automaticas e cupons autoaplicados validos.
- Cupom manual da compra original nao reaplica por padrao.
- A UI do perfil informa valor, data e modalidade da proxima renovacao.
- Pagamento aprovado gera recibo por email e notificacao in-app.
- Falha de cobranca gera email com instrucoes, notificacao in-app e bloqueio real.
- Reminder de renovacao deve ser enviado 5 dias antes, informando valor e modalidade.

Documentos relacionados:

- `docs/BILLING_E_VALIDACAO.md`
- `docs/STRIPE_RENEWAL_PRICING_AND_COLLECTIONS.md`
- `docs/STRIPE_CARD_VAULT_OPERATIONS.md`
- `docs/STRIPE_CUSTOMER_CANONICALIZATION.md`
- `docs/reports/stripe-customer-cleanup-2026-04-22.md`

## Lei Comentada

### Leitura e performance

- Criada barra flutuante de ferramentas de leitura acompanhando a largura dos cards.
- A opcao "Foco" passou a representar o comportamento desejado de imersao, ocultando elementos laterais e mantendo a leitura estavel.
- Removida a funcao de fullscreen nativo do navegador.
- Adicionado modo de leitura "lista" e "artigo por artigo".
- No modo artigo por artigo, a navegacao anterior/proximo faz scroll para o topo do card.
- Comentarios/editoriais ficam fechados por padrao.
- A pagina foi otimizada para reduzir rerenders, especialmente em lista e marcacao de texto.
- A lista continua passou a usar renderizacao progressiva para leis grandes.

### Marcacoes

- Removida a marcacao por bloco.
- A marcacao por selecao foi mantida com estrategia mais leve.
- Em navegadores compativeis, a aplicacao de destaque usa camada nativa/externa ao rerender pesado.
- Em fallback, trechos ficam salvos e acessiveis por chips de "Trechos marcados".
- Entradas antigas de bloco sao toleradas e ignoradas com seguranca.

### Conteudo editorial

- Jurisprudencia recebeu destaque visual roxo para diferenciar dos demais blocos.
- Se nao houver jurisprudencia especifica relevante, o campo fica vazio; nao se deve forcar jurisprudencia generica.
- Artigos finais ou irrelevantes para prova podem permanecer sem comentario/macete/jurisprudencia/sumula.
- As regras de macete e jurisprudencia foram incorporadas ao fluxo editorial: nada de siglas artificiais, jurisprudencia sem conexao ou conteudo inventado.

### Admin de leis

- Add/edit de Lei Comentada foi encaixado no layout administrativo.
- "Area" foi substituida por Materia, usando a taxonomia comum das questoes.
- Nos artigos, o vinculo editorial passou a usar Topico e Assunto.
- Questoes relacionadas deixaram de ser preenchidas manualmente; a contagem deve ser calculada automaticamente pelo vinculo taxonomico.
- Geracao IA de comentario, macete, jurisprudencia e sumula ganhou barra de progresso.
- Restaurada a possibilidade de aplicar conteudo a varios artigos de uma vez e visualizar artigos sem conteudo.
- Criada funcionalidade "O que mudou" para registrar novidades apos sincronizacoes/atualizacoes da lei.
- A tela de updates usa padrao WordPress e pode abrir modal em vez de pagina cheia.

## Questoes e pratica

### Filtros

- Filtros da pagina de pratica passaram a ser pesquisaveis e com multisselecao.
- Regra aplicada: Assunto so pode ser escolhido depois da Materia.
- Topico tambem e selecionavel; selecionar um topico seleciona seus assuntos filhos.
- Assuntos exibidos sao apenas filhos da materia selecionada.
- Dificuldade, modalidade e nivel foram alinhados ao mesmo componente visual dos demais filtros.
- A contagem mostra a quantidade real encontrada, com pluralizacao correta: `1 Questao` e `N Questoes`.

### QuestionCard

- O card passou a buscar leis comentadas/material de estudo relacionados de acordo com materia, topico e assunto disponiveis na plataforma.
- A renderizacao de formulas matematicas foi corrigida com KaTeX oficial, evitando radical infinito e mantendo fracoes no formato correto.
- O HTML rico de enunciado e alternativas usa classe especifica para escopo de sanitizacao e CSS defensivo.
- O icone de check ao salvar anotacao em questao foi removido conforme ajuste de UX.

## Perfil e area do usuario

- "Minhas Anotacoes" passou a consolidar anotacoes de questoes, leis e materiais.
- As anotacoes usam design de lista e linkam de volta para o item de origem.
- Criada aba para leis favoritas.
- "Meus materiais" segue a logica de modulo em desenvolvimento/desativado quando a Loja esta desligada.
- O dashboard do usuario recebeu regra de recurso exclusivo Elite quando aplicavel.
- O card de desempenho geral ganhou insights conforme a porcentagem de desempenho.

## Marca e tema

- A nova logo ConcursoMestre foi aplicada na plataforma.
- Sidebar, topbar, home e footer passaram a alternar versoes light/dark conforme fundo.
- Corrigida a transicao dark/light para evitar quebra visual e animacoes bruscas.

## Taxonomias

- Oficializada a hierarquia do conhecimento:
  - Materia = area raiz;
  - Topico = tema principal dentro da materia;
  - Assunto = conceito especifico dentro do topico.
- Todo topico deve estar vinculado a uma materia.
- Todo assunto deve estar vinculado a um topico.
- Questao, lei comentada e prova passaram a compartilhar taxonomias onde faz sentido:
  - questoes: materia, topico e assunto;
  - leis: materia na lei, topico/assunto nos artigos;
  - provas: banca e orgao vindos das taxonomias.

## Dependencias e infraestrutura

- Adicionada dependencia `katex` para renderizar corretamente formulas matematicas ja salvas como HTML KaTeX.
- `NextAppProviders` passou a envolver `NextRouteFrame` em `Suspense`, resolvendo o erro de build causado por `useSearchParams()` em provider global.
- Endpoints e services foram expandidos para analytics, moderacao, comentarios, filtros, billing e leis relacionadas.

## Validacoes locais executadas

- `npm run check:text-encoding`
- `npx tsc --noEmit --pretty false --tsBuildInfoFile .tsbuildinfo-typecheck`
- `npm run build`

Observacao: antes da correcao de `Suspense`, o build parava em `/performance/subjects` e `/_not-found` por `useSearchParams()` fora de boundary. O wrapper global foi ajustado para permitir prerenderizacao.

## Pontos de atencao para proximas rodadas

- Validar visualmente a experiencia completa do admin apos o redesign WordPress-like.
- Cobrir com testes E2E os fluxos criticos de billing Stripe: assinatura duplicada, cartao obrigatorio, inadimplencia, renovacao e recibos.
- Evoluir analytics para fonte persistente first-party quando o backend definitivo estiver fechado.
- Revisar manualmente leis grandes para confirmar renderizacao progressiva, foco e destaques em navegadores diferentes.
- Auditar conteudos editoriais gerados por IA para garantir aderencia as regras de macete e jurisprudencia.
