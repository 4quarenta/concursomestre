# Arquitetura do Modulo de AI

## Objetivo

Centralizar no modulo `ai` a rota legada de geracao por Gemini, evitando:

- SQL dentro de `api/ai/generate.php`
- cURL montado diretamente na rota
- utilitarios de diagnostico expostos como endpoints web

## Estrutura oficial

```text
modules/ai/
  controllers/
    AiController.php
  services/
    AiService.php
  repositories/
    AiRepository.php
  validators/
    AiValidator.php
  routes.php
```

## Tabelas tocadas

### `system_settings`

Usada para obter:

- `geminiApiKey`

## Fluxo absorvido

1. O consumer legado chama `api/ai/generate.php`
2. O bridge delega para `handleAiGenerateRoute()`
3. O repository tenta ler a chave Gemini em `system_settings`
4. O service faz fallback para `GEMINI_API_KEY` no ambiente
5. O validator garante que o prompt exista e respeite o limite basico
6. O service chama a API do Gemini
7. O endpoint responde com envelope JSON padronizado

## Scripts operacionais

Listagem de modelos Gemini nao deve existir em rota web nem em `htdocs`.
O diagnostico manual legado foi arquivado fora da raiz publica em:

- `C:\xampp\private-backups\questao-pro-backend\dev-scripts-archive\2026-05-18\scripts\manual-tests\list_gemini_models.php`

Se voltar a ser necessario, recrie como tarefa CLI controlada em `scripts/tasks/`, nunca como endpoint publico.
