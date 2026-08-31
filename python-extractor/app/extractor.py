from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

import fitz

from .models import (
    ExtractionResponse,
    FigureBox,
    ImportedContextDraft,
    ImportedQuestionDraft,
    ImportDiagnostics,
    ImportQuestionQuality,
    PdfPageData,
    PdfTextBlock,
    PdfTextLine,
    PositionedPdfTextItem,
)


QUESTION_MARKER_RE = re.compile(
    r"^\s*(?:quest\w*\s*)?0*(?P<number>\d{1,3})(?:\s*[).:-]|\s+|$)",
    re.IGNORECASE,
)
STRONG_QUESTION_MARKER_RE = re.compile(
    r"^\s*(?:quest(?:a|ã|Ã)?o|quest(?:Ã|A)£o|questao)\s*0*(?P<number>\d{1,3})\b",
    re.IGNORECASE,
)
OPTION_MARKER_RE = re.compile(r"(?:(?<=^)|(?<=\s))[\(\[]?(?P<label>[A-E])[\)\].:-]\s+", re.IGNORECASE)
LINE_OPTION_MARKER_RE = re.compile(r"(?m)^\s*(?P<label>[A-E])\s+(?=\S)")
OPTION_LABELS = "ABCDE"
ANSWER_KEY_RE = re.compile(
    r"(?<!\d)(?P<number>\d{1,3})\s*(?:[).:-]|\s+)\s*(?P<option>[A-E]|ANULAD[AO]|NULA|X)(?![A-Z])",
    re.IGNORECASE,
)
CONTEXT_RANGE_RE = re.compile(
    r"(?:quest\w+|itens)\s+(?P<start>\d{1,3})\s*(?:a|ate|at\w+|[-\u2013\u2014])\s*(?P<end>\d{1,3})",
    re.IGNORECASE,
)
CONTEXT_LIST_RE = re.compile(
    r"(?:quest\w+|itens)\s+(?P<list>\d{1,3}(?:\s*[,/]\s*\d{1,3})*(?:\s+e\s+\d{1,3})?)",
    re.IGNORECASE,
)
REFERENCE_RE = re.compile(r"\b(dispon\w*\s+em|acesso\s+em|adaptado\s+de|fonte:|internet:|in:)\b", re.IGNORECASE)
CONTEXT_SIGNALS = [
    "texto para responder",
    "leia o texto",
    "leia os textos",
    "com base no texto",
    "com base nos textos",
    "para responder",
    "responder as quest",
    "responder às quest",
    "texto i",
    "texto ii",
    "considere o texto",
    "considere a situacao",
    "considere a situação",
]
VISUAL_CONTEXT_SIGNALS = [
    "figura",
    "imagem",
    "grafico",
    "gráfico",
    "tabela",
    "mapa",
    "charge",
    "tirinha",
    "quadro",
    "diagrama",
    "observe",
    "analise",
]


@dataclass
class RawQuestion:
    number: int
    text: str
    options: list[str]
    page: int
    box: FigureBox | None
    context_key: str = ""
    support_text: str = ""
    reference_text: str = ""


def normalize_box(rect: fitz.Rect, page_rect: fitz.Rect) -> FigureBox:
    width = max(float(page_rect.width), 1.0)
    height = max(float(page_rect.height), 1.0)
    return FigureBox(
        x=max(0, min(1000, rect.x0 / width * 1000)),
        y=max(0, min(1000, rect.y0 / height * 1000)),
        width=max(0, min(1000, rect.width / width * 1000)),
        height=max(0, min(1000, rect.height / height * 1000)),
    )


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def extract_question_marker(text: str) -> int | None:
    strong_match = STRONG_QUESTION_MARKER_RE.match(text)
    if strong_match:
        return int(strong_match.group("number"))
    match = QUESTION_MARKER_RE.match(text)
    if not match:
        return None
    return int(match.group("number"))


def read_pdf_pages(data: bytes) -> list[PdfPageData]:
    document = fitz.open(stream=data, filetype="pdf")
    pages: list[PdfPageData] = []
    for page_index in range(document.page_count):
        page = document.load_page(page_index)
        page_rect = page.rect
        raw = page.get_text("dict")
        items: list[PositionedPdfTextItem] = []
        raw_index = 0
        for block in raw.get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "")
                    if not text.strip():
                        continue
                    rect = fitz.Rect(span.get("bbox", [0, 0, 0, 0]))
                    font_name = str(span.get("font", ""))
                    flags = int(span.get("flags", 0) or 0)
                    items.append(
                        PositionedPdfTextItem(
                            text=text,
                            pageNumber=page_index + 1,
                            rawIndex=raw_index,
                            x=float(rect.x0),
                            y=float(rect.y0),
                            width=float(rect.width),
                            height=float(rect.height),
                            normalizedX=normalize_box(rect, page_rect).x,
                            normalizedY=normalize_box(rect, page_rect).y,
                            normalizedWidth=normalize_box(rect, page_rect).width,
                            normalizedHeight=normalize_box(rect, page_rect).height,
                            fontName=font_name,
                            fontSize=float(span.get("size", 0) or 0),
                            bold="bold" in font_name.lower() or bool(flags & 16),
                            italic="italic" in font_name.lower() or bool(flags & 2),
                            hasEOL=False,
                        )
                    )
                    raw_index += 1
        lines = build_lines(items)
        blocks = build_blocks(lines)
        plain = "\n".join(line.text for line in lines).strip()
        pages.append(
            PdfPageData(
                pageNumber=page_index + 1,
                plainText=plain,
                richText=plain,
                items=items,
                lines=lines,
                blocks=blocks,
                columns=detect_columns(lines),
                pageType=classify_page(plain),
                nativeTextCoverage=min(1.0, len(plain) / 1200),
                layoutConfidence=0.85 if lines else 0.0,
            )
        )
    document.close()
    return pages


def build_lines(items: list[PositionedPdfTextItem]) -> list[PdfTextLine]:
    if not items:
        return []
    sorted_items = sorted(items, key=lambda item: (round(item.normalizedY / 4), item.normalizedX, item.rawIndex))
    groups: list[list[PositionedPdfTextItem]] = []
    for item in sorted_items:
        target = None
        for group in reversed(groups[-6:]):
            baseline = sum(existing.normalizedY for existing in group) / len(group)
            if abs(item.normalizedY - baseline) <= max(6, item.normalizedHeight * 0.55):
                target = group
                break
        if target is None:
            groups.append([item])
        else:
            target.append(item)
    lines: list[PdfTextLine] = []
    for group in groups:
        ordered = sorted(group, key=lambda item: (item.normalizedX, item.rawIndex))
        text = normalize_text(" ".join(item.text for item in ordered))
        if not text:
            continue
        min_x = min(item.normalizedX for item in ordered)
        min_y = min(item.normalizedY for item in ordered)
        max_x = max(item.normalizedX + item.normalizedWidth for item in ordered)
        max_y = max(item.normalizedY + item.normalizedHeight for item in ordered)
        column_index = 1 if min_x > 520 else 0
        lines.append(
            PdfTextLine(
                text=text,
                pageNumber=ordered[0].pageNumber,
                box=FigureBox(x=min_x, y=min_y, width=max_x - min_x, height=max_y - min_y),
                items=ordered,
                columnIndex=column_index,
            )
        )
    return sorted(lines, key=lambda line: (line.columnIndex, line.box.y, line.box.x))


def detect_columns(lines: list[PdfTextLine]) -> list[list[PdfTextLine]]:
    left = [line for line in lines if line.columnIndex == 0]
    right = [line for line in lines if line.columnIndex == 1]
    if right and len(right) >= max(3, len(lines) * 0.2):
        return [left, right]
    return [lines]


def build_blocks(lines: list[PdfTextLine]) -> list[PdfTextBlock]:
    blocks: list[PdfTextBlock] = []
    current: list[PdfTextLine] = []
    previous: PdfTextLine | None = None
    for line in sorted(lines, key=lambda item: (item.columnIndex, item.box.y, item.box.x)):
        starts_new = False
        if previous is not None:
            vertical_gap = line.box.y - (previous.box.y + previous.box.height)
            starts_new = line.columnIndex != previous.columnIndex or vertical_gap > 22 or extract_question_marker(line.text) is not None
        if starts_new and current:
            blocks.append(make_block(current))
            current = []
        current.append(line)
        previous = line
    if current:
        blocks.append(make_block(current))
    return blocks


def make_block(lines: list[PdfTextLine]) -> PdfTextBlock:
    min_x = min(line.box.x for line in lines)
    min_y = min(line.box.y for line in lines)
    max_x = max(line.box.x + line.box.width for line in lines)
    max_y = max(line.box.y + line.box.height for line in lines)
    return PdfTextBlock(
        text="\n".join(line.text for line in lines),
        pageNumber=lines[0].pageNumber,
        box=FigureBox(x=min_x, y=min_y, width=max_x - min_x, height=max_y - min_y),
        lines=lines,
        confidence=0.8,
    )


def classify_page(text: str) -> str:
    clean = normalize_text(text).lower()
    if not clean:
        return "blank"
    if "gabarito" in clean and len(ANSWER_KEY_RE.findall(clean.upper())) >= 5:
        return "answer_key"
    strong_markers = re.findall(r"\bquest\w*\s*\d{1,3}\b", clean, re.IGNORECASE)
    numeric_markers = re.findall(r"(?m)^\s*\d{1,3}[).:-]", clean, re.IGNORECASE)
    if strong_markers or len(numeric_markers) >= 2:
        return "question_page"
    if "instru" in clean or "marque" in clean:
        return "instructions"
    return "unknown"


def parse_answer_key(data: bytes | None) -> dict[int, int]:
    if not data:
        return {}
    pages = read_pdf_pages(data)
    text = "\n".join(page.plainText for page in pages)
    result: dict[int, int] = {}
    for match in ANSWER_KEY_RE.finditer(text):
        number = int(match.group("number"))
        option = match.group("option").upper()
        if option and option[0] in "ABCDE":
            result[number] = "ABCDE".index(option[0])
    return result


def parse_expected_numbers(metadata: dict[str, Any], answer_key: dict[int, int]) -> list[int]:
    if answer_key:
        return list(range(1, max(answer_key) + 1))

    candidates = [
        metadata.get("totalQuestions"),
        metadata.get("total_questions"),
        metadata.get("totalQuestoes"),
        metadata.get("questionCount"),
        metadata.get("expectedQuestionCount"),
    ]
    total = 0
    for candidate in candidates:
        try:
            total = max(total, int(str(candidate).strip()))
        except Exception:
            pass
    if total <= 0 and answer_key:
        total = max(answer_key)
    return list(range(1, total + 1)) if total > 0 else []


def parse_questions(pages: list[PdfPageData], expected_numbers: list[int] | None = None) -> list[RawQuestion]:
    expected_set = set(expected_numbers or [])
    lines: list[tuple[int, str, FigureBox]] = []
    for page in pages:
        for line in page.lines:
            lines.append((page.pageNumber, line.text, line.box))
    markers: list[tuple[int, int]] = []
    previous_number = 0
    for index, (_, text, _) in enumerate(lines):
        number = extract_question_marker(text)
        if number is None:
            continue
        if expected_set and number not in expected_set:
            continue
        if not expected_set and (number <= previous_number or number > previous_number + 3):
            continue
        if 1 <= number <= 250:
            markers.append((index, number))
            previous_number = number
    questions: list[RawQuestion] = []
    for marker_index, (start, number) in enumerate(markers):
        end = markers[marker_index + 1][0] if marker_index + 1 < len(markers) else len(lines)
        segment = lines[start:end]
        page = segment[0][0]
        raw_text = "\n".join(text for _, text, _ in segment)
        question_text, options, reference = split_question_and_options(raw_text)
        questions.append(
            RawQuestion(
                number=number,
                text=question_text,
                options=options,
                page=page,
                box=segment[0][2],
                reference_text=reference,
            )
        )
    return questions


def split_question_and_options(raw: str) -> tuple[str, list[str], str]:
    text = re.sub(r"^\s*(?:quest\w*\s*)?\d{1,3}\s*[).:-]?\s*", "", raw.strip(), flags=re.IGNORECASE)
    reference = ""
    ref_match = REFERENCE_RE.search(text)
    if ref_match and ref_match.start() > 40:
        reference = text[ref_match.start() :].strip()
        text = text[: ref_match.start()].strip()
    matches = find_option_markers(text)
    if len(matches) < 2:
        return normalize_text(text), [], normalize_text(reference)
    question_text = text[: matches[0].start()].strip()
    options: list[str] = []
    for index, match in enumerate(matches):
        label = match.group("label").upper()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        options.append(clean_option_text(label, text[start:end]))
    return normalize_text(question_text), [option for option in options if option], normalize_text(reference)


def find_option_markers(text: str) -> list[re.Match[str]]:
    marked = list(OPTION_MARKER_RE.finditer(text))
    if is_sequential_option_markers(marked):
        return marked
    line_marked = list(LINE_OPTION_MARKER_RE.finditer(text))
    if is_sequential_option_markers(line_marked):
        return line_marked
    return marked


def is_sequential_option_markers(matches: list[re.Match[str]]) -> bool:
    if len(matches) < 2:
        return False
    labels = [match.group("label").upper() for match in matches]
    if labels[0] != "A":
        return False
    expected = list(OPTION_LABELS[: len(labels)])
    return labels == expected


def clean_option_text(label: str, value: str) -> str:
    cleaned = normalize_text(value)
    return normalize_text(re.sub(rf"^\s*[\(\[]?{re.escape(label)}[\)\].:-]\s*", "", cleaned, flags=re.IGNORECASE))


def parse_contexts(pages: list[PdfPageData]) -> list[ImportedContextDraft]:
    contexts: list[ImportedContextDraft] = []
    seen: set[str] = set()
    for page in pages:
        for block_index, block in enumerate(page.blocks):
            text = normalize_text(block.text)
            if not text:
                continue
            numbers = parse_context_numbers(text)
            if not is_context_or_support_candidate(text, numbers):
                continue
            normalized_key = re.sub(r"\W+", "", text.lower())[:220]
            if normalized_key in seen:
                continue
            seen.add(normalized_key)
            reference = extract_reference_text(text)
            context_text = text
            if reference and len(reference) < len(text):
                context_text = normalize_text(text.replace(reference, ""))
            has_figure = any(signal in text.lower() for signal in VISUAL_CONTEXT_SIGNALS)
            contexts.append(
                ImportedContextDraft(
                    tempId=f"ctx-{page.pageNumber}-{block_index}",
                    title=guess_context_title(text),
                    text=context_text,
                    richText=context_text,
                    referenceText=reference,
                    questionNumbers=numbers,
                    hasFigure=has_figure,
                    figureDescription=guess_figure_description(text) if has_figure else "",
                    page=page.pageNumber,
                    sourcePage=page.pageNumber,
                )
            )
    return contexts


def is_context_or_support_candidate(text: str, numbers: list[int]) -> bool:
    lower = text.lower()
    if looks_like_question_or_option(text):
        return False
    if numbers:
        return True
    if any(signal in lower for signal in CONTEXT_SIGNALS):
        return True
    if any(signal in lower for signal in VISUAL_CONTEXT_SIGNALS):
        return True
    if REFERENCE_RE.search(text):
        return True
    return len(text) >= 220 and not OPTION_MARKER_RE.search(text)


def looks_like_question_or_option(text: str) -> bool:
    return bool(QUESTION_MARKER_RE.match(text) or OPTION_MARKER_RE.match(text))


def extract_reference_text(text: str) -> str:
    match = REFERENCE_RE.search(text)
    if not match:
        return ""
    start = max(0, match.start())
    reference = text[start:]
    return reference[:600].strip()


def guess_figure_description(text: str) -> str:
    lower = text.lower()
    for signal in VISUAL_CONTEXT_SIGNALS:
        if signal in lower:
            return f"Recurso visual mencionado no bloco: {signal}."
    return "Recurso visual mencionado no bloco."


def parse_context_numbers(text: str) -> list[int]:
    range_match = CONTEXT_RANGE_RE.search(text)
    if range_match:
        start = int(range_match.group("start"))
        end = int(range_match.group("end"))
        if 0 < start <= end <= 250 and end - start <= 40:
            return list(range(start, end + 1))
    list_match = CONTEXT_LIST_RE.search(text)
    if list_match:
        values = re.findall(r"\d{1,3}", list_match.group("list"))
        return sorted({int(value) for value in values if 0 < int(value) <= 250})
    return []


def guess_context_title(text: str) -> str:
    if re.search(r"textos?\s+i\s+e\s+ii", text, re.IGNORECASE):
        return "Textos I e II"
    if re.search(r"texto\s+i\b", text, re.IGNORECASE):
        return "Texto I"
    if re.search(r"figura", text, re.IGNORECASE):
        return "Figura"
    return "Texto de apoio"


def create_question(raw: RawQuestion, answer_key: dict[int, int], metadata: dict[str, Any]) -> ImportedQuestionDraft:
    correct = answer_key.get(raw.number)
    complete = bool(raw.text and len(raw.options) >= 2 and correct is not None)
    reasons: list[str] = []
    if not raw.text:
        reasons.append("enunciado_ausente")
    if len(raw.options) < 2:
        reasons.append("alternativas_ausentes")
    if correct is None:
        reasons.append("gabarito_nao_localizado")
    quality = ImportQuestionQuality(
        origin="mechanical",
        confidence=0.86 if complete else 0.45,
        localized=True,
        complete=complete,
        needsReview=not complete,
        reasons=reasons,
        probablePages=[raw.page],
    )
    return ImportedQuestionDraft(
        id=f"draft-{raw.number}",
        questionNumber=raw.number,
        question_number=raw.number,
        number=raw.number,
        sourcePage=raw.page,
        source_page=raw.page,
        probablePages=[raw.page],
        text=raw.text,
        raw=raw.text,
        enunciado=raw.text,
        enunciado_clean=raw.text,
        referenceText=raw.reference_text,
        reference_text=raw.reference_text,
        contextKey=raw.context_key,
        supportText=raw.support_text,
        support_text=raw.support_text,
        options=raw.options,
        itens=[
            {"id": f"{raw.number}-{label}", "ordem": index + 1, "rotulo": label, "corpo": option, "corpo_clean": option}
            for index, (label, option) in enumerate(zip("ABCDE", raw.options))
        ],
        resposta=(correct + 1) if correct is not None else 0,
        correctOptionIndex=correct,
        tipo="multipla escolha" if raw.options else "desconhecido",
        modality="multipla escolha" if raw.options else "desconhecido",
        questionType="multipla escolha" if raw.options else "desconhecido",
        status="ok" if complete else "incompleta",
        extractionStatus="ok" if complete else "incompleta",
        needsImportReview=not complete,
        statusReasons=reasons,
        validationReasons=reasons,
        qualityReport=quality,
        extractionQuality=quality,
        bancas=[metadata.get("agency")] if metadata.get("agency") else [],
        orgaos=metadata.get("sources") or [],
        cargos=metadata.get("roles") or metadata.get("cargos") or [],
    )


def create_placeholder(number: int, answer_key: dict[int, int], probable_pages: list[int]) -> ImportedQuestionDraft:
    correct = answer_key.get(number)
    reasons = [
        "questao_nao_localizada",
        "questao_placeholder_criada",
        "enunciado_ausente",
        "alternativas_ausentes",
        "aguardando_complemento_manual",
    ]
    if correct is not None:
        reasons.append("gabarito_indica_existencia")
    quality = ImportQuestionQuality(
        origin="placeholder",
        confidence=0,
        localized=False,
        complete=False,
        needsReview=True,
        reasons=reasons,
        probablePages=probable_pages,
    )
    return ImportedQuestionDraft(
        id=f"placeholder-{number}",
        questionNumber=number,
        question_number=number,
        number=number,
        sourcePage=probable_pages[0] if probable_pages else None,
        source_page=probable_pages[0] if probable_pages else None,
        probablePages=probable_pages,
        resposta=(correct + 1) if correct is not None else 0,
        correctOptionIndex=correct,
        status="incompleta",
        extractionStatus="incompleta",
        needsImportReview=True,
        statusReasons=reasons,
        validationReasons=reasons,
        rejectionReason="questao_nao_localizada",
        qualityReport=quality,
        extractionQuality=quality,
    )


def ensure_expected_questions(
    questions: list[ImportedQuestionDraft],
    expected_numbers: list[int],
    answer_key: dict[int, int],
    total_pages: int,
) -> tuple[list[ImportedQuestionDraft], list[int], list[int]]:
    by_number: dict[int, ImportedQuestionDraft] = {}
    duplicates: list[int] = []
    for question in questions:
        previous = by_number.get(question.number)
        if previous:
            duplicates.append(question.number)
            previous_score = score_question(previous)
            next_score = score_question(question)
            if next_score <= previous_score:
                continue
        by_number[question.number] = question
    placeholders: list[int] = []
    for number in expected_numbers:
        if number not in by_number:
            placeholders.append(number)
            by_number[number] = create_placeholder(number, answer_key, infer_probable_pages(number, by_number, total_pages, len(expected_numbers)))
    return [by_number[number] for number in sorted(by_number)], placeholders, sorted(set(duplicates))


def score_question(question: ImportedQuestionDraft) -> int:
    return int(bool(question.enunciado)) * 5 + len(question.options) * 2 + int(question.resposta > 0)


def infer_probable_pages(number: int, by_number: dict[int, ImportedQuestionDraft], total_pages: int, expected_count: int) -> list[int]:
    previous_pages = [q.sourcePage for q in by_number.values() if q.number < number and q.sourcePage]
    next_pages = [q.sourcePage for q in by_number.values() if q.number > number and q.sourcePage]
    if previous_pages and next_pages:
        start = max(previous_pages)
        end = min(next_pages)
        return list(range(max(1, start), min(total_pages, end) + 1))[:3]
    if expected_count > 0 and total_pages > 0:
        estimate = max(1, min(total_pages, round(number / expected_count * total_pages)))
        return sorted({page for page in [estimate - 1, estimate, estimate + 1] if 1 <= page <= total_pages})
    return []


def build_diagnostics(
    questions: list[ImportedQuestionDraft],
    expected_numbers: list[int],
    placeholders: list[int],
    duplicates: list[int],
    pages: list[PdfPageData],
) -> ImportDiagnostics:
    complete = [q.number for q in questions if q.extractionStatus == "ok"]
    localized = [q.number for q in questions if q.qualityReport.localized]
    incomplete = [q.number for q in questions if q.qualityReport.localized and q.extractionStatus != "ok"]
    extracted = [q.number for q in questions if q.qualityReport.origin != "placeholder"]
    missing = [q.number for q in questions if not q.qualityReport.localized]
    return ImportDiagnostics(
        expectedQuestionNumbers=expected_numbers,
        extractedQuestionNumbers=sorted(set(extracted)),
        localizedQuestionNumbers=sorted(set(localized)),
        completeQuestionNumbers=sorted(set(complete)),
        incompleteQuestionNumbers=sorted(set(incomplete)),
        missingQuestionNumbers=sorted(set(missing)),
        placeholderQuestionNumbers=sorted(set(placeholders)),
        duplicateQuestionNumbers=duplicates,
        cardsCreatedCount=len(questions),
        completeCardsCount=len(complete),
        incompleteCardsCount=len(incomplete),
        placeholderCardsCount=len(placeholders),
        pagesWithoutNativeText=[page.pageNumber for page in pages if page.nativeTextCoverage < 0.04],
        lowConfidencePages=[page.pageNumber for page in pages if page.layoutConfidence < 0.4],
    )


def answer_label(index: int | None) -> str:
    if index is None or index < 0 or index >= len("ABCDE"):
        return ""
    return "ABCDE"[index]


def as_list(value: Any) -> list[Any]:
    if value is None or value == "":
        return []
    if isinstance(value, list):
        return value
    return [value]


def model_to_dict(value: Any) -> dict[str, Any]:
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "dict"):
        return value.dict()
    return dict(value or {})


def build_filter_object(metadata: dict[str, Any], question: ImportedQuestionDraft) -> dict[str, Any]:
    return {
        "materia": as_list(question.assuntos),
        "topico": [],
        "assunto": as_list(question.assuntos),
        "banca": as_list(metadata.get("agency") or metadata.get("bank") or metadata.get("banca")),
        "orgao": as_list(metadata.get("source") or metadata.get("sources") or metadata.get("orgao") or metadata.get("orgaos")),
        "cargo_prova": as_list(metadata.get("roles") or metadata.get("cargos") or metadata.get("role") or metadata.get("cargo")),
        "ano": metadata.get("year") or metadata.get("ano") or "",
        "nivel": metadata.get("level") or metadata.get("nivel") or "",
        "modalidade": question.modality or question.questionType or "desconhecido",
        "dificuldade": question.dificuldade or 2,
    }


def build_review_object(
    questions: list[ImportedQuestionDraft],
    contexts: list[ImportedContextDraft],
    answer_key: dict[int, int],
    metadata: dict[str, Any],
    diagnostics: ImportDiagnostics,
) -> dict[str, Any]:
    temporary_context: dict[str, dict[str, Any]] = {}
    for context in contexts:
        title = context.title or context.tempId or "Contexto"
        key = title
        suffix = 2
        while key in temporary_context:
            key = f"{title} ({suffix})"
            suffix += 1
        temporary_context[key] = {
            "title": title,
            "value": context.text,
            "reference": context.referenceText,
            "questions": context.questionNumbers,
            "type": "figure" if context.hasFigure else "text",
            "page": context.sourcePage or context.page,
            "figureDescription": context.figureDescription,
        }

    return {
        "summary": {
            "expected": len(diagnostics.expectedQuestionNumbers),
            "cardsCreated": diagnostics.cardsCreatedCount,
            "complete": diagnostics.completeCardsCount,
            "incomplete": diagnostics.incompleteCardsCount,
            "placeholders": diagnostics.placeholderCardsCount,
            "missingContent": diagnostics.missingQuestionNumbers,
        },
        "questions": [
            {
                "number": question.number,
                "answer": answer_label(answer_key.get(question.number)),
                "answerIndex": answer_key.get(question.number),
                "enunciado": question.enunciado or question.text,
                "alternativas": [
                    {
                        "label": "ABCDE"[index] if index < len("ABCDE") else str(index + 1),
                        "text": option,
                    }
                    for index, option in enumerate(question.options)
                ],
                "temporaryContextKey": question.contextKey,
                "supportText": question.supportText,
                "referenceText": question.referenceText,
                "modalidade": question.modality,
                "status": question.extractionStatus,
                "quality": model_to_dict(question.qualityReport),
                "statusReasons": question.statusReasons,
                "filters": build_filter_object(metadata, question),
            }
            for question in questions
        ],
        "temporary_context": temporary_context,
    }


def extract_exam(exam_pdf: bytes, answer_key_pdf: bytes | None, metadata_json: str | None = None) -> ExtractionResponse:
    metadata: dict[str, Any] = {}
    if metadata_json:
        try:
            metadata = json.loads(metadata_json)
        except Exception:
            metadata = {}
    logs: list[str] = []
    pages = read_pdf_pages(exam_pdf)
    answer_key = parse_answer_key(answer_key_pdf)
    expected_numbers = parse_expected_numbers(metadata, answer_key)
    raw_questions = parse_questions(pages, expected_numbers)
    contexts = parse_contexts(pages)
    questions = [create_question(raw, answer_key, metadata) for raw in raw_questions]
    questions, placeholders, duplicates = ensure_expected_questions(questions, expected_numbers, answer_key, len(pages))
    diagnostics = build_diagnostics(questions, expected_numbers, placeholders, duplicates, pages)
    review_object = build_review_object(questions, contexts, answer_key, metadata, diagnostics)
    logs.append(f"Python extractor: {len(pages)} pagina(s) mapeada(s) com texto e geometria.")
    if answer_key:
        logs.append(f"Gabarito: {len(answer_key)} resposta(s) mapeada(s) mecanicamente; quantidade esperada travada em {len(expected_numbers)}.")
    if expected_numbers:
        logs.append(f"Revisao canonica: {len(questions)}/{len(expected_numbers)} card(s) criado(s).")
    if placeholders:
        logs.append(f"Pendentes editaveis criados: {', '.join(str(number) for number in placeholders[:40])}.")
    if diagnostics.pagesWithoutNativeText:
        logs.append(
            "Paginas sem texto nativo suficiente: "
            + ", ".join(str(page) for page in diagnostics.pagesWithoutNativeText)
            + ". OCR/IA visual pode complementar depois."
        )
    return ExtractionResponse(
        success=True,
        metadata=metadata,
        questions=questions,
        contexts=contexts,
        reviewObject=review_object,
        diagnostics=diagnostics,
        logs=logs,
        pages=pages,
    )
