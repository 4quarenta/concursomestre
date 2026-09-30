import { describe, expect, it } from "vitest";
import { getPublicPlanBenefits } from "@/services/plans/publicPlanBenefits";
import type { Plan } from "@/types/plans";

const plan = (name: string): Plan => ({
  id: 17,
  name,
  description: "",
  price: 49.9,
  interval_count: 1,
  interval_unit: "month",
});

describe("getPublicPlanBenefits", () => {
  it("uses admin entitlements and usage limits instead of catalog feature text", () => {
    const result = getPublicPlanBenefits(
      {
        ...plan("Pro - Mensal"),
        features: [{ text: "Benefício legado", included: true }],
      },
      {
        Pro: {
          teacher_comments: { enabled: true },
          "question.detailed_analysis": { enabled: true },
          "module.practice": { enabled: true },
        },
      },
      {
        Pro: {
          questions_per_day: { mode: "unlimited", value: null },
          simulations_per_month: { mode: "limited", value: 3 },
          saved_questions_limit: { mode: "limited", value: 120 },
        },
      },
    );

    expect(result.map((feature) => feature.text)).toEqual([
      "Questões ilimitadas",
      "3 simulados por mês",
      "Comentário do professor",
      "Análise detalhada",
    ]);
  });

  it("does not show disabled admin benefits", () => {
    const result = getPublicPlanBenefits(
      plan("Elite"),
      {
        Elite: {
          teacher_comments: { enabled: false },
          "module.dashboard": { enabled: true },
        },
      },
      {},
    );

    expect(result.map((feature) => feature.text)).toEqual([
      "Dashboard premium",
    ]);
  });

  it("uses API benefits only when the admin matrix is absent", () => {
    const result = getPublicPlanBenefits(
      {
        ...plan("Elite"),
        features: [
          { text: "Configured benefit", included: true },
          { text: "Disabled benefit", included: false },
        ],
      },
      {},
      {},
    );

    expect(result.map((feature) => feature.text)).toEqual([
      "Configured benefit",
    ]);
  });
});
