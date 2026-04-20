# Transicao - Lei Comentada Persistente

## 2026-04-20

### O que mudou

- O modulo deixou de depender do preview local como fonte principal e passou a consumir a API PHP em `legal-commentary/*`.
- O backend recebeu o dominio `legal_commentary`, com tabelas MySQL para areas, leis, artigos, comentarios de professor, jurisprudencia, sumulas, macetes, favoritos, comentarios de usuarios, progresso, atualizacoes e logs de sincronizacao.
- A criacao do schema acontece no primeiro acesso local, mantendo tambem a rota pronta para evoluir para migracoes formais.
- A tela publica `/lei-comentada` e a tela de detalhe `/lei-comentada/[slug]` agora leem leis, favoritos, progresso e comentarios pelo backend.
- A area `/admin/operation/lei-comentada` foi adicionada ao painel de Operacao para listar leis persistidas no banco.
- A pagina `/admin/operation/lei-comentada/[lawId]/edit` foi criada para editar metadados da lei, texto dos artigos, vinculo com materia/assunto, comentarios de professor, jurisprudencia, sumulas e macetes.
- O editor administrativo ganhou botoes de IA para gerar rascunhos de comentario, macete, jurisprudencia e sumula, sempre exigindo revisao editorial antes do salvamento.

### Decisao

A partir desta etapa, dados editoriais da Lei Comentada devem ser tratados como produto real persistido no banco. O seed/localStorage fica apenas como historico de transicao e nao deve ser usado como fonte oficial da experiencia.
