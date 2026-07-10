# Architecture Filters

## Contexto

O dominio `filters` organiza as taxonomias usadas pela plataforma:

- bancas
- orgaos
- cargos
- assuntos
- anos
- carreiras

## Estrutura

### Repository

Concentra a leitura e mutacao das taxonomias persistidas.

### Service

Orquestra:

- listagem publica das taxonomias
- criacao e atualizacao administrativa
- exclusao administrativa

### Validator

Valida:

- tipo do filtro
- nome
- hierarquia pai/filho
- payload administrativo

### Controller

Permanece fino e delega para o service.

## Bridges legados

Os endpoints abaixo permanecem apenas como adaptadores HTTP:

- `api/filters/list.php`
- `api/filters/save.php`
- `api/filters/delete.php`

## Papel no frontend

O frontend consome esse dominio para montar `taxonomies` em:

- `DataProvider`
- painel administrativo
- telas de pratica, simulacao, ranking e raio-x
