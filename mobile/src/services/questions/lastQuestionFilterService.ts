import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QuestionListFilters } from "@/types/questions";

const STORAGE_KEY = "concursomestre.questions.last-applied-filter.v1";

export interface QuestionFilterSelection {
  palavraChave: string;
  bancas: string[];
  anos: string[];
  materias: string[];
  assuntos: string[];
  orgaos: string[];
  cargos: string[];
  focos: string[];
  niveis: string[];
  modalidades: string[];
  dificuldades: string[];
  apenasSalvas: boolean;
  comentarioProfessor: boolean;
  analiseDetalhada: boolean;
  excluirAnuladas: boolean;
  excluirDesatualizadas: boolean;
  naoRespondidas: boolean;
}

const listFields = [
  "bancas", "anos", "materias", "assuntos", "orgaos", "cargos", "focos",
  "niveis", "modalidades", "dificuldades",
] as const;
const booleanFields = [
  "apenasSalvas", "comentarioProfessor", "analiseDetalhada", "excluirAnuladas",
  "excluirDesatualizadas", "naoRespondidas",
] as const;

const isSelection = (value: unknown): value is QuestionFilterSelection => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.palavraChave === "string"
    && listFields.every((field) => Array.isArray(candidate[field])
      && (candidate[field] as unknown[]).every((item) => typeof item === "string"))
    && booleanFields.every((field) => typeof candidate[field] === "boolean");
};

export const getLastQuestionFilter = async (): Promise<QuestionFilterSelection | null> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return isSelection(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const saveLastQuestionFilter = async (selection: QuestionFilterSelection): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
};

export const toQuestionListFilters = (selection: QuestionFilterSelection): QuestionListFilters => ({
  keyword: selection.palavraChave.trim() || undefined,
  agency: selection.bancas.length ? selection.bancas : undefined,
  year: selection.anos.length ? selection.anos : undefined,
  subject: selection.materias.length ? selection.materias : undefined,
  topic: selection.assuntos.length ? selection.assuntos : undefined,
  organization: selection.orgaos.length ? selection.orgaos : undefined,
  role: selection.cargos.length ? selection.cargos : undefined,
  career: selection.focos.length ? selection.focos : undefined,
  level: selection.niveis.length ? selection.niveis : undefined,
  modality: selection.modalidades.length ? selection.modalidades : undefined,
  difficulty: selection.dificuldades.length
    ? selection.dificuldades.map((value) => value === "easy" ? "Facil" : value === "medium" ? "Medio" : "Dificil")
    : undefined,
  onlySaved: selection.apenasSalvas || undefined,
  hasTeacherComment: selection.comentarioProfessor || undefined,
  hasDetailedComment: selection.analiseDetalhada || undefined,
  excludeCanceled: selection.excluirAnuladas || undefined,
  excludeOutdated: selection.excluirDesatualizadas || undefined,
  excludeAnswered: selection.naoRespondidas || undefined,
});

export const toQuestionRouteParams = (selection: QuestionFilterSelection, questionId: string | number) => ({
  id: String(questionId),
  flow: "1",
  palavraChave: selection.palavraChave.trim(),
  bancas: selection.bancas.join(","),
  anos: selection.anos.join(","),
  materias: selection.materias.join(","),
  assuntos: selection.assuntos.join(","),
  orgaos: selection.orgaos.join(","),
  cargos: selection.cargos.join(","),
  focos: selection.focos.join(","),
  niveis: selection.niveis.join(","),
  modalidades: selection.modalidades.join(","),
  dificuldades: selection.dificuldades.join(","),
  apenasSalvas: selection.apenasSalvas ? "1" : "",
  comentarioProfessor: selection.comentarioProfessor ? "1" : "",
  analiseDetalhada: selection.analiseDetalhada ? "1" : "",
  excluirAnuladas: selection.excluirAnuladas ? "1" : "",
  excluirDesatualizadas: selection.excluirDesatualizadas ? "1" : "",
  naoRespondidas: selection.naoRespondidas ? "1" : "",
});
