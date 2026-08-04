CONCURSOMESTRE - COLETOR GRAN
VERSAO 1.0.16

Instalacao privada no Google Chrome:

1. Extraia todos os arquivos deste ZIP em uma pasta permanente.
2. Remova a versao antiga em chrome://extensions, se ela estiver instalada.
3. Abra chrome://extensions.
4. Ative o modo do desenvolvedor.
5. Clique em "Carregar sem compactacao".
6. Selecione a nova pasta que contem manifest.json.
7. Fixe a extensao "ConcursoMestre - Coletor Gran" na barra.
8. Clique no icone da extensao e depois em "Abrir Gran".
9. Se ja estiver logado, apenas recarregue a pagina da lista de questoes.
   Caso contrario, autentique-se normalmente e abra essa pagina.
10. A extensao captura automaticamente a sessao de qualquer requisicao
    autenticada feita pela pagina oficial para a API oficial da Gran.
11. Volte ao painel do ConcursoMestre; a verificacao e automatica.

Seguranca:

- A credencial fica somente em chrome.storage.session.
- A credencial e obtida automaticamente do header da requisicao feita pela Gran.
- Fechar o Chrome encerra a sessao da extensao.
- A extensao observa apenas a API oficial da Gran para reconhecer a sessao.
- A coleta de dados permanece limitada a rotas oficiais predefinidas de questoes e taxonomias.
- O ConcursoMestre recebe apenas o JSON coletado, nunca a credencial.
- Remova a extensao em chrome://extensions quando nao precisar mais dela.
