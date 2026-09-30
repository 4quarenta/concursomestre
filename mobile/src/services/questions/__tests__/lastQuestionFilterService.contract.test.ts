import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { storage.set(key, value); }),
  },
}));

import {
  getLastQuestionFilter,
  saveLastQuestionFilter,
  toQuestionListFilters,
  toQuestionRouteParams,
  type QuestionFilterSelection,
} from "@/services/questions/lastQuestionFilterService";

const selection: QuestionFilterSelection = {
  palavraChave: "  constituição  ",
  bancas: ["CESPE", "FGV"],
  anos: ["2024"],
  materias: ["Direito Constitucional"],
  assuntos: ["Controle"],
  orgaos: ["TRF"],
  cargos: ["Analista"],
  focos: ["Judiciário"],
  niveis: ["Superior"],
  modalidades: ["Múltipla escolha"],
  dificuldades: ["easy", "hard"],
  apenasSalvas: false,
  comentarioProfessor: true,
  analiseDetalhada: false,
  excluirAnuladas: true,
  excluirDesatualizadas: false,
  naoRespondidas: true,
};

describe("last applied question filter", () => {
  beforeEach(() => storage.clear());

  it("returns null until a filter has been successfully saved", async () => {
    expect(await getLastQuestionFilter()).toBeNull();
  });

  it("persists and restores the complete applied selection", async () => {
    await saveLastQuestionFilter(selection);

    expect(await getLastQuestionFilter()).toEqual(selection);
  });

  it("maps the saved selection to the same API and question-route contracts", () => {
    expect(toQuestionListFilters(selection)).toMatchObject({
      keyword: "constituição",
      agency: ["CESPE", "FGV"],
      difficulty: ["Facil", "Dificil"],
      hasTeacherComment: true,
      excludeCanceled: true,
      excludeAnswered: true,
    });
    expect(toQuestionRouteParams(selection, 123)).toMatchObject({
      id: "123",
      flow: "1",
      palavraChave: "constituição",
      bancas: "CESPE,FGV",
      dificuldades: "easy,hard",
      comentarioProfessor: "1",
      naoRespondidas: "1",
    });
  });

  it("ignores malformed stored data instead of treating it as a valid filter", async () => {
    storage.set("concursomestre.questions.last-applied-filter.v1", "{bad json");

    expect(await getLastQuestionFilter()).toBeNull();
  });
});
