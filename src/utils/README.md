# Utils

Esta pasta recebe apenas funções puras e reutilizáveis.

Regras:
- sem efeitos colaterais escondidos
- sem acesso direto à UI
- sem chamadas HTTP
- se a função for específica de um domínio, ela deve nascer perto do domínio e só subir para `src/utils` quando o reuso for real
