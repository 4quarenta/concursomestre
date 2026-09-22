# ConcursoMestre Mobile — A0 Baseline e Inventário

Data da execução: `2026-09-21`

## Classificação

**Não recomendado para release neste estado.** O código compila e o bundle Android é gerado, mas permanecem bloqueadores de segurança de dependências, lacunas de testes e dependências externas de build/publicação ainda não comprovadas.

## Escopo e referência

- repositório: `4quarenta/concursomestre`
- branch: `1.0.0`
- `HEAD` auditado antes das correções deste lote: `683d8c42`
- correção de login confirmada no histórico: `5b7d4336`
- baseline visual: 33 rotas capturadas em `concursomestre-mobile-screenshots.zip`
- arquitetura: Web Next.js na raiz, Mobile Expo em `mobile/` e API PHP em `backend/`

O commit `5b7d4336` está contido no `HEAD` auditado. A branch avançou depois dele; nenhuma reversão foi realizada.

## Inventário resumido

| Área | Baseline encontrada |
| --- | ---: |
| Rotas Expo Router | 41 arquivos |
| Rotas com screenshot | 33 |
| Telas nomeadas `*Screen` | 27 |
| Código TypeScript mobile | 143 arquivos / aproximadamente 20,8 mil linhas |
| Componentes compartilhados em `src/components` | 5 |
| Hooks de feature | 8 |
| Services mobile | 21 |
| Endpoints PHP em `backend/api` | 294 arquivos |
| Testes PHP versionados | 322 arquivos |

### Rotas sem baseline visual dedicado

As 33 capturas não cobrem isoladamente:

- `/flashcards/[id]`;
- `/lei-comentada/[id]`;
- rota de página não encontrada;
- variações reais de erro, offline, timeout, 401, 403, 422, 429 e 5xx;
- claro/escuro, todas as cores de destaque e escalas de fonte;
- estados autenticados com planos e permissões diferentes.

## SDKs e dependências nativas principais

| SDK/dependência | Finalidade observada | Situação inicial |
| --- | --- | --- |
| Expo SDK 57 / React Native 0.86 | runtime nativo | alinhado; Expo Doctor aprovado |
| Expo Router | navegação por arquivos | ativo; 41 arquivos de rota |
| TanStack Query | cache e estado remoto | ativo, mas migração incompleta em telas legadas |
| Axios | cliente REST e refresh de sessão | ativo; correção P0 aplicada neste lote |
| Expo SecureStore | access, refresh, CSRF e perfil | ativo |
| AsyncStorage | preferências/estado local | ativo |
| Firebase App + Analytics | telemetria | código ativo; configuração nativa externa pendente |
| Expo Image Picker | foto de perfil/suporte | solicita acesso à galeria |
| Reanimated / Gesture Handler / Screens | navegação e gestos | ativos |
| React Hook Form + Zod | formulários/validação | presentes; adoção ainda parcial |
| Playwright | screenshots web do app | presente; não substitui E2E nativo |

## Ambiente e configuração

- Node usado nesta execução: `v24.19.0`.
- CI Mobile declara Node `22.13.1`; CI Web declara Node `20.19.5`.
- PHP não está instalado neste executor. Os 322 testes PHP não foram executados nesta rodada.
- API de produção configurada: `https://concursomestre.com/api/`.
- perfis EAS `preview`, `preview-simulator` e `production` existem.
- `google-services.json` não está no repositório, como esperado por `.gitignore`, mas precisa ser fornecido no ambiente de build.
- não foi encontrada configuração equivalente de `GoogleService-Info.plist` para iOS.

## Resultado dos checks

| Check | Resultado |
| --- | --- |
| `npm ci` Web | aprovado |
| `npm ci` Mobile | aprovado |
| Mobile typecheck | aprovado |
| Mobile contracts | aprovado |
| Mobile RC smoke | aprovado |
| Mobile entry route | aprovado |
| Expo Doctor | 21/21 aprovados |
| Export Android/Metro | aprovado; bundle Hermes de aproximadamente 6 MB |
| Store readiness | falhou inicialmente por gate desatualizado; corrigido e aprovado |
| Web typecheck | aprovado |
| Web build | aprovado com warning de NFT/Turbopack no sitemap |
| Web testes | 163 arquivos e 945 testes aprovados |
| Web lint | 0 erros e 101 warnings |
| Manifesto de release | falhou inicialmente com 12 checksums divergentes; regenerado e revalidado após o lote |
| Segredos versionados | nenhum encontrado pelo gate do repositório |
| Mojibake | nenhum encontrado |
| Artefatos indevidos | nenhum encontrado |
| Source size budget | aprovado, com dívida estrutural conhecida |
| Backend PHP | não executado: PHP ausente no executor |

## Achados prioritários

| ID | Prioridade | Achado | Estado |
| --- | --- | --- | --- |
| MOB-A0-001 | P0 | O interceptor apagava a sessão em qualquer `403`, embora o contrato defina `403` como autenticado sem permissão. | corrigido neste lote |
| MOB-A0-002 | P0 | Falha transitória durante refresh era convertida em `null` e causava logout. | corrigido neste lote |
| MOB-A0-003 | P1 | Desempenho não capturava erro da API; a rejeição escapava do fluxo e podia acionar a tela de erro global. | corrigido neste lote |
| MOB-A0-004 | P0 | `store:check` exigia uma data literal removida após a centralização do contrato legal. | corrigido neste lote |
| MOB-A0-005 | P0 | `npm audit` Web encontrou 1 vulnerabilidade crítica, 1 alta e 1 moderada em Next/Sharp/baseline-browser-mapping. | aberto |
| MOB-A0-006 | P1 | `npm audit` Mobile encontrou 16 ocorrências moderadas transitivas ligadas a Expo Router/config plugins. | aberto; não usar `--force` |
| MOB-A0-007 | P1 | Não existem testes unitários, de integração ou E2E nativos no pacote Mobile; os gates atuais são majoritariamente estáticos. | aberto |
| MOB-A0-008 | P1 | Arquitetura e release notes declaram MVP com 3 tabs, mas o app expõe 5 tabs (`Início`, `Questões`, `Simulados`, `Desempenho`, `Perfil`). | aberto |
| MOB-A0-009 | P1 | `Perfil`, `Conta` e `Configurações de conta` possuem responsabilidades sobrepostas. | aberto |
| MOB-A0-010 | P1 | Firebase depende de arquivo Android externo e não há prova/configuração iOS equivalente no repositório. | aberto |
| MOB-A0-011 | P1 | Não há implementação de Play Billing ou StoreKit no pacote; a estratégia de assinatura para lojas ainda depende de decisão/comprovação de compliance. | aberto |
| MOB-A0-012 | P2 | Existem 31 ocorrências de cores hex fora do tema e somente 5 componentes compartilhados para 38 telas com `StyleSheet`. | aberto |
| MOB-A0-013 | P2 | Há telas monolíticas: `SupportScreens` 1.978 linhas, `LearningHubScreens` 1.816, `QuestionViewScreen` 1.251 e `SimulationRunScreenV2` 1.066. | aberto |
| MOB-A0-014 | P2 | 142 arquivos ativos de código/scripts ainda não possuem o cabeçalho exigido pelas regras atuais do repositório. | aberto; corrigir incrementalmente |
| MOB-A0-015 | P2 | 183 usos explícitos de `any`, concentrados nos services e normalizadores de payload. | aberto |
| MOB-A0-016 | P2 | A camada `src/services/api` continua sendo usada amplamente como bridge da camada canônica `src/api`. | aberto |
| MOB-A0-017 | P0 | O manifesto remoto tinha commit/data atualizados, mas 12 checksums de arquivos críticos estavam obsoletos. | corrigido por regeneração controlada após este lote |

## Evidência das correções do primeiro lote

- `403` deixou de iniciar refresh e de limpar o SecureStore.
- falhas de rede, timeout, `403` e `5xx` durante refresh preservam a sessão.
- refresh comprovadamente inválido por `401` ou `422` continua limpando a sessão.
- refresh concorrente continua single-flight.
- Desempenho mantém a navegação, exibe erro recuperável e oferece retry.
- o gate de loja agora valida as versões legais pelo contrato compartilhado em vez de procurar uma data duplicada na página.
- os gates foram ampliados para impedir regressão desses comportamentos.

## Limites desta rodada

Não foram declarados como comprovados:

- build Android assinado via EAS/Gradle;
- build iOS ou TestFlight;
- comportamento em aparelho real;
- sessão em background/foreground e troca de rede;
- webhooks e entitlements reais;
- testes do backend PHP;
- comportamento real da API sob todos os status HTTP;
- acessibilidade com TalkBack/VoiceOver;
- performance de startup, memória e listas em dispositivo.

## Atualização do lote A1/A2

Após o baseline, o lote seguinte concluiu as correções de código abaixo:

- `login` e `register` passaram a declarar `refreshProfile` nas dependências dos callbacks;
- `Novidades` passou a capturar falhas de `changelogService`, exibir mensagem recuperável e oferecer retry;
- `Conta` deixou de disparar `refreshProfile` sem tratamento no pull-to-refresh e agora mostra uma mensagem recuperável;
- o serviço de estatísticas deixou de concatenar o ID na rota legada `statistics/user/<id>` e passou a usar `statistics/user.php?user_id=<id>`, alinhado ao contrato do backend e do Web;
- `mobile/scripts/session-contract-check.mjs` passou a executar a matriz de `401`, `403`, offline, `5xx`, refresh concorrente e limpeza seletiva;
- o gate `qa:smoke` agora executa essa checagem antes dos demais gates.

Resultado comprovado nesta execução: typecheck Mobile, contrato de sessão, smoke RC, rota de entrada, store readiness e `git diff --check` aprovados.

Isso encerra a correção estática conhecida de A1 e o primeiro item de A2, mas não encerra as etapas: ainda falta executar os mesmos cenários contra a API real em emulador/aparelho, adicionar testes nativos de integração e auditar as demais telas sob falhas remotas.

A validação autenticada em aparelho identificou posteriormente o erro `User ID is required`. A causa foi confirmada no contrato: o Mobile enviava o identificador no caminho, enquanto a rota canônica exige `user_id` na query. A correção está aplicada localmente e aguarda nova rodada no aparelho.

Após a integração dos patches de segurança do Codex (`90d61ef7`), uma nova auditoria de dependências registrou **1 vulnerabilidade moderada** no Web (`baseline-browser-mapping`) e **16 moderadas transitivas** no Mobile, concentradas no ecossistema Expo/RN. Não foi usado `npm audit fix --force`, pois a alternativa automática propõe mudanças maiores de SDK.

## Próxima ordem de execução

1. resolver vulnerabilidades Web sem atualização forçada cega;
2. testar sessão em aparelho/emulador com 401 concorrente, 403, offline e 5xx;
3. concluir A2 nos estados de erro ainda sem `catch`, começando por Notificações e fluxos de conteúdo restantes;
5. alinhar escopo real das tabs e a sobreposição Perfil/Conta;
6. fechar a decisão de pagamentos nas lojas antes de avançar no checkout;
7. iniciar Design System somente depois dos bloqueadores funcionais.
