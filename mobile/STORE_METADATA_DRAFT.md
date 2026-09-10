# ConcursoMestre Mobile — Metadados de loja (rascunho)

Atualizado em 10/09/2026.

Este arquivo prepara o conteudo operacional para Google Play Console e App Store Connect. Textos e classificacao devem ser revisados antes da submissao final.

## Identidade

- Nome do app: `ConcursoMestre`
- Categoria sugerida: Educacao
- Idioma principal: Portugues (Brasil)
- Versao inicial: `1.0.0`
- Android package: `com.concursomestre.mobile`
- iOS bundle identifier: `com.concursomestre.mobile`

## Descricao curta — rascunho

> Resolva questoes, crie simulados e acompanhe sua evolucao para concursos.

## Descricao completa — rascunho

> O ConcursoMestre reune ferramentas para organizar a preparacao para concursos em um unico aplicativo. Resolva questoes com filtros, acompanhe seu historico e desempenho, monte simulados personalizados e retome tentativas em andamento.
>
> No banco de questoes, voce pode pesquisar e filtrar conteudos, salvar itens, registrar anotacoes e acompanhar estatisticas. Nos simulados, configure criterios de estudo, responda com timer, retome uma tentativa interrompida e revise o resultado ao final.
>
> A area Conta centraliza seus dados de perfil, seguranca, assinatura e historico de transacoes vinculadas ao servico.
>
> Alguns recursos podem variar conforme o plano contratado e a disponibilidade do conteudo na plataforma.

## URLs de console

- Politica de Privacidade: `https://concursomestre.com/privacy`
- Suporte: `https://concursomestre.com/support`
- Exclusao de conta: `https://concursomestre.com/account-deletion`
- Termos de Uso: `https://concursomestre.com/terms`
- Site: `https://concursomestre.com`

As quatro rotas devem ser confirmadas em producao depois do deploy da branch candidata.

## Palavras-chave / posicionamento — rascunho

- concursos
- questoes
- simulados
- estudo
- concurso publico
- banco de questoes
- preparacao

Evitar promessas de aprovacao garantida, classificacoes absolutas ou alegacoes nao comprovadas.

## Screenshots necessarias

Capturar somente do Release Candidate validado, sem dados pessoais reais:

1. Login / entrada do app;
2. Questoes — listagem;
3. Questoes — filtros;
4. Questao respondida/revisao;
5. Simulados — lista;
6. Criacao de simulado;
7. Execucao do simulado;
8. Resultado/historico;
9. Conta.

Gerar conjuntos de tamanhos exigidos por cada loja somente depois de validar o layout em aparelhos/emuladores representativos.

## Conta de revisao

Como o nucleo do produto exige autenticacao, preparar antes da submissao uma conta de revisao dedicada, sem dados pessoais de usuario real e com acesso suficiente para avaliar Questoes, Simulados e Conta.

Nao armazenar senha dessa conta neste repositorio.

## Itens que nao podem ser finalizados ainda

- screenshots finais: dependem do RC executavel;
- textos comerciais finais: dependem da orientacao de produto;
- billing/assinatura em loja: decisao e implementacao pendentes;
- classificacao etaria: preencher conforme questionarios vigentes das lojas;
- Data Safety/App Privacy: usar `DATA_SAFETY_DRAFT.md` e auditar backend/provedores antes do envio;
- informacoes de contato legais: confirmar dados oficiais do titular antes de publicar.
