import { afterEach, describe, expect, it, vi } from "vitest";
import { activeApprovals } from "../apps/web/components/approval-state";
import { createFixtureState, executeCommand } from "../packages/domain/src/index";

afterEach(() => vi.restoreAllMocks());

describe("action decisions shown to the operator", () => {
  it("removes a completed mandate action without rewriting its pending placeholder", async () => {
    const state = createFixtureState();
    await executeCommand(state, { type: "draft", proposalId: state.proposals[0].id });
    expect(activeApprovals(state)).toHaveLength(1);
    state.actions[0].status = "confirmed";
    expect(activeApprovals(state)).toHaveLength(0);
    expect(state.approvals[0].status).toBe("pending");
    state.actions[0].status = "not_attempted";
    state.actions[0].expiresAt = state.asOf;
    expect(activeApprovals(state)).toHaveLength(0);
  });

  it("uses the synthetic clock only for fixture decisions", async () => {
    const state = createFixtureState();
    await executeCommand(state, { type: "draft", proposalId: state.proposals[0].id });
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2030-01-01T00:00:00Z"));
    expect(activeApprovals(state)).toHaveLength(1);
    state.workspace.mode = "live";
    expect(activeApprovals(state)).toHaveLength(0);
  });
});
