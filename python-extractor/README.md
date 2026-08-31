# ConcursoMestre Python Extractor

Servico de extracao de provas por PDF.js-equivalente no backend Python, usando PyMuPDF como fonte principal de texto, geometria e paginas.

## Rodar localmente

```powershell
cd python-extractor
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8010 --reload
```

Configure o frontend com:

```env
NEXT_PUBLIC_IMPORT_EXTRACTOR_URL=http://127.0.0.1:8010/extract
```

## Contrato

`POST /extract` multipart:

- `exam_pdf`: PDF da prova.
- `answer_key_pdf`: PDF do gabarito.
- `metadata_json`: JSON opcional com metadados da prova/banco de provas.

Resposta:

- `questions`: cards de revisao, incluindo placeholders para faltantes.
- `contexts`: contextos compartilhados detectados.
- `diagnostics`: cobertura, completas, incompletas e pendentes.
- `logs`: log legivel para o mini-console.

Este servico nao inventa enunciados. Quando nao localiza uma questao esperada, cria um card pendente editavel.
