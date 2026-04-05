---
trigger: always_on
---

# Regras permanentes de engenharia

## Comentarios obrigatorios

- Todo arquivo `ts`, `tsx`, `js`, `jsx`, `php` novo ou alterado deve trazer comentarios em **pt-BR** nas funcoes, componentes, hooks, services, controllers, repositories e scripts.
- Todo arquivo ativo de codigo em `ts`, `tsx`, `js`, `jsx`, `php` deve iniciar com o cabecalho autoral oficial abaixo. Em linguagens que nao aceitam `/* */`, usar o equivalente nativo preservando o mesmo conteudo.
- Cabecalho oficial:

```text
/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/
```

- Cada comentario deve explicar, de forma objetiva:
  - para que aquela unidade existe
  - quais responsabilidades ela assume
  - como ela se conecta ao fluxo real da plataforma
- Cada bloco de comentario funcional deve registrar a versao em que aquela unidade entrou na baseline oficial usando `@since <versao>`.
- Enquanto o sweep historico completo nao detalhar a origem exata de cada unidade legada, a baseline obrigatoria passa a ser `@since v1.0.0`.
- Nao usar comentario trivial do tipo "define variavel" ou "retorna valor".
- Em componentes de interface, o comentario deve explicar em qual area do site ele aparece e qual shell/rota o consome.
- Em hooks e controllers, o comentario deve explicar quais componentes dependem dele e quais estados/acoes ele orquestra.
- Em services, repositories e validators, o comentario deve explicar qual dominio atendem e quem os consome.

## Estrutura oficial do frontend

- `src/app/<feature>/page.tsx`: apenas shell, composicao e montagem da tela.
- `src/app/<feature>/components/*`: componentes da feature, separados por dominio.
- `src/app/<feature>/components/*/use*.ts(x)`: hooks de workflow, controller ou estado local da feature.
- `src/router/*`: definicao de rotas, guards, suspense e fallback de navegacao.
- `src/providers/*`: estado global, bootstrap e integracao transversal.
- `src/services/*`: contratos HTTP, fachadas de dominio e integracao com backend.
- `src/utils/*`: utilitarios puros e reaproveitaveis.
- `src/components/shared/*`: apenas componentes realmente compartilhados por mais de um dominio.

## Estrutura oficial do backend

- `modules/<domain>/*`: `routes`, `controllers`, `services`, `repositories`, `validators` e DTOs do dominio.
- `shared/*`: infraestrutura transversal.
- `scripts/*`: checks, migracoes, seeds, tarefas e ferramentas operacionais.
- `api/*`: somente bridges finos e excecoes publicas congeladas por testes.

## Padrao de codigo

- `page.tsx` deve ser enxuto e agir como ponto de composicao, nunca como deposito de regra de negocio.
- Regras de interface e orquestracao devem ficar em hooks/controller da propria feature.
- Componentes visuais devem receber props prontas; logica pesada deve sair do JSX.
- `shared` nao pode virar deposito generico: o que for especifico de um dominio deve ficar dentro da feature dona.
- Toda excecao estrutural deve ser documentada no status central e protegida por teste.
- Codigo novo deve nascer na arquitetura oficial; nao reabrir camadas legadas.
