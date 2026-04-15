# Mobile Transitions

Este arquivo registra cada transicao de modulo da plataforma web para o app Expo.

## Regra de transicao

Toda transicao mobile deve registrar:

- modulo migrado
- origem web/plataforma
- destino no app Expo
- endpoints e services envolvidos
- estado de paridade entregue
- validacoes executadas
- commit de referencia
- pendencias conhecidas

## Backlog pos-extracao mobile

- Depois de concluir a paridade mobile, iniciar a migracao web progressiva para Next.
- Escopo recomendado: rotas publicas/indexaveis em SSR/SSG/ISR, metadata por rota, sitemap/robots, canonical, Open Graph, JSON-LD e redirects preservando URLs atuais.
- A area logada/admin pode permanecer em Vite SPA enquanto SEO nao for requisito dessas telas.

## 2026-04-14 - Questoes modo foco/lista

- commit: `7f0e33c Add mobile questions focus mode`
- origem web/plataforma:
  - `src/app/practice/page.tsx`
  - `src/services/questions/questionService.ts`
  - endpoint `questionsList`
  - endpoint de envio de resposta de questoes
- destino mobile:
  - `mobile/src/screens/QuestionsScreen.tsx`
  - `mobile/src/services/questions/questionService.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - pratica mobile passou a ter modo foco com uma questao por vez
  - modo lista foi preservado para revisao/varredura rapida
  - navegacao anterior/proxima controla o indice atual sem perder respostas ja enviadas
  - proxima questao carrega a pagina seguinte quando o usuario chega ao fim do lote atual
  - filtros continuam reiniciando a pratica no primeiro item do novo resultado
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - filtros completos de banca, ano, orgao, cargo e carreira ainda precisam ser mapeados no mobile.
  - comentarios, notas e favoritos da pratica ainda precisam de transicao propria.

## 2026-04-14 - Dashboard desempenho por materia

- commit: `41705df Add mobile subject performance detail`
- origem web/plataforma:
  - `src/app/dashboard/page.tsx`
  - `src/app/performance-subjects/page.tsx`
  - `src/services/dashboard/dashboardInsightsService.ts`
  - `src/services/statistics/studyTimeFormatting.ts`
- destino mobile:
  - `mobile/src/screens/DashboardScreen.tsx`
  - `mobile/src/screens/PerformanceSubjectsScreen.tsx`
  - `mobile/src/services/statistics/statisticsService.ts`
  - rota stack `PerformanceSubjects`
  - deep link `concursomestre://desempenho/materias`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - dashboard mobile ganhou acesso ao detalhamento completo de materias
  - tela detalhada lista todas as materias consolidadas por volume de questoes
  - cada materia exibe questoes respondidas, acertos, erros, precisao e leitura de revisao
  - pull-to-refresh recarrega as estatisticas oficiais do usuario
  - deep link interno para desempenho por materias foi registrado
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - dashboard mobile ainda nao replica graficos historicos, motivacao diaria e filtros de periodo da web.
  - a tela mobile usa o agregado oficial de `statistics/user`; nao reprocessa localmente o historico completo de respostas.

## 2026-04-14 - Marketplace detalhe de material

- commit: `24fef91 Add mobile material detail screen`
- origem web/plataforma:
  - `src/app/marketplace/page.tsx`
  - `src/app/material/page.tsx`
  - `src/app/reader/page.tsx`
  - `src/services/marketplace/marketplaceService.ts`
  - `src/services/transactions/transactionsService.ts`
- destino mobile:
  - `mobile/src/screens/MarketplaceScreen.tsx`
  - `mobile/src/screens/MaterialDetailScreen.tsx`
  - `mobile/src/services/marketplace/marketplaceService.ts`
  - `mobile/src/services/api/client.ts`
  - rota stack `MaterialDetail`
  - deep link `concursomestre://material/:materialId`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - vitrine mobile abre detalhe publico de material
  - detalhe exibe capa, preco, descricao, materia, topico, autor, avaliacao, vendas e status do arquivo
  - compra tambem pode ser iniciada pelo detalhe
  - acesso de leitura considera transacao aprovada/concluida, autor do material ou admin
  - arquivo do material pode ser aberto em visualizador externo quando houver URL disponivel
  - caminhos relativos do backend passaram a ser normalizados para URL absoluta no mobile
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - leitor PDF embutido no app ainda nao foi migrado; por enquanto o arquivo abre fora do app.
  - detalhe ainda usa a listagem oficial como fonte porque nao ha endpoint mobile dedicado por id.

## 2026-04-14 - Modulos beta Lei comentada e Flashcards

- commit: `9722c90 Add mobile beta module shells`
- origem web/plataforma:
  - `src/app/lei-comentada/page.tsx`
  - `src/app/flashcards/page.tsx`
  - `src/components/shared/feedback/BetaFeaturePage`
  - feature flags `annotatedLawsEnabled` e `flashcardsEnabled`
- destino mobile:
  - `mobile/src/screens/AnnotatedLawsScreen.tsx`
  - `mobile/src/screens/FlashcardsScreen.tsx`
  - `mobile/src/screens/ModulePlaceholderScreen.tsx`
  - rotas stack `AnnotatedLaws` e `Flashcards`
  - deep links `concursomestre://lei-comentada` e `concursomestre://flashcards`
  - atalhos no dashboard mobile
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - superficies beta da web passaram a existir tambem no mobile
  - dashboard mobile expoe atalhos para Lei comentada e Flashcards
  - telas comunicam migracao em andamento sem prometer fluxo inexistente
  - deep links internos foram registrados para os dois modulos
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
- pendencias conhecidas:
  - a regra de feature flag ainda nao esta exposta no bootstrap mobile.
  - conteudo real de lei comentada, flashcards, repeticao espacada e trilhas depende de implementacao futura dos modulos.

## 2026-04-14 - Marketplace

- commit: `931e8ef Add mobile marketplace parity screen`
- origem web/plataforma:
  - `src/app/marketplace/page.tsx`
  - `src/services/marketplace/marketplaceService.ts`
  - endpoint `materialsList`
  - endpoint `transactions/create.php`
- destino mobile:
  - `mobile/src/screens/MarketplaceScreen.tsx`
  - `mobile/src/services/marketplace/marketplaceService.ts`
  - aba `Marketplace` exposta como `Materiais`
- paridade entregue:
  - vitrine de materiais
  - filtro por materia
  - busca local por titulo, autor, tipo, materia e descricao
  - compra de material via service mobile e endpoint oficial de transacoes
  - placeholders visuais para materiais sem capa remota
- validacoes:
  - `npm --prefix mobile run typecheck`
  - bundle no Expo Go via Metro na porta `8081`
  - verificacao visual no emulador Android
- pendencias conhecidas:
  - detalhamento/leitor de material ainda precisa ser migrado.
  - fluxo de upload/publicacao de material do parceiro ainda segue web/admin.

## 2026-04-14 - Notificacoes e deep links

- commit: `a82d97d Add mobile notifications flow`
- origem web/plataforma:
  - `src/app/notifications/page.tsx`
  - `src/services/notifications/notificationService.ts`
  - endpoints `notificationsList`, `notificationsMarkRead`, `notificationsMarkAllRead`, `notificationsDelete`, `notificationsClearAll`
- destino mobile:
  - `mobile/src/screens/NotificationsScreen.tsx`
  - `mobile/src/services/notifications/notificationService.ts`
  - `mobile/src/types/notifications.ts`
  - rota stack `Notifications`
  - deep link `concursomestre://notificacoes`
- paridade entregue:
  - listagem de notificacoes do usuario autenticado
  - marcar uma notificacao como lida
  - marcar todas como lidas
  - remover notificacao individual
  - limpar todas as notificacoes
  - roteamento de links para abas principais quando o destino e reconhecido
  - fallback para abertura externa quando o destino e URL HTTP/HTTPS
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - bundle no Expo Go via Metro na porta `8081`
  - verificacao visual no emulador Android
- pendencias conhecidas:
  - notificacoes push nativas ainda nao foram ativadas.
  - destinos especificos de detalhe ainda precisam de telas dedicadas antes de mapear deep links granulares.

## 2026-04-14 - Roadmap mobile

- commit: `6655a14 Update mobile parity roadmap`
- transicao registrada:
  - Marketplace saiu da lista de proxima fase depois de entrar na Fase 2.
  - Notificacoes e deep links sairam da lista de proxima fase depois de entrar na Fase 2.
- validacoes:
  - `git diff --check`

## 2026-04-14 - Ranking detalhe publico

- commit: `80164e8 Add mobile ranking detail screen`
- origem web/plataforma:
  - `src/app/ranking/page.tsx`
  - `src/app/ranking-detail/page.tsx`
  - `src/services/rankings/rankingsService.ts`
  - endpoint `rankingsList`
- destino mobile:
  - `mobile/src/screens/RankingsScreen.tsx`
  - `mobile/src/screens/RankingDetailScreen.tsx`
  - `mobile/src/services/rankings/rankingsService.ts`
  - rota stack `RankingDetail`
  - deep link `concursomestre://ranking/:rankingId`
- paridade entregue:
  - abertura de detalhe a partir da listagem mobile
  - resumo publico do ranking
  - leitura de status de gabarito, discursiva, datas e vagas
  - exibicao de tipos de prova
  - top colocacoes ordenadas por score
  - atalho para abrir PDF de gabarito quando houver URL publica
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - bundle no Expo Go via Metro na porta `8081`
  - verificacao visual no emulador Android apos reiniciar o Metro com `--clear`
- pendencias conhecidas:
  - participacao/envio de gabarito do candidato ainda precisa de transicao propria.
  - ranking detail usa a listagem oficial como fonte porque ainda nao ha endpoint mobile dedicado para detalhe por id.

## 2026-04-14 - Ranking participacao e envio de gabarito

- commit: `450a9f0 Add mobile ranking answer submission`
- origem web/plataforma:
  - `src/app/ranking/page.tsx`
  - `src/services/rankings/rankingsService.ts`
  - endpoint `rankingsJoin`
- destino mobile:
  - `mobile/src/screens/RankingDetailScreen.tsx`
  - `mobile/src/services/rankings/rankingsService.ts`
  - `mobile/src/services/api/endpoints.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - formulario mobile de participacao no detalhe do ranking
  - preenchimento de inscricao, caderno/tipo de prova, categoria e nota discursiva
  - sanitizacao do cartao-resposta com alternativas A-E e limite de questoes
  - reaproveitamento de participacao anterior do usuario autenticado
  - calculo local da nota objetiva por gabarito oficial ou consenso colaborativo
  - envio da participacao para o backend via `rankingsJoin`
  - atualizacao otimista da lista local de colocacoes apos envio bem-sucedido
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - ranking detail ainda usa a listagem oficial como fonte porque nao ha endpoint mobile dedicado para detalhe por id.
  - status de aprovacao/classificacao por vaga ainda segue apenas como exibicao simples de colocacoes.

## 2026-04-14 - Simulados resultado e revisao

- commit: `04dcfc1 Add mobile simulation result review`
- origem web/plataforma:
  - `src/app/simulation/page.tsx`
  - tipo `SimulationSession`
  - fluxo de resultado/revisao apos `handleFinish`
- destino mobile:
  - `mobile/src/screens/SimulationRunScreen.tsx`
  - `mobile/src/types/simulation.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - resultado mobile mantem o resumo de score, aproveitamento e tempo total
  - resultado passa a carregar os resultados por questao
  - revisao por questao exibe enunciado resumido, status correta/incorreta/em branco, resposta do usuario e gabarito
  - roadmap mobile passou a tratar `Simulados com filtros avancados/taxonomias` como pendencia especifica
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - configuracao mobile ainda nao replica os filtros avancados/taxonomias da web.
  - revisao detalhada ainda nao abre uma tela dedicada por questao com comentarios e notas.

## 2026-04-14 - Simulados compatibilidade de listagem

- commit: `8d7cfbb Handle missing mobile simulations list`
- origem web/plataforma:
  - `src/services/simulations/simulationsService.ts`
  - fluxo web persiste simulados via `simulationsCreate`, sem depender de uma listagem publica equivalente
- destino mobile:
  - `mobile/src/services/simulations/simulationsService.ts`
- paridade/compatibilidade entregue:
  - a listagem mobile aceita `simulationsList` quando o backend expuser o contrato
  - quando o backend local responde 404 para a listagem, o app exibe estado vazio em vez de alerta bloqueante
  - o fluxo de criar novo simulado permanece disponivel
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - verificacao no emulador Android apos o alerta 404 observado
- pendencias conhecidas:
  - ainda falta definir um endpoint oficial de historico/detalhe de simulados se a plataforma quiser listar tentativas persistidas no mobile.

## 2026-04-14 - Simulados filtros iniciais

- commit: `31e03d8 Add mobile simulation setup filters`
- origem web/plataforma:
  - `src/app/simulation/page.tsx`
  - `src/app/practice/page.tsx`
  - endpoint `questionsList`
  - filtros web de palavra-chave, materia e dificuldade usados na pratica/simulado
- destino mobile:
  - `mobile/src/screens/SimulationConfigScreen.tsx`
  - `mobile/src/screens/SimulationRunScreen.tsx`
  - `mobile/src/types/simulation.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - configuracao mobile de simulado passou a aceitar palavra-chave, dificuldade e materia
  - amostra de questoes carrega com debounce e exibe total disponivel para os filtros
  - materias sao derivadas da taxonomia `assuntos` retornada pelo payload de questoes
  - inicio do simulado usa os filtros selecionados para montar a prova
  - execucao persiste o contexto de filtros na seed/config salva
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - filtros completos de banca, ano, orgao e cargo ainda dependem de mapear taxonomias adicionais no mobile.
  - ainda falta uma tela dedicada para escolher taxonomias longas com busca.

## 2026-04-14 - Questoes pool local e filtros avancados

- commit: `86b3dc0 Add mobile questions local filter pool`
- origem web/plataforma:
  - `src/app/practice/page.tsx`
  - `src/services/questions/questionService.ts`
  - endpoint `questionsList`
  - payload de questoes com taxonomias de banca, orgao, cargo, ano e comentarios
- destino mobile:
  - `mobile/src/screens/QuestionsScreen.tsx`
  - `mobile/src/services/questions/questionService.ts`
  - `mobile/src/types/questions.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - pratica mobile passou a carregar o pool oficial completo de questoes via paginacao do backend
  - filtros agora rodam localmente por keyword, dificuldade, materia, banca, orgao, cargo e ano
  - pratica ganhou filtros para questoes com comentario de professor, analise detalhada e opcao de ocultar respondidas
  - modo foco e modo lista passaram a navegar sobre o mesmo conjunto filtrado localmente
  - cada questao exibe metadados resumidos e badges de comentario/respondida para aproximar a leitura da web
- compatibilidade observada:
  - backend local atualmente ignora filtros em `questionsList` e aceita apenas paginacao, entao o mobile consolidou a filtragem no cliente para manter a experiencia coerente
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - comentarios completos, notas e favoritos ainda nao foram migrados para a experiencia de pratica mobile.

## 2026-04-14 - Questoes salvas no mobile

- commit: `d6c0d29 Add mobile saved questions parity`
- origem web/plataforma:
  - `src/app/practice/page.tsx`
  - `src/app/questions/components/QuestionCard.tsx`
  - `src/providers/AuthProvider.tsx`
  - `src/services/questions/questionService.ts`
  - endpoint `questionsToggleSave`
- destino mobile:
  - `mobile/src/providers/AuthProvider.tsx`
  - `mobile/src/screens/QuestionsScreen.tsx`
  - `mobile/src/services/questions/questionService.ts`
  - `mobile/src/services/api/endpoints.ts`
  - `mobile/src/types/auth.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - sessao mobile passou a normalizar e persistir `savedQuestionIds`
  - pratica mobile ganhou toggle otimista para salvar/remover questoes favoritas
  - card de questao agora indica o estado salvo e permite favoritar direto na pratica
  - filtros de recursos agora incluem recorte por questoes salvas
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - comentarios da comunidade e anotacoes de questao ainda nao foram migrados para o fluxo mobile.

## 2026-04-14 - Questoes comentarios da comunidade

- commit: `672415b Add mobile question comments flow`
- origem web/plataforma:
  - `src/app/practice/page.tsx`
  - `src/app/questions/components/QuestionCard.tsx`
  - `src/services/comments/commentsService.ts`
  - endpoints `commentsList`, `commentsHandle` e `commentsLike`
- destino mobile:
  - `mobile/src/screens/QuestionsScreen.tsx`
  - `mobile/src/components/questions/QuestionCommentsPanel.tsx`
  - `mobile/src/services/comments/commentsService.ts`
  - `mobile/src/services/api/endpoints.ts`
  - `mobile/src/types/comments.ts`
  - `mobile/src/types/questions.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - pratica mobile passou a abrir comentarios sob demanda por questao
  - painel mobile permite criar novo topico, responder comentarios e curtir respostas
  - contagem de comentarios aproveita o payload oficial e se atualiza localmente apos novas publicacoes
  - thread aninhada foi adaptada para leitura mobile sem depender do `QuestionCard` web completo
- compatibilidade observada:
  - backend local pode responder `commentsList` sem `data` quando nao ha comentarios, entao o mobile trata isso como estado vazio valido
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - anotacoes de questao ainda nao foram migradas para o fluxo mobile.

## 2026-04-14 - Questoes anotacoes locais no app

- commit: `196d2b8 Add mobile question notes flow`
- origem web/plataforma:
  - `src/app/practice/page.tsx`
  - `src/app/questions/components/QuestionCard.tsx`
  - `src/providers/DataProvider.tsx`
  - `src/services/progress/userProgressService.ts`
  - endpoint `users/notes.php`
  - endpoint legado `users/delete_note.php`
- destino mobile:
  - `mobile/src/screens/QuestionsScreen.tsx`
  - `mobile/src/components/questions/QuestionNotePanel.tsx`
  - `mobile/src/services/questions/questionNotesService.ts`
  - `mobile/src/services/api/endpoints.ts`
  - `mobile/src/types/notes.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - pratica mobile passou a hidratar anotacoes remotas existentes do usuario autenticado
  - anotacoes novas e edicoes passam a persistir localmente no app via `AsyncStorage`
  - notas remotas antigas podem ser removidas usando o endpoint oficial de exclusao
  - questao ganha badge de anotacao e painel dedicado para editar/limpar a nota
- compatibilidade observada:
  - o backend atual nao expoe rota oficial para gravar anotacao de questao, entao a escrita mobile segue local por enquanto, espelhando a limitacao pratica do fluxo web atual
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - ainda falta uma rota oficial de escrita para sincronizar anotacoes de questao entre dispositivos.

## 2026-04-14 - Questoes estatisticas e historico de resolucoes

- commit: `cf021b4 Add mobile question stats and history`
- origem web/plataforma:
  - `src/app/questions/components/QuestionCard.tsx`
  - `src/services/questions/questionService.ts`
  - endpoints `questionsStats` e `questionsHistory`
- destino mobile:
  - `mobile/src/screens/QuestionsScreen.tsx`
  - `mobile/src/components/questions/QuestionStatsPanel.tsx`
  - `mobile/src/components/questions/QuestionHistoryPanel.tsx`
  - `mobile/src/services/questions/questionService.ts`
  - `mobile/src/services/api/endpoints.ts`
  - `mobile/src/types/questions.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - pratica mobile passou a abrir estatisticas sob demanda por questao
  - painel mostra totais, acertos, erros, taxa de acerto e distribuicao por alternativa
  - pratica mobile ganhou historico de resolucoes por questao usando a API oficial
  - respostas recem enviadas atualizam o fallback local de historico e estatisticas para manter a UI coerente
- compatibilidade observada:
  - `questionsHistory` depende de sessao autenticada valida no backend; quando o endpoint nao devolve linhas, o mobile reaproveita a ultima resposta conhecida da questao como fallback local
  - a distribuicao por alternativa aceita payload legado que pode vir por indice ou por id da opcao
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - ainda falta expor no card mobile o conteudo completo de comentario de professor e analise detalhada da questao.

## 2026-04-14 - Questoes comentario do professor e analise detalhada

- commit: `acac048 Add mobile question insight panels`
- origem web/plataforma:
  - `src/app/questions/components/QuestionCard.tsx`
  - campos `teacherComment` e `detailedComment` no payload oficial de questoes
- destino mobile:
  - `mobile/src/screens/QuestionsScreen.tsx`
  - `mobile/src/components/questions/QuestionInsightPanel.tsx`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - pratica mobile ganhou toggles dedicados para abrir comentario do professor e analise detalhada
  - os dois paineis agora leem o conteudo oficial da questao direto no card mobile
  - o render mobile normaliza HTML/markdown simples para leitura confortavel sem depender de biblioteca extra
  - abrir uma dessas visoes fecha a outra para evitar empilhar dois blocos longos no mesmo card
- compatibilidade observada:
  - quando o backend sinaliza disponibilidade via flag mas ainda nao envia texto, o painel mobile mostra estado vazio explicito em vez de parecer quebrado
  - a analise detalhada ainda usa uma normalizacao leve de rich text; renderizacao markdown completa continua opcional para uma fatia futura, se necessario
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - ainda faltam refinamentos finais de paridade no fluxo de pratica, sobretudo acabamento fino de interacoes e alguns estados ricos do card web.

## 2026-04-14 - Simulados taxonomias completas no configurador

- commit: `ec33795 Add mobile simulation taxonomy filters`
- origem web/plataforma:
  - `src/app/simulation/page.tsx`
  - contrato `SimulationConfig` em `src/types/global.ts`
  - payload oficial de questoes com materia, banca, ano, orgao e cargo
- destino mobile:
  - `mobile/src/screens/SimulationConfigScreen.tsx`
  - `mobile/src/screens/SimulationRunScreen.tsx`
  - `mobile/src/types/simulation.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - configurador mobile passou a carregar o pool oficial completo de questoes e filtrar localmente
  - simulados agora aceitam taxonomias de materia, banca, ano, orgao e cargo alem de palavra-chave e dificuldade
  - a amostra exibida no configurador reflete o total elegivel local antes do inicio do simulado
  - o `seed` mobile e a persistencia final do simulado passaram a registrar essas taxonomias para manter o contexto da configuracao
- compatibilidade observada:
  - como `questionsList` local ainda ignora filtros ricos no backend, o mobile aplica os recortes no cliente para entregar configuracao coerente
  - quando o conjunto filtrado fica menor que a quantidade pedida, o configurador avisa e inicia com o total disponivel
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - ainda faltam outros refinamentos de paridade do modulo Simulados, como taxonomias adicionais mais profundas e acabamento fino da experiencia de configuracao/revisao.
