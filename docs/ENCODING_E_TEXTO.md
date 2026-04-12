# Regra de Encoding e Integridade de Texto

## Objetivo

Evitar definitivamente textos corrompidos (mojibake), por exemplo:

- `renova` + sequencia quebrada de acentuacao
- `cart` + sequencia quebrada de acentuacao
- `Nao foi possivel` com bytes corrompidos no lugar dos acentos

## Regra obrigatoria

1. Todo arquivo de codigo e conteudo deve ser salvo em `UTF-8` (sem reencode para ANSI/Windows-1252).
2. Nenhuma string com padrao de mojibake pode entrar no repositorio.
3. Em caso de correcoes em lote de texto, executar o fix oficial antes do commit.

## Comandos oficiais

```bash
npm run check:text-encoding
npm run fix:text-encoding
```

## Politica de pipeline

- `npm run check:text-encoding` deve passar em PR/CI.
- Se falhar, executar `npm run fix:text-encoding`, revisar os arquivos alterados e commitar a correcao.

## Escopo da varredura

O check cobre:

- frontend (`src/`)
- backend (`C:/xampp/htdocs/questao-pro-backend`)
- documentacao (`docs/`, exceto backups legados)
