import { describe, expect, it } from "vitest";
import { createBrowserDemo } from "../apps/preview/lib/browser-demo";

function storage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
}

describe("hosted browser demo isolation", () => {
  it("replays validated actions after reload and isolates workspaces and browsers", async () => {
    const tab = storage();
    const demo = createBrowserDemo(() => tab);
    await demo.execute(null, { type: "pause", paused: true });
    expect((await createBrowserDemo(() => tab).read(null)).workspace.paused).toBe(true);
    expect((await demo.read("northstar")).workspace.paused).toBe(false);
    expect((await createBrowserDemo(storage).read(null)).workspace.paused).toBe(false);
    await demo.execute("northstar", { type: "pause", paused: true });
    await demo.execute(null, { type: "reset" });
    expect((await createBrowserDemo(() => tab).read(null)).workspace.paused).toBe(false);
    expect((await demo.read("northstar")).workspace.paused).toBe(true);
  });

  it("rejects invalid history and unknown workspaces", async () => {
    const tab = storage();
    tab.setItem("revengine.browser-demo.v1.david", JSON.stringify({ version: 1, commands: [{ type: "pause", paused: true, role: "admin" }] }));
    const demo = createBrowserDemo(() => tab);
    await expect(demo.read(null)).rejects.toThrow("could not be validated");
    await expect(demo.read("customer-production")).rejects.toThrow("Unknown demo workspace");
  });

  it("does not commit a change when browser storage rejects it", async () => {
    const tab = storage();
    tab.setItem = () => { throw new Error("Quota exceeded"); };
    const demo = createBrowserDemo(() => tab);
    await expect(demo.execute(null, { type: "pause", paused: true })).rejects.toThrow("not saved");
    expect((await demo.read(null)).workspace.paused).toBe(false);
  });
});
