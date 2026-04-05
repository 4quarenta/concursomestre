# Feature Version Matrix
Atualizado em: 2026-04-05

## Objetivo
Este documento define a versao funcional da plataforma por dominio de negocio, e nao por pagina.
Ele existe para servir como baseline futura de changelog funcional.
Cada bloco abaixo responde o que a versao atual entrega dentro de cada funcionalidade.

## Baseline atual da plataforma
- Versao funcional da plataforma: `v1.0.0`
- Esta baseline representa o conjunto funcional atualmente ativo em producao local da plataforma.
- A versao tecnica em [C:\dev\concursomestre\package.json](C:\dev\concursomestre\package.json) agora esta alinhada com a baseline publica e segue `1.0.0`.

## Regra de versionamento funcional
- `patch`: correcao pequena ou ajuste de comportamento sem ampliar escopo.
- `minor`: nova capacidade relevante dentro do mesmo dominio.
- `major`: mudanca forte de comportamento, contrato ou posicionamento do dominio.

## Matriz por funcionalidade

### Institucional e publico
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - landing principal com proposta de valor, CTA comercial e prova social
  - paginas publicas de FAQ, termos, privacidade, promo e confirmacao de conta
  - changelog publico consumindo dados oficiais do backend

### Auth e sessao
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - login, cadastro, logout, refresh e recuperacao de senha
  - confirmacao de e-mail e reenvio de confirmacao
  - 2FA, sessao autenticada e protecao por permissao

### Questoes e pratica guiada
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - listagem de questoes com filtros por banca, orgao, cargo, assunto e ano
  - resposta, historico, favoritos e progresso do usuario
  - comentarios, curtidas, denuncias e estatisticas por questao

### Filtros e taxonomias
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - taxonomias oficiais de bancas, orgaos, cargos, materias, topicos, carreiras e anos
  - CRUD administrativo de filtros
  - normalizacao de payload para uso consistente na UI

### Simulados
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - configuracao de simulado por materia, banca, ano, orgao, cargo, nivel e topico
  - execucao temporizada com sessao ativa e respostas por questao
  - persistencia oficial da sessao de simulado do usuario autenticado
  - fechamento do simulado com score final e registro no contexto do usuario

### Estatisticas e bank analysis
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - raio-x de banca e leitura de padroes
  - estatisticas do usuario, da plataforma e por questao
  - analytics agregados para apoio a estudo e priorizacao

### Rankings
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - listagem de rankings ativos e aprovados
  - criacao, edicao, moderacao e exclusao administrativa
  - participacao do usuario com envio de gabarito, categoria e dados de inscricao
  - calculo de score com gabarito oficial ou consenso colaborativo

### Planos, checkout e assinaturas
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - catalogo de planos e beneficios
  - checkout com autenticacao inline, cupons, cartoes e gateways
  - gestao de assinatura, renovacao, automacao e sincronizacao com provedores de pagamento

### Marketplace, materiais e reader
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - publicacao e edicao de materiais em PDF
  - compra, transacao, rating, comentarios e pedidos de reembolso
  - reader autenticado com acesso validado, nota, bookmark e highlight
  - moderacao administrativa de materiais

### Perfil, conta e billing
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - edicao de perfil e senha
  - leitura de assinatura, referrals, materiais e transacoes do usuario
  - cartoes salvos, cartao padrao, setup intent e sincronizacao Stripe

### Notificacoes
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - listagem da central de notificacoes
  - marcar notificacoes como lidas
  - limpar notificacoes e alimentar eventos sociais e operacionais

### Suporte, feedback e reports
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - abertura de chamados e replies de suporte
  - feedback publico/autenticado por tipo
  - reports de questoes, materiais e comentarios
  - resposta administrativa com templates e e-mail automatico por tipo de caso

### Partner dashboard
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - area do parceiro para publicar materiais
  - acompanhamento de vendas e desempenho comercial
  - leitura de transacoes e operacao comercial do autor

### Admin e operacao
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - dashboard executivo, configuracoes, financeiro e seguranca
  - gestao da base de questoes, filtros, materiais, rankings, reports e usuarios
  - importador com pipeline de PDF e IA
  - modais administrativos especializados por dominio

### Changelog publico
- Versao da funcionalidade: `v1.0.0`
- Baseline atual inclui:
  - listagem publica de versoes
  - exibicao de releases, melhorias e correcoes
  - leitura a partir da camada oficial de changelog

## Como usar este arquivo no futuro
- Ao subir uma funcionalidade, atualizar apenas o dominio impactado e, se necessario, a versao global da plataforma.
- O changelog futuro deve referenciar este arquivo para explicar o que cada versao funcional realmente contem.
- Mudancas puramente tecnicas ficam no [C:\dev\concursomestre\docs\audit-report.md](C:\dev\concursomestre\docs\audit-report.md).
