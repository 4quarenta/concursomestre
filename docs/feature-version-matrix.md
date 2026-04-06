# Feature Version Matrix
Atualizado em: 2026-04-05

## Objetivo
Este documento define a versao funcional da plataforma por dominio de negocio, e não por pagina.
Ele existe para servir como baseline futura de changelog funcional.
Cada bloco abaixo responde o que a versao atual entrega dentro de cada funcionalidade.

## Baseline atual da plataforma
- Versao funcional da plataforma: `v1.0.0`
- Esta baseline representa o conjunto funcional atualmente ativo em produção local da plataforma.
- A versao tecnica em [C:\dev\concursomestre\package.json](C:\dev\concursomestre\package.json) agora esta alinhada com a baseline pública e segue `1.0.0`.

## Regra de versionamento funcional
- `patch`: correcao pequena ou ajuste de comportamento sem ampliar escopo.
- `minor`: nova capacidade relevante dentro do mesmo dominio.
- `major`: mudanca forte de comportamento, contrato ou posicionamento do dominio.

## Matriz por funcionalidade

### Institucional e público
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - landing principal com proposta de valor, CTA comercial e prova social
  - paginas públicas de FAQ, termos, privacidade, promo e confirmacao de conta
  - changelog público consumindo dados oficiais do backend

### Auth e sessão
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - login, cadastro, logout, refresh e recuperacao de senha
  - confirmacao de e-mail e reenvio de confirmacao
  - 2FA, sessão autenticada e protecao por permissao

### Questões e pratica guiada
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - listagem de questões com filtros por banca, orgao, cargo, assunto e ano
  - resposta, histórico, favoritos e progresso do usuário
  - comentários, curtidas, denúncias e estatisticas por questão

### Filtros e taxonomias
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - taxonomias oficiais de bancas, orgaos, cargos, materias, topicos, carreiras e anos
  - CRUD administrativo de filtros
  - normalizacao de payload para uso consistente na UI

### Simulados
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - configuração de simulado por materia, banca, ano, orgao, cargo, nivel e topico
  - execucao temporizada com sessão ativa e respostas por questão
  - persistencia oficial da sessão de simulado do usuário autenticado
  - fechamento do simulado com score final e registro no contexto do usuário

### Estatisticas e bank analysis
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - raio-x de banca e leitura de padroes
  - estatisticas do usuário, da plataforma e por questão
  - analytics agregados para apoio a estudo e priorizacao

### Rankings
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - listagem de rankings ativos e aprovados
  - criacao, edicao, moderação e exclusao administrativa
  - participacao do usuário com envio de gabarito, categoria e dados de inscri??o
  - calculo de score com gabarito oficial ou consenso colaborativo

### Planos, checkout e assinaturas
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - catalogo de planos e benefícios
  - checkout com autenticação inline, cupons, cartoes e gateways
  - gestão de assinatura, renovação, automacao e sincronizacao com provedores de pagamento

### Marketplace, materiais e reader
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - pública??o e edicao de materiais em PDF
  - compra, transação, rating, comentários e pedidos de reembolso
  - reader autenticado com acesso validado, nota, bookmark e highlight
  - moderação administrativa de materiais

### Perfil, conta e billing
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - edicao de perfil e senha
  - leitura de assinatura, referrals, materiais e transações do usuário
  - cartoes salvos, cartão padrao, setup intent e sincronizacao Stripe

### Notificações
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - listagem da central de notificações
  - marcar notificações como lidas
  - limpar notificações e alimentar eventos sociais e operacionais

### Suporte, feedback e reports
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - abertura de chamados e replies de suporte
  - feedback público/autenticado por tipo
  - reports de questões, materiais e comentários
  - resposta administrativa com templates e e-mail automático por tipo de caso

### Partner dashboard
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - area do parceiro para publicar materiais
  - acompanhamento de vendas e desempenho comercial
  - leitura de transações e operação comercial do autor

### Admin e operação
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - dashboard executivo, configurações, financeiro e segurança
  - gestão da base de questões, filtros, materiais, rankings, reports e usuários
  - importador com pipeline de PDF e IA
  - modais administrativos especializados por dominio

### Changelog público
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - listagem pública de versoes
  - exibicao de releases, melhorias e correcoes
  - leitura a partir da camada oficial de changelog

## Como usar este arquivo no futuro
- Ao subir uma funcionalidade, atualizar apenas o dominio impactado e, se necessario, a versao global da plataforma.
- O changelog futuro deve referenciar este arquivo para explicar o que cada versao funcional realmente contem.
- Mudancas puramente tecnicas ficam no [C:\dev\concursomestre\docs\audit-report.md](C:\dev\concursomestre\docs\audit-report.md).
