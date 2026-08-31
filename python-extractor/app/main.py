from __future__ import annotations

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .extractor import extract_exam
from .models import ExtractionResponse

app = FastAPI(title="ConcursoMestre Python Extractor", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/extract", response_model=ExtractionResponse)
async def extract(
    exam_pdf: UploadFile = File(...),
    answer_key_pdf: UploadFile | None = File(None),
    metadata_json: str | None = Form(None),
) -> ExtractionResponse:
    if not exam_pdf.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="O arquivo da prova deve ser PDF.")
    exam_bytes = await exam_pdf.read()
    if not exam_bytes:
        raise HTTPException(status_code=400, detail="Arquivo da prova vazio.")
    answer_key_bytes = await answer_key_pdf.read() if answer_key_pdf else None
    try:
        return extract_exam(exam_bytes, answer_key_bytes, metadata_json)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Falha ao extrair prova: {exc}") from exc
