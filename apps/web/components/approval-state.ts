import type { AppSnapshot } from "@david/contracts";

// A persisted placeholder approval can remain pending after a mandate executes.
// Display only decisions that can still apply to an unsubmitted, current action;
// preserve the authoritative historical approval status in the detail view.
export function activeApprovals(
  state: Pick<AppSnapshot, "approvals" | "actions" | "workspace" | "asOf">,
) {
  const now =
    state.workspace.mode === "fixture" ? Date.parse(state.asOf) : Date.now();
  return state.approvals.filter((approval) => {
    const action = state.actions.find((item) => item.id === approval.actionId);
    return (
      approval.status === "pending" &&
      action?.status === "not_attempted" &&
      Date.parse(approval.expiresAt) > now &&
      Date.parse(action.expiresAt) > now
    );
  });
}
