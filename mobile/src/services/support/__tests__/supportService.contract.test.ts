import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock("@/api/client", () => ({ apiClient: mocks }));

import { supportService } from "@/services/support/supportService";

describe("support service contract", () => {
  beforeEach(() => mocks.post.mockReset());

  it("opens an authenticated support thread with the web feedback contract", async () => {
    mocks.post.mockResolvedValue({
      success: true,
      message: "Atendimento aberto com sucesso.",
      data: { id: 42, type: "support" },
    });

    const result = await supportService.createSupportRequest({
      subject: "Dúvida sobre renovação",
      details: "Gostaria de entender a data da próxima cobrança.",
    });

    expect(mocks.post).toHaveBeenCalledWith("feedback/create.php", {
      type: "support",
      reason: "Dúvida sobre renovação",
      details: "Gostaria de entender a data da próxima cobrança.",
      gamification_event: "support_feedback_submitted",
      notification_event: "support_opened",
    });
    expect(result.message).toBe("Atendimento aberto com sucesso.");
  });
});
