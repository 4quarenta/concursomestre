# Rotação de credenciais comprometidas

## Escopo

Este procedimento cobre chaves que tenham aparecido em dump, log, anexo,
histórico de shell, issue ou repositório. Não registre o novo valor em Git,
documentação, ticket ou mensagem de chat.

## Execução

1. Revogue a credencial no painel do provedor e registre apenas o identificador
   da rotação no cofre de segredos.
2. Crie uma nova credencial com menor privilégio possível.
3. Atualize o secret manager ou o arquivo privado de ambiente da VPS.
4. Reinicie somente o serviço que lê a credencial e execute o smoke test do
   fluxo dependente.
5. Monitore logs e uso do provedor por 24 horas; investigue uso entre a data de
   exposição e a revogação.
6. Sanitize dumps e remova anexos/históricos externos que contenham a chave.

## Gemini e IA

- Revogar a chave exposta no Google AI Studio/Google Cloud.
- Criar uma chave nova com restrição de API e projeto.
- Atualizar somente `GEMINI_API_KEY` no ambiente privado.
- Validar uma geração mínima no ambiente de homologação antes da produção.

## Verificação de repositório

Execute `npm run check:secrets` antes de cada push. O check varre apenas
arquivos rastreados e falha para padrões de chaves de provedores e blocos de
chave privada. Dumps, backups e diretórios temporários não devem ser
versionados.

## Rollback

Se a nova credencial falhar, revogue-a, restaure a credencial anterior somente
se ela não estiver comprometida e registre o incidente. Uma credencial exposta
nunca deve voltar a ser usada.
