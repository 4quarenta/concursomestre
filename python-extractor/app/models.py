from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class FigureBox(BaseModel):
    x: float = 0
    y: float = 0
    width: float = 0
    height: float = 0


class PositionedPdfTextItem(BaseModel):
    text: str
    pageNumber: int
    rawIndex: int
    x: float
    y: float
    width: float
    height: float
    normalizedX: float
    normalizedY: float
    normalizedWidth: float
    normalizedHeight: float
    fontName: str | None = None
    fontSize: float | None = None
    bold: bool = False
    italic: bool = False
    underline: bool = False
    hasEOL: bool = False


class PdfTextLine(BaseModel):
    text: str
    pageNumber: int
    box: FigureBox
    items: list[PositionedPdfTextItem] = Field(default_factory=list)
    columnIndex: int = 0


class PdfTextBlock(BaseModel):
    text: str
    pageNumber: int
    box: FigureBox
    lines: list[PdfTextLine] = Field(default_factory=list)
    type: str = "unknown"
    confidence: float = 0.5


class PdfPageData(BaseModel):
    pageNumber: int
    plainText: str
    richText: str
    items: list[PositionedPdfTextItem] = Field(default_factory=list)
    lines: list[PdfTextLine] = Field(default_factory=list)
    blocks: list[PdfTextBlock] = Field(default_factory=list)
    columns: list[list[PdfTextLine]] = Field(default_factory=list)
    pageType: Literal[
        "cover",
        "instructions",
        "question_page",
        "context_page",
        "answer_key",
        "discursive",
        "blank",
        "unknown",
    ] = "unknown"
    nativeTextCoverage: float = 0
    layoutConfidence: float = 0


class ImportQuestionQuality(BaseModel):
    origin: Literal["mechanical", "ai", "hybrid", "manual", "placeholder"] = "mechanical"
    confidence: float = 0
    complete: bool = False
    localized: bool = False
    needsReview: bool = True
    reasons: list[str] = Field(default_factory=list)
    probablePages: list[int] = Field(default_factory=list)


class ImportedContextDraft(BaseModel):
    tempId: str
    title: str = "Contexto"
    text: str = ""
    referenceText: str = ""
    richText: str = ""
    questionNumbers: list[int] = Field(default_factory=list)
    hasFigure: bool = False
    figureDescription: str = ""
    page: int = 0
    sourcePage: int | None = None
    figureBox: FigureBox | None = None


class ImportedQuestionDraft(BaseModel):
    id: str
    questionNumber: int
    question_number: int
    number: int
    sourcePage: int | None = None
    source_page: int | None = None
    probablePages: list[int] = Field(default_factory=list)
    text: str = ""
    raw: str = ""
    enunciado: str = ""
    enunciado_clean: str = ""
    introText: str = ""
    intro_text: str = ""
    supportText: str = ""
    support_text: str = ""
    referenceText: str = ""
    reference_text: str = ""
    contextKey: str = ""
    contextTitle: str = ""
    contextScope: str = ""
    options: list[str] = Field(default_factory=list)
    itens: list[dict[str, Any]] = Field(default_factory=list)
    resposta: int = 0
    correctOptionIndex: int | None = None
    tipo: str = "desconhecido"
    modality: str = "desconhecido"
    questionType: str = "desconhecido"
    dificuldade: int = 2
    status: str = "incompleta"
    extractionStatus: str = "incompleta"
    needsImportReview: bool = True
    statusReasons: list[str] = Field(default_factory=list)
    validationReasons: list[str] = Field(default_factory=list)
    rejectionReason: str = ""
    qualityReport: ImportQuestionQuality = Field(default_factory=ImportQuestionQuality)
    extractionQuality: ImportQuestionQuality = Field(default_factory=ImportQuestionQuality)
    hasFigure: bool = False
    figureDescription: str = ""
    bancas: list[Any] = Field(default_factory=list)
    orgaos: list[Any] = Field(default_factory=list)
    cargos: list[Any] = Field(default_factory=list)
    assuntos: list[Any] = Field(default_factory=list)
    anos: list[Any] = Field(default_factory=list)
    carreiras: list[Any] = Field(default_factory=list)
    niveis: list[Any] = Field(default_factory=list)
    questionOrigin: str = "exam"
    question_origin: str = "exam"
    stats: dict[str, int] = Field(default_factory=lambda: {"totalAttempts": 0, "correctCount": 0, "wrongCount": 0})
    comments: list[Any] = Field(default_factory=list)


class ImportDiagnostics(BaseModel):
    expectedQuestionNumbers: list[int] = Field(default_factory=list)
    extractedQuestionNumbers: list[int] = Field(default_factory=list)
    localizedQuestionNumbers: list[int] = Field(default_factory=list)
    completeQuestionNumbers: list[int] = Field(default_factory=list)
    incompleteQuestionNumbers: list[int] = Field(default_factory=list)
    missingQuestionNumbers: list[int] = Field(default_factory=list)
    placeholderQuestionNumbers: list[int] = Field(default_factory=list)
    visualPendingQuestionNumbers: list[int] = Field(default_factory=list)
    duplicateQuestionNumbers: list[int] = Field(default_factory=list)
    suspiciousQuestionNumbers: list[int] = Field(default_factory=list)
    cardsCreatedCount: int = 0
    completeCardsCount: int = 0
    incompleteCardsCount: int = 0
    placeholderCardsCount: int = 0
    pagesWithoutNativeText: list[int] = Field(default_factory=list)
    lowConfidencePages: list[int] = Field(default_factory=list)
    aiQuotaLimitReached: bool = False
    aiTokenLimitReached: bool = False
    aiLimitReached: bool = False
    aiCallCount: int = 0
    aiCallLimit: int = 0
    aiCallsSkipped: int = 0
    aiCallsSavedEstimate: int = 0


class ExtractionResponse(BaseModel):
    success: bool = True
    metadata: dict[str, Any] = Field(default_factory=dict)
    questions: list[ImportedQuestionDraft] = Field(default_factory=list)
    contexts: list[ImportedContextDraft] = Field(default_factory=list)
    diagnostics: ImportDiagnostics = Field(default_factory=ImportDiagnostics)
    logs: list[str] = Field(default_factory=list)
    pages: list[PdfPageData] = Field(default_factory=list)
