import { describe, expect, it } from "vitest";
import { appRouter } from "../router";

describe("M4.1B application router contract", () => {
  it("mounts every governed workplan, guidance, human-gate, task, evidence, audit, and reset procedure", () => {
    expect(Object.keys(appRouter._def.record.m41b)).toEqual(
      expect.arrayContaining([
        "getMyWorkplan",
        "getCadenceBrief",
        "askAmos",
        "recordHumanDisposition",
        "addCompletionEvidence",
        "completeTask",
        "escalateTask",
        "getAuditLineage",
        "resetEvaluation",
      ]),
    );
  });

  it("keeps the entire M4.1B namespace authenticated", async () => {
    const caller = appRouter.createCaller({
      req: new Request("http://localhost/trpc"),
      resHeaders: new Headers(),
    });
    await expect(caller.m41b.getMyWorkplan()).rejects.toThrow("Unauthorized");
    await expect(caller.m41b.getAuditLineage()).rejects.toThrow("Unauthorized");
    await expect(
      caller.m41b.askAmos({
        requestId: "SYNTH-M41B-UNAUTHORIZED",
        prompt: "Explain this governed item.",
        intent: "answer_question",
      }),
    ).rejects.toThrow("Unauthorized");
  });
});
