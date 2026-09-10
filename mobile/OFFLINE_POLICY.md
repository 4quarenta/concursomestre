# ConcursoMestre Mobile — Politica offline do MVP

## Objetivo

O primeiro release nao e um aplicativo offline-first. O objetivo e preservar progresso importante sem transformar o aparelho em uma replica persistente do banco de questoes.

## Questoes

- novas listagens, filtros, busca, resposta, comentarios e estatisticas exigem conexao com a API;
- paginas ja carregadas permanecem no cache em memoria do TanStack Query durante a sessao;
- o app nao persiste em disco um cache global do banco de questoes;
- gabaritos nao sao pre-carregados nem persistidos para questoes nao respondidas;
- falhas de rede/timeout exibem erro recuperavel e permitem nova tentativa.

## Simulados

- a tentativa ativa e persistida localmente com Zustand + AsyncStorage;
- fechar o app nao perde respostas, indice atual ou referencia temporal do cronometro;
- quando houver conexao, a tentativa e sincronizada com o backend;
- o backend continua sendo autoritativo para gabarito, score e gamificacao;
- historico concluido possui fallback local quando o remoto estiver temporariamente indisponivel.

## Conta

- perfil, assinatura, transacoes e alteracoes de seguranca exigem conexao;
- token e identidade continuam em SecureStore;
- expiracao de sessao invalida imediatamente o estado autenticado.

## Privacidade e armazenamento

- nao armazenar senha, dados completos de pagamento ou segredo de gateway em AsyncStorage;
- tokens ficam apenas no SecureStore;
- caches devem ser limpos quando a identidade autenticada mudar;
- nenhum cache offline pode reintroduzir gabarito de prova em andamento.

## Escopo do primeiro release

Push notifications nao fazem parte do MVP inicial. A decisao evita permissao nativa adicional e reduz superficie de falhas antes do primeiro Release Candidate.
