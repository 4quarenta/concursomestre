# Vercel Root Transition

## Objetivo

Alinhar o projeto do Vercel com a consolidacao da plataforma Next na raiz do repositorio.

## Estado correto

- `Root Directory`: raiz do repositorio
- `Install Command`: `npm ci`
- `Build Command`: `npm run build`
- framework: `Next.js`

## Motivo

A aplicacao web separada deixou de existir. Todo o codigo web ativo agora mora na raiz:

- app: `src/`
- config Next: `next.config.ts`
- config TypeScript: `tsconfig.json`
- config PostCSS: `postcss.config.mjs`

Se o projeto do Vercel continuar apontando para qualquer subpasta antiga, os checks de PR vao falhar porque a raiz passou a ser a base do deploy.

## Evidencia local

- `npm run dev`: validado na raiz em rotas principais
- `npm run typecheck`: ok na raiz
- `npm run check:text-encoding`: ok
- `npm run build`: nao executado nesta retomada por instrucao explicita de trabalhar apenas com `npm run dev`

## Observacao da retomada fria

Em `2026-04-18`, a migracao foi reiniciada a partir do branch `master` para preservar a UI e a funcionalidade web exatamente como estavam antes da tentativa anterior. O Vercel continua devendo apontar para a raiz, mas o gate final de deploy so deve ser considerado depois que typecheck/build forem liberados novamente.

## Acao externa necessaria

No painel do Vercel:

1. abrir o projeto `concursomestre`
2. entrar em `Settings`
3. abrir `Build and Deployment Settings`
4. alterar `Root Directory` para a raiz do repositorio
5. manter `Install Command` como `npm ci`
6. manter `Build Command` como `npm run build`
7. redeployar o commit
