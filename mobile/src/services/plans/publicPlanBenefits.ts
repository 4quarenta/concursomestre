import type {
  MobilePlanEntitlements,
  MobilePlanName,
  MobilePlanUsageLimits,
} from "@/types/system";
import type { Plan, PlanFeature } from "@/types/plans";
import { resolveCanonicalPlanKey } from "@/services/plans/planDetails";

const PUBLIC_BENEFITS: Array<[string, string]> = [
  ["module.practice", "Prática de questões"],
  ["question.resolve", "Resolver questões"],
  ["teacher_comments", "Comentário do professor"],
  ["question.detailed_analysis", "Análise detalhada"],
  ["question.full_statistics", "Estatísticas completas"],
  ["question.save", "Salvar questões"],
  ["module.lei_comentada", "Lei comentada"],
  ["lei.comentario_basico", "Comentários na lei"],
  ["lei.doutrina", "Doutrina na lei comentada"],
  ["lei.macete", "Macetes na lei comentada"],
  ["lei.jurisprudencia", "Jurisprudência e súmulas"],
  ["lei.sumulas", "Súmulas relacionadas"],
  ["lei.questoes", "Questões da lei comentada"],
  ["lei.modo_foco", "Modo foco na lei"],
  ["lei.favoritos", "Favoritar leis e seções"],
  ["module.simulations", "Simulados"],
  ["exclusive_simulations", "Simulados exclusivos"],
  ["module.xray", "Raio-X da banca"],
  ["module.dashboard", "Dashboard premium"],
  ["no_ads", "Sem anúncios"],
  ["mentor_chat", "Chat mentor"],
  ["priority_support", "Suporte prioritário"],
  ["early_access", "Acesso antecipado"],
];

const isEnabled = (
  entitlements: Record<string, boolean | { enabled?: boolean }>,
  key: string,
) => {
  const value = entitlements[key];
  return typeof value === "boolean" ? value : value?.enabled === true;
};

const formatUsageLimit = (
  limit: { mode: "limited" | "unlimited"; value: number | null } | undefined,
  unlimitedLabel: string,
  limitedLabel: (count: number) => string,
): string | null => {
  if (!limit) return null;
  if (limit.mode === "unlimited") return unlimitedLabel;
  const count = Math.max(0, Number(limit.value || 0));
  return count > 0 ? limitedLabel(count) : null;
};

/**
 * Keeps mobile plan cards on the same admin-managed entitlement matrix used
 * by the web plans and checkout screens. API plan.features is only a fallback
 * for older settings payloads that do not yet include the public matrix.
 */
export const getPublicPlanBenefits = (
  plan: Plan,
  entitlements: MobilePlanEntitlements,
  usageLimits: MobilePlanUsageLimits,
): PlanFeature[] => {
  const canonical = resolveCanonicalPlanKey(plan.name) as MobilePlanName | null;
  const matrix = canonical ? entitlements[canonical] : undefined;
  const limits = canonical ? usageLimits[canonical] : undefined;

  if (!matrix) {
    return Array.isArray(plan.features)
      ? plan.features.filter((feature) => feature.included).slice(0, 4)
      : [];
  }

  const features: PlanFeature[] = [];
  const add = (text: string | null) => {
    if (text && !features.some((feature) => feature.text === text)) {
      features.push({ text, included: true });
    }
  };

  add(formatUsageLimit(
    limits?.questions_per_day,
    "Questões ilimitadas",
    (count) => count + " questões por dia",
  ));
  add(formatUsageLimit(
    limits?.simulations_per_month,
    "Simulados ilimitados",
    (count) => count + " simulado" + (count === 1 ? "" : "s") + " por mês",
  ));
  add(isEnabled(matrix, "teacher_comments") || isEnabled(matrix, "question.teacher_comments")
    ? "Comentário do professor"
    : null);
  add(isEnabled(matrix, "question.detailed_analysis") || isEnabled(matrix, "detailed_analysis")
    ? "Análise detalhada"
    : null);
  add(isEnabled(matrix, "question.full_statistics") ? "Estatísticas completas" : null);
  add(isEnabled(matrix, "module.lei_comentada") ? "Lei comentada" : null);
  add(isEnabled(matrix, "lei.doutrina") ? "Doutrina, súmulas e jurisprudência" : null);
  add(formatUsageLimit(
    limits?.saved_questions_limit,
    "Questões salvas ilimitadas",
    (count) => count + " questões salvas",
  ));
  add(isEnabled(matrix, "no_ads") ? "Sem anúncios" : null);
  add(isEnabled(matrix, "module.xray") || isEnabled(matrix, "xray_banca")
    ? "Raio-X da banca"
    : null);
  add(isEnabled(matrix, "module.dashboard") ? "Dashboard premium" : null);
  add(isEnabled(matrix, "priority_support") ? "Suporte prioritário" : null);
  add(isEnabled(matrix, "early_access") ? "Novas funcionalidades primeiro" : null);

  const commercialTexts = new Set(features.map((feature) => feature.text));
  PUBLIC_BENEFITS.forEach(([key, text]) => {
    if (isEnabled(matrix, key) && !commercialTexts.has(text)) add(text);
  });

  return (features.length > 0
    ? features
    : [{ text: "Recursos essenciais do plano", included: true }]
  ).slice(0, 4);
};
