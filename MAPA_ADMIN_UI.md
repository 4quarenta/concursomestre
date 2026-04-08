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

# MAPA ADMIN UI

## Arquitetura proposta

### 1. Visao executiva

- Dashboard
- KPIs
- alertas de billing
- filas de moderacao
- health de webhook / cron

### 2. Operacao

- Questoes
- Importador
- Filtros / taxonomias
- Usuarios
- Materiais

### 3. Moderacao

- Denuncias
- Rankings
- Materiais bloqueados

### 4. Financeiro

- Saldo / repasses
- Transacoes
- Reembolsos
- Planos
- Cupons
- Automacao

### 5. Suporte

- Feedback
- Threads
- SLA interno

### 6. Configuracoes

- Geral
- Modulos
- Seguranca
- Integracoes
- Email
- Ads
- Performance

## Secoes e subareas

- `dashboard`
- `questions`
- `filters`
- `users`
- `materials`
- `rankings`
- `reports`
- `finance`
- `feedback`
- `settings`

## Componentes reutilizaveis

- `AdminShellLayout`
- `AdminPageHeader`
- `AdminConfirmDialog`
- `LogViewer`
- `SortableHeader`
- modais de detalhe
- tabelas com filtros

## Padroes visuais e comportamentais

- dominio claro na sidebar
- confirmacao modal para acao destrutiva
- loading por item
- save explicito para configuracao critica
- badge de fila critica
- texto de erro padronizado

## Problemas atuais

- Finance ainda muito grande
- Settings ainda muito grande
- providers globais ainda entram em fluxos criticos
- parte do admin ainda depende de estados locais derivados
- alguns dominios ficam escondidos dentro de secoes amplas

## Proposta de reorganizacao

1. Sidebar por dominio
2. Header curto com contexto do dominio
3. Subnavegacao interna por secoes locais
4. Tabelas padronizadas
5. Drawer/modal unico para confirmacoes e detalhe

## Plano de migracao

1. Preservar contratos atuais
2. Mover navegacao primeiro
3. Dividir finance em componentes menores
4. Dividir settings em componentes menores
5. Consolidar services por dominio
6. Remover stubs e fluxos locais residuais
