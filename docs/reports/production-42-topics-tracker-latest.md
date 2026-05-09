# Tracker - 42 Observacoes de Producao

Data base: `2026-05-09`

## Resumo atual

- **Concluidos:** `17`
- **Parciais:** `13`
- **Pendentes:** `12`

## Status por observacao

| # | Status | Observacao (resumo) | Evidencia atual |
| --- | --- | --- | --- |
| 1 | Parcial | Reset abre home antes da tela de reset | Redirecionamento legado na raiz foi reforcado em `src/app/page.tsx`, falta validar UX final em todos os links antigos |
| 2 | Pendente | Link de ativacao nao abre fluxo de parabens esperado | Ainda sem evidencia funcional final do modal no fluxo completo |
| 3 | Concluido | Tempo de estudos com media diaria | `src/app/dashboard/DashboardPage.tsx` |
| 4 | Concluido | Desempenho por materia sem falso "sem dados" | `src/app/performance-subjects/PerformanceSubjectsPage.tsx` |
| 5 | Concluido | Avaliar plataforma sem pagina propria, via modal | `src/app/profile/ProfilePage.tsx` |
| 6 | Concluido | Foto atualizada refletindo no layout global | `src/components/shared/layout/Layout.tsx` |
| 7 | Concluido | Dashboard do aluno com foco em "hoje" por padrao | `src/app/dashboard/DashboardPage.tsx` |
| 8 | Concluido | Foco sem destrinchar subitens | `src/services/filters/index.ts` |
| 9 | Concluido | Badge "Inedita" centralizado | `src/app/questions/components/QuestionCard.tsx` |
| 10 | Parcial | Comentario/analise com melhor formatacao de texto | Editor rico saneado (`RichTextEditor`), falta calibrar padrao final de geracao IA |
| 11 | Concluido | Sair da tela cheia no simulado perto de finalizar | `src/app/simulation/page.tsx` |
| 12 | Parcial | Border-radius global mais contido | Padrao admin consolidado; falta varredura final em todas as telas publicas |
| 13 | Parcial | Foco de estudo no perfil baseado em dados da plataforma | Fluxo depende das taxonomias; requer validacao funcional completa |
| 14 | Pendente | Acesso ao crawler do Gran no admin | Sem implementacao validada |
| 15 | Concluido | Telefone obrigatorio no cadastro e dados pessoais | `Auth.tsx`, `ProfilePage.tsx`, backend auth validators |
| 16 | Concluido | Confirmacao de excluir notificacao fora do padrao | Fluxo usa modal padrao (`useConfirm`) em limpar lixeira e excluir permanente em `src/app/notifications/page.tsx` |
| 17 | Concluido | Comentarios com deteccao automatica de spam | `modules/comments/services/CommentsService.php` |
| 18 | Concluido | Dashboard admin com "hoje" por padrao | `src/app/admin/components/dashboard/AdminDashboard.tsx` |
| 19 | Concluido | `admin/support/feedback` no padrao WordPress | `src/app/admin/components/support/AdminFeedback.tsx` |
| 20 | Parcial | Resolver denuncia direto da questao aberta | Moderacao avancou; falta prova de resolucao inline no fluxo exato pedido |
| 21 | Parcial | Texto de visibilidade e outros ajustes de escrita | Grade de questoes revisada com acentuacao/rotulos em `src/app/admin/components/questions/AdminQuestionsSection.tsx`; falta varredura global de copy |
| 22 | Parcial | Add/edit admin muito lentos | Bootstrap e fetches melhorados; falta tuning especifico por pagina de edicao |
| 23 | Parcial | Upgrade manual admin sem cobranca | Fluxo admin cria assinatura `payment_provider='manual_admin'`, `auto_renew=0` e `cancel_at_period_end=1` em `modules/admin/repositories/AdminUserActionsRepository.php`; falta homologar E2E com billing/analytics |
| 24 | Pendente | Perfil detalhado com denuncias/feedback/sugestoes/avaliacoes | Ainda nao consolidado no modal/perfil admin |
| 25 | Pendente | Tabela vendedores estilo usuarios + gestao completa | Escopo ainda aberto |
| 26 | Concluido | Badge de materiais aguardando aprovacao no menu | `AdminStats` + `useAdminPageController` + `AdminNavigationSidebar` |
| 27 | Concluido | Cobranca em risco sem detalhamento de falha/usuario | Painel financeiro agora lista usuario, email, sinal e ultimo evento em `src/app/admin/components/finance/AdminFinanceAnalyticsPanel.tsx` |
| 28 | Pendente | Cenarios Stripe "partial/not supported" | Ainda com pendencias de homologacao/staging |
| 29 | Parcial | `CRON_SECRET` nao configurado | Preflight e lock prontos; falta ambiente final com segredo configurado |
| 30 | Pendente | Limpeza de "lixo" em configuracoes | Revisao funcional ainda pendente |
| 31 | Pendente | Seguranca admin com IP suspeito/banimento | Sem modulo fechado |
| 32 | Parcial | Google login pedindo dados pessoais se conta nao existir | Fluxo implementado localmente; falta validacao E2E completa |
| 33 | Pendente | Remover cupom re-adiciona | Sem correcao validada |
| 34 | Pendente | Login/cadastro Facebook | Nao implementado |
| 35 | Pendente | Login Apple | Nao implementado |
| 36 | Pendente | Metodos de pagamento do painel nao aparecem no checkout | Sem fechamento completo |
| 37 | Concluido | Reportar comentario com motivo (igual reportar questao) | `src/components/shared/feedback/CommentsSection.tsx` |
| 38 | Parcial | Muitos erros/violations no console | Reducao relevante; falta zerar backlog residual |
| 39 | Parcial | Limpeza de codigo morto + comentarios | Avanco em higiene/arquitetura; ainda ha passivo |
| 40 | Concluido | Visualizador de logs com visao completa | `src/app/admin/components/settings/LogViewer.tsx` |
| 41 | Pendente | Lista objetiva de arquivos removiveis | Falta relatorio final de descarte seguro |
| 42 | Parcial | Modelos de e-mail editaveis no admin | Secao pronta local, falta homologacao SMTP real |

## Auditoria de producao (macro)

- Veredito atual: **Nao pronto**.
- Melhorias locais relevantes de seguranca/performance/UX ja aplicadas.
- Ainda faltam pendencias de pagamento, operacao (cron/proxy/VPS), partes do suporte/admin e homologacao de fluxos criticos.
