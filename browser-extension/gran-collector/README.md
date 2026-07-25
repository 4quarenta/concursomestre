# Coletor Gran

Extensão privada usada apenas na rota administrativa
`/admin/operation/gran-crawler`.

## Fluxo

1. O administrador autentica-se normalmente no Gran.
2. A extensão mantém o bearer somente em `chrome.storage.session`.
3. A consulta de questões usa exclusivamente
   `https://rota-api.grancursosonline.com.br/v1/elastic/questao`.
4. Para cada prova encontrada, inclusive quando os metadados estão
   encapsulados em `prova`, a extensão consulta `/v1/provas/{id}/arquivos`
   e normaliza edital, caderno de prova e gabarito.
5. O bearer nunca é enviado ao ConcursoMestre.
6. O worker valida os links, baixa PDFs do host oficial e os copia para o
   object storage da plataforma antes de persistir a prova.

Após atualizar os arquivos da extensão, recarregue-a em
`chrome://extensions` para ativar a versão indicada no `manifest.json`.
