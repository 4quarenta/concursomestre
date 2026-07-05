from __future__ import annotations

import unittest

from app.extractor import create_question, ensure_expected_questions, extract_exam
from app.extractor import RawQuestion


def make_pdf(lines: list[str]) -> bytes:
    import fitz

    document = fitz.open()
    page = document.new_page(width=595, height=842)
    y = 72
    for line in lines:
        page.insert_text((72, y), line, fontsize=11)
        y += 18
    data = document.tobytes()
    document.close()
    return data


FITZ_AVAILABLE = True
try:
    import fitz  # noqa: F401
except ModuleNotFoundError:
    FITZ_AVAILABLE = False


class ExtractorContractTest(unittest.TestCase):
    def test_ensure_expected_questions_creates_placeholders(self) -> None:
        extracted = create_question(
            RawQuestion(
                number=1,
                text="Enunciado da questao 1",
                options=["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
                page=1,
                box=None,
            ),
            answer_key={1: 0, 2: 1, 3: 2},
            metadata={},
        )

        questions, placeholders, duplicates = ensure_expected_questions(
            questions=[extracted],
            expected_numbers=[1, 2, 3],
            answer_key={1: 0, 2: 1, 3: 2},
            total_pages=2,
        )

        self.assertEqual([question.number for question in questions], [1, 2, 3])
        self.assertEqual(placeholders, [2, 3])
        self.assertEqual(duplicates, [])
        self.assertEqual(questions[1].qualityReport.origin, "placeholder")
        self.assertIn("questao_placeholder_criada", questions[1].statusReasons)
        self.assertEqual(questions[1].resposta, 2)

    @unittest.skipUnless(FITZ_AVAILABLE, "PyMuPDF nao esta instalado neste runtime de teste")
    def test_extract_exam_keeps_all_expected_cards_from_answer_key(self) -> None:
        exam_pdf = make_pdf(
            [
                "Questao 1",
                "Enunciado da questao 1",
                "A) Alternativa A",
                "B) Alternativa B",
                "C) Alternativa C",
                "D) Alternativa D",
            ]
        )
        answer_key_pdf = make_pdf(["1 A", "2 B", "3 C"])

        result = extract_exam(exam_pdf, answer_key_pdf, None)

        self.assertEqual(result.diagnostics.expectedQuestionNumbers, [1, 2, 3])
        self.assertEqual(result.diagnostics.cardsCreatedCount, 3)
        self.assertEqual(result.diagnostics.placeholderQuestionNumbers, [2, 3])
        self.assertEqual([question.number for question in result.questions], [1, 2, 3])
        self.assertEqual(result.questions[0].qualityReport.origin, "mechanical")
        self.assertEqual(result.questions[1].qualityReport.origin, "placeholder")


if __name__ == "__main__":
    unittest.main()
