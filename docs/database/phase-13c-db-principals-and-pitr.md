# Fase 13C - Principals de banco, PITR e ativos de recuperação

Data: 2026-08-29

## Escopo

Este documento registra contratos e pendências operacionais para a remediação
de banco/backup. Não executa DDL, DML, grants, alterações de `my.cnf`, timers,
replicação, KMS ou cópia off-host.

## Principals

| Principal | Uso | Permissões mínimas candidatas | Proibições |
| --- | --- | --- | --- |
| aplicação | requests normais | DML somente nas tabelas explicitamente necessárias | DDL, GRANT, acesso a schemas de sistema |
| backup read-only | dump/metadata | SELECT/SHOW VIEW e permissões adicionais somente se o comando de backup exigir | INSERT, UPDATE, DELETE, ALTER, DROP |
| auditoria read-only | censo, EXPLAIN, verificação | SELECT e metadados necessários | qualquer DML/DDL |
| migration operador | janela controlada | DDL das migrations aprovadas, temporário e separado | uso pelo runtime, credencial persistente no código |
| restauração isolada | rehearsal | permissões no schema descartável | acesso ao schema de produção |

Os grants candidatos sem credenciais estão em
`backend/ops/mysql/least-privilege-grants.sql.example`. A matriz é uma proposta
de mudança operacional e exige revisão do owner do banco antes de aplicação.

## Durabilidade e PITR

O candidate `backend/ops/mysql/pitr-candidate.cnf.example` registra os controles
de durabilidade para rehearsal: `innodb_flush_log_at_trx_commit=1`,
`sync_binlog=1`, binlog em formato `ROW` e retenção explicitamente configurada.
O `server-id`, diretório, retenção efetiva, monitoramento e topologia devem ser
definidos no host. GTID permanece uma decisão de topologia, não uma suposição.

PITR só será considerado operacionalmente disponível quando houver:

1. binlogs duráveis e copiados para local distinto;
2. retenção compatível com o RPO aprovado;
3. teste de restauração até um ponto escolhido;
4. alerta para falha de cópia e expiração de binlog;
5. owner e procedimento de recovery documentados.

## Off-host, imutabilidade e segredos

O código local garante escrita privada, checksum, manifest e publicação atômica.
Isso não prova proteção off-host, WORM/immutability, criptografia gerenciada ou
escrow de segredos. Esses itens continuam gates externos antes do Production GO.

Ativos de aplicação devem ser inventariados separadamente do dump: uploads
locais, objetos S3/R2 quando configurados, documentos protegidos, configuração
de deploy, secrets manager, estado de provedores e certificados. O
`AssetBackupManager` cobre apenas o snapshot local sintético/rehearsal; ele não
é uma replicação off-host.

## Decisão

Implementado nesta etapa: boundary de artefato atômico, checksum e manifest
obrigatórios, caminho de rehearsal e contratos de least privilege/PITR.

Não implementado em produção: grants, configuração do servidor, off-host,
KMS, retenção real, timers e escrow. Portanto, a autorização de migrations e o
Production GO continuam condicionados aos gates operacionais externos.
