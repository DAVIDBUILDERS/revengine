import { authClient } from "../../../lib/auth";
import { apiError, HttpError, json } from "../../../lib/http";
import { environment } from "../../../../../packages/orchestration/src/environment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const env = environment();
    if (env.DAVID_MODE === "fixture")
      return json({
        mode: "fixture",
        workspaces: [
          { id: "david", name: "DAVID AI · illustrative workspace" },
          { id: "northstar", name: "northstar · illustrative workspace" },
        ],
        limited: false,
      });
    const client = await authClient();
    const { data: identity, error: identityError } =
      await client.auth.getClaims();
    if (identityError || !identity?.claims?.sub)
      throw new HttpError(
        401,
        "AUTH_REQUIRED",
        "Sign in to view your assigned workspaces.",
      );
    const { data: members, error: membershipError } = await client
      .from("memberships")
      .select("workspace_id,role")
      .eq("actor_id", identity.claims.sub)
      .eq("active", true)
      .limit(101);
    if (membershipError)
      throw new HttpError(
        503,
        "ASSIGNMENTS_UNAVAILABLE",
        "Workspace assignments could not be read. Retry or ask your workspace owner.",
      );
    const eligible = (members ?? []).filter(
      (member) =>
        member.role !== "david_operator" || identity.claims.aal === "aal2",
    );
    if (!eligible.length)
      return json({
        mode: env.DAVID_MODE,
        workspaces: [],
        limited: false,
        requiresOperatorMfa: !!members?.some(
          (member) => member.role === "david_operator",
        ),
      });
    const ids = [
      ...new Set(eligible.map((member) => String(member.workspace_id))),
    ].slice(0, 100);
    const { data: workspaces, error: workspaceError } = await client
      .from("workspaces")
      .select("id,name")
      .in("id", ids)
      .order("name")
      .limit(100);
    if (workspaceError)
      throw new HttpError(
        503,
        "WORKSPACES_UNAVAILABLE",
        "Assigned workspace details could not be read. Retry or ask your workspace owner.",
      );
    return json({
      mode: env.DAVID_MODE,
      workspaces: workspaces ?? [],
      limited: (members?.length ?? 0) > 100,
    });
  } catch (error) {
    return apiError(error);
  }
}
