# Migracao Web para Next.js

Este documento registra a migracao da plataforma web do ConcursoMestre para Next.js App Router.

## Escopo correto

A migracao Next e da plataforma web. Ela nao e a extracao do app mobile. O app Expo permanece em `mobile/`, enquanto o web principal foi consolidado na raiz do repositorio.

## Decisao de reinicio frio

Em `2026-04-18`, a migracao foi reiniciada a partir do branch `master` porque a tentativa anterior havia transformado a area logada em uma experiencia diferente da plataforma original.

A regra adotada a partir desse ponto:

- o branch `master` e o backup historico da UI e da funcionalidade web original
- este branch deve manter a experiencia web igual ao backup, mudando apenas a base tecnica para Next
- a plataforma Next mora diretamente em `src/`, na raiz
- nao ha aplicacao web separada dentro deste branch
- rotas, providers, services, assets e contratos foram restaurados do backup e ajustados para o App Router

## O que ja foi consolidado

- comandos principais da raiz apontam para Next: `dev`, `build`, `start`, `typecheck`
- `src/app` contem as rotas da plataforma
- `src/providers` contem os providers reais da aplicacao
- `src/services/api` contem a camada HTTP usada pelos fluxos restaurados
- imports de `react-router-dom` foram removidos da arvore ativa
- login voltou a usar o fluxo real do `AuthProvider`
- a sessao foi protegida para SSR, sem acesso a `window` ou `localStorage` no topo do modulo
- os contratos TypeScript foram realinhados para a plataforma restaurada
- os artefatos da tentativa separada foram removidos da arvore ativa

## Validacoes recentes

- `npm run dev`: servidor local na raiz, porta `3000`
- smoke HTTP em dev: rotas principais responderam `200`
- `npm run typecheck`: ok na raiz
- `npm run check:text-encoding`: ok apos correcao de textos
- `npm run build`: nao executado nesta retomada por instrucao de trabalhar em dev

## Pendencias antes de producao

- auditoria visual 1:1 contra o branch `master`
- auditoria funcional dos fluxos sensiveis: login, cadastro, checkout, assinaturas, questoes, simulados, materiais e admin
- auditoria de arquivos mortos e duplicacoes
- auditoria de SEO apos estabilizar rotas publicas, robots e sitemaps
- configuracao final de dominio, Vercel/VPS e Search Console quando o dominio existir

## Regra operacional

Qualquer nova alteracao deve respeitar a plataforma original restaurada. Ajustes tecnicos para Next sao permitidos; redesenhar UI ou trocar fluxo de produto sem pedido explicito nao e permitido.
