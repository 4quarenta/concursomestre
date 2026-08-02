# Coletor Gran

ExtensÃ£o privada usada apenas na rota administrativa
`/admin/operation/gran-crawler`.

## Fluxo

1. O administrador autentica-se normalmente no Gran.
2. A extensÃ£o mantÃ©m o bearer somente em `chrome.storage.session`.
3. A consulta de questÃµes usa exclusivamente
   `https://rota-api.grancursosonline.com.br/v1/elastic/questao`.
4. Para cada prova encontrada, inclusive quando os metadados estÃ£o
   encapsulados em `prova`, a extensÃ£o consulta `/v1/provas/{id}/arquivos`
   e normaliza edital, caderno de prova e gabarito.
5. O bearer nunca Ã© enviado ao ConcursoMestre.
6. O worker valida os links, baixa PDFs do host oficial e os copia para o
   object storage da plataforma antes de persistir a prova.

ApÃ³s atualizar os arquivos da extensÃ£o, recarregue-a em
`chrome://extensions` para ativar a versÃ£o indicada no `manifest.json`.
