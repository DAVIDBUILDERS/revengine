import { z } from "zod";
import { Command } from "@david/contracts";
import { createFixtureState, executeCommand, snapshot, DEFAULT_PREVIEW_WORKSPACE, FIXTURE_WORKSPACE_KEYS, isFixtureWorkspace, type EngineState } from "@david/domain";
import type { WorkspaceDataSource } from "../../web/components/app-shell";

const Journal = z.object({ version: z.literal(1), commands: z.array(Command).max(300) }).strict();
const prefix = "revengine.browser-demo.v2.";
const maxBytes = 1_000_000;

// Inject storage for testing. No HTTP, database, provider, or filesystem access.
export function createBrowserDemo(storage: () => Storage): WorkspaceDataSource {
  const sessions = new Map<string, { state: EngineState; commands: Command[] }>();
  let pending: Promise<unknown> = Promise.resolve();
  function serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = pending.then(work);
    pending = result.catch(() => undefined);
    return result;
  }
  function keyFor(workspace: string | null) {
    const key = workspace ?? DEFAULT_PREVIEW_WORKSPACE;
    if (!isFixtureWorkspace(key)) throw new Error("Unknown workspace. Open the home page without a workspace parameter.");
    return key;
  }
  async function session(key: string) {
    const existing = sessions.get(key);
    if (existing) return existing;
    const raw = storage().getItem(prefix + key);
    if (raw && raw.length > maxBytes) throw new Error("Workspace history is too large. Clear this site's session storage to restart.");
    let commands: Command[];
    try { commands = raw ? Journal.parse(JSON.parse(raw)).commands : []; }
    catch { throw new Error("Workspace history could not be validated. Clear this site's session storage to restart."); }
    const state = createFixtureState(key);
    for (const command of commands) await executeCommand(state, command);
    const result = { state, commands };
    sessions.set(key, result);
    return result;
  }
  return {
    async list() {
      return { workspaces: [...FIXTURE_WORKSPACE_KEYS].map(id => ({ id, name: createFixtureState(id).workspace.name })) };
    },
    read(workspace) {
      return serialize(async () => structuredClone(snapshot((await session(keyFor(workspace))).state)));
    },
    execute(workspace, input) {
      return serialize(async () => {
        const key = keyFor(workspace);
        const current = await session(key);
        const command = Command.parse(input);
        const candidate = structuredClone(current.state);
        const result = await executeCommand(candidate, command);
        if (command.type === "import_csv" && command.preview) return result;
        const commands = command.type === "reset" ? [] : [...current.commands, command];
        if (commands.length > 300) throw new Error("Workspace history is full. Refresh this page to start again.");
        const encoded = JSON.stringify({ version: 1, commands });
        if (encoded.length > maxBytes) throw new Error("Workspace storage limit reached. Refresh this page before adding more work.");
        try { storage().setItem(prefix + key, encoded); }
        catch { throw new Error("This change was not saved: browser session storage is unavailable or full."); }
        sessions.set(key, { state: candidate, commands });
        return structuredClone(result);
      });
    },
  };
}

export const browserDemo = createBrowserDemo(() => window.sessionStorage);
