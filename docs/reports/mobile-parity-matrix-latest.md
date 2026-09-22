# ConcursoMestre — Matriz Inicial Web × API × Mobile

Data: `2026-09-21`

Esta matriz registra presença estrutural. Uma linha `integrada` não significa que o fluxo já foi aprovado em aparelho real.

| Domínio | Web | API/contrato | Mobile | Avaliação inicial |
| --- | --- | --- | --- | --- |
| Login e cadastro | `/auth` | `auth/login.php`, `auth/register.php`, `auth/me.php` | `/login`, `/cadastro` | integrada; testes dinâmicos de envelopes ainda insuficientes |
| Refresh e logout | sessão web | `auth/refresh.php`, `auth/logout.php` | SecureStore + interceptor | P0 corrigido; falta teste em aparelho e concorrência real |
| Início/dashboard | `/dashboard` | estatísticas/configurações | `/inicio` | integrada; fora do MVP descrito na arquitetura |
| Questões | `/practice`, `/questoes` | lista compatível + `v2/questions/answer.php` | `/questoes`, `/questao/[id]` | ativa; migração F3 e filtros server-side ainda declarados pendentes |
| Simulados | `/simulation`, `/simulados` | listagem/criação/detalhe | `/simulados`, novo, executar e histórico | ativa; migração F4 ainda declarada pendente |
| Desempenho | `/performance/subjects` | `statistics/user.php?user_id=...` | `/desempenho` | rota Mobile corrigida para o contrato canônico; nova validação autenticada pendente |
| Perfil | `/profile` | perfil, foto e preferências | `/perfil`, `/perfil/editar` | ativa; sobreposição com Conta |
| Conta e segurança | `/profile/security` | senha, exclusão, cartões | `/conta`, `/configuracoes/conta` | ativa; arquitetura de informação precisa consolidação |
| Planos | `/planos`, `/plans` | catálogo e elegibilidade | `/planos` | catálogo presente; compliance das lojas pendente |
| Checkout/assinatura | `/checkout/[planId]` | Stripe e assinatura | fluxos diretos + superfície segura de loja | Play Billing/StoreKit ausentes; decisão P0 antes da publicação |
| Notificações | `/notifications` | listagem, leitura e exclusão | `/notificacoes` | integrada; estados de falha ainda precisam auditoria |
| Notícias/blog | `/blog` | `blog/list.php`, detalhe e like | `/noticias`, detalhe | integrada; erro visual observado no baseline |
| Novidades | `/novidades`, `/changelog` | changelog | `/novidades` | integrada; erro de carregamento agora é recuperável, validação dinâmica pendente |
| Flashcards | `/flashcards` | contrato real não identificado no mobile | `/flashcards`, detalhe | shell/dados locais; não considerar paridade concluída |
| Lei comentada | `/lei-comentada` | backend real existe | `/lei-comentada`, detalhe | UI usa dados locais; não considerar paridade concluída |
| Ranking | `/ranking` | listagem/participação | `/ranking` | código agrupado em tela monolítica; validação dinâmica pendente |
| Revisão | recursos de questões | respostas/histórico | `/revisao` | parte do shell local; regra autoritativa precisa confirmação |
| Trilhas | não consolidado | contrato não identificado | `/trilhas` | conteúdo local demonstrativo |
| Aparência | preferências web | persistência local | `/configuracoes/aparencia` | ativa; separar accent de cores semânticas |
| Privacidade e termos | `/privacy`, `/terms` | contrato legal versionado | links públicos e configurações | gate corrigido; revisão jurídica continua externa à auditoria técnica |
| Suporte | `/support` | feedback/suporte | `/ajuda` | integrada parcialmente; tela monolítica |
| Analytics | analytics web | Firebase | serviço mobile | configuração Android externa e iOS não comprovada |

## Conclusão

A presença de muitas rotas não representa paridade funcional. Flashcards, Lei Comentada, Trilhas e partes de Revisão ainda usam dados locais ou shells demonstrativos. Checkout de loja e entitlement também não podem ser classificados como concluídos enquanto Play Billing/StoreKit e os cenários server-side não forem decididos e comprovados.
