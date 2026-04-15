# ConcursoMestre Mobile (React Native)

App Android/iOS em React Native (Expo), com painel admin mantido apenas na web.

## Fase 1 (entregue)

- Base Expo + TypeScript
- Navegacao (auth + tabs)
- Sessao persistida (SecureStore)
- Login/cadastro/logout via API oficial
- Bootstrap de usuario autenticado (`auth/me.php`)
- Bootstrap de feature flags essenciais (`settings.php`) para gate de modulos core e beta
- Estrutura inicial de modulos mobile para migracao com paridade
- Dashboard mobile com dados reais de estatisticas:
  - questoes respondidas
  - acuracia
  - streak atual e melhor streak
  - tempo de estudo total / questoes / leitura
  - desempenho por materia (top 5)
  - detalhe completo de desempenho por materia
  - motivacao diaria por data
  - evolucao recente por timeline quando a API disponibiliza pontos temporais
  - recorte da evolucao por periodo (hoje/semana/mes/tudo)
  - toggle para mostrar/ocultar faixa de acertos na evolucao
  - progresso de nivel por XP (nivel atual, barra e XP restante)
  - KPIs de questoes/acuracia alinhados ao recorte de periodo quando houver timeline
  - visual de evolucao em colunas para questoes/acertos com rolagem horizontal

## Fase 2 (em andamento)

- Modulo `Questoes` com:
  - pool oficial carregado via API paginada
  - filtros locais por keyword, dificuldade, materia, banca, orgao, cargo e ano
  - filtros por questoes salvas, comentario de professor, analise detalhada e ocultar respondidas
  - paginação/load more local no modo lista
  - envio de resposta do usuario
  - salvar/remover favorito com sincronizacao otimista
  - comentario do professor e analise detalhada com leitura inline no card
  - comentarios da comunidade com leitura, novo topico, resposta e curtida
  - anotacoes com hidratacao remota e persistencia local no app
  - estatisticas agregadas e historico de resolucoes por questao com carregamento sob demanda
  - modo foco por questao e modo lista
- Modulo `Planos` com catalogo oficial
- Fluxo `Checkout` mobile (sessao Stripe hospedada):
  - resumo do plano
  - cupom
  - toggle de renovacao automatica
  - redirecionamento seguro para URL retornada pelo backend
- Modulos em leitura real:
  - `Simulados` (listagem com merge remoto/local de historico + detalhe por tentativa)
  - `Raio-X da banca` (analise por banca/cargo/periodo com endpoint oficial de xray)
  - `Ranking` (listagem + detalhe publico + envio de gabarito)
  - `Marketplace` (vitrine de materiais, detalhe publico, filtros, compra e abertura externa de arquivo)
- Modulos beta com shell mobile:
  - `Lei comentada`
  - `Flashcards`
  - visibilidade controlada por `annotatedLawsEnabled` e `flashcardsEnabled`
- Navegacao principal com gate de modulos:
  - `Questoes` (`practiceEnabled`)
  - `Simulados` (`simulationsEnabled`)
  - `Ranking` (`rankingsEnabled`)
  - `Marketplace` (`marketplaceEnabled`)
- Fluxo de simulado em execucao:
  - configuracao (questoes + timer)
  - filtros locais por palavra-chave, dificuldade, materia, banca, ano, orgao, cargo e topicos
  - modo de resposta com resultado final ou feedback imediato
  - execucao com navegacao por questao
  - paleta de navegacao para salto direto entre questoes e contador de respondidas
  - opcao de finalizacao antecipada com confirmacao
  - finalizacao com score
  - resultado detalhado com revisao por questao, filtros por status e resumo de acertos/erros/em branco
  - revisao expandida de alternativas com destaque de gabarito e resposta marcada
  - revisao em foco por questao com navegacao anterior/proxima a partir do resumo
  - comentario do professor e analise detalhada disponiveis tambem na revisao em foco
  - comentarios da comunidade e anotacoes pessoais disponiveis no modo de revisao em foco
  - persistencia da sessao via `simulationsCreate`
  - cache local do historico para fallback quando a listagem remota estiver indisponivel
  - tela de detalhe de historico com revisao por questao para tentativas salvas
  - envio das respostas no endpoint oficial de questoes
- Perfil mobile com billing Stripe:
  - listagem de cartoes do cofre
  - definir cartao padrao
  - remocao com bloqueio para cartao vinculado a assinatura
  - aviso de cartao expirado/expirando
  - atalho para portal Stripe (adicionar/gerenciar cartoes)
  - historico de transacoes da conta (plano, ciclo, metodo, gateway, status, valor)
- Central de notificacoes mobile:
  - listagem via endpoint oficial
  - marcar uma/todas como lidas
  - remocao/limpeza de notificacoes
  - deep links para abas principais via `concursomestre://`

## Estrutura

- `App.tsx`: shell principal
- `src/providers/AuthProvider.tsx`: sessao e autenticacao
- `src/services/api/*`: cliente HTTP e normalizacao de resposta
- `src/services/auth/*`: fluxo de auth e cofre local de sessao
- `src/navigation/*`: stacks e tabs
- `src/screens/*`: telas iniciais (dashboard, perfil e placeholders)
- `src/screens/PlansScreen.tsx`: catalogo de planos no mobile
- `src/screens/CheckoutScreen.tsx`: entrada de checkout mobile
- `src/screens/SimulationDetailScreen.tsx`: detalhe de tentativa salva no historico
- `src/services/plans/planService.ts`: fachada mobile de planos/checkout

## Como rodar

Na raiz do repositorio:

1. `npm --prefix mobile install`
2. `npm run mobile:start`
3. `npm run mobile:android` ou `npm run mobile:ios`

## Config da API

Base URL no arquivo `mobile/app.json`:

- `expo.extra.apiBaseUrl`

Padrao local:

- `http://localhost/questao-pro-backend/api/`

## Proxima fase

- Migracao de modulos com paridade:
  - Dashboard completo com graficos, motivacao diaria e recortes de periodo
  - Questoes/practice com refinamentos finais de paridade fina
  - Simulados com sincronizacao oficial de detalhe/historico no backend
  - Lei comentada com conteudo real
  - Flashcards com revisao ativa real
  - Checkout/assinaturas/transacoes

## Backlog pos-mobile

- Iniciar migracao web progressiva para Next apos fechar a extracao mobile.
- Escopo inicial da migracao Next: rotas publicas/indexaveis, SEO server-rendered/static, metadata por rota, sitemap/robots nativos e redirects/canonicals preservando URLs atuais.
- Manter a area logada/admin como Vite SPA enquanto SEO nao for requisito dessas telas.
