// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useStore, type BootstrapPayload } from "./store";
import { startSync, useSyncStatus } from "./sync";
import { buildSeed } from "./seed";
import { SETTINGS } from "@/test/fixtures";

interface Body {
  upserts?: Record<string, Record<string, unknown>[]>;
  deletes?: Record<string, string[]>;
  settings?: { hoursPerDay: number };
}

const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
const ok = async () => ({ ok: true, status: 200 }) as Response;
const bodies = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body as string) as Body);
const state = () => useStore.getState();
const status = () => useSyncStatus.getState();

function bootstrap(): BootstrapPayload {
  const seed = buildSeed(new Date("2026-03-16T12:00:00.000Z"));
  return {
    session: { accountId: "acc_1", accountEmail: "ada@example.com", memberId: seed.currentUserId, workspaceId: "ws_1", workspaceName: "Test", workspaces: [] },
    data: {
      settings: SETTINGS,
      users: seed.users,
      clients: seed.clients,
      tags: seed.tags,
      projects: seed.projects,
      sprints: seed.sprints,
      issues: seed.issues,
      timeEntries: seed.timeEntries,
      offers: seed.offers,
      allocations: seed.allocations,
      holidays: seed.holidays,
      timeOffs: seed.timeOffs,
    },
  };
}

/** Let the debounce (500 ms) and the request settle. */
const settle = () => vi.advanceTimersByTimeAsync(1000);

beforeAll(() => {
  vi.stubGlobal("fetch", fetchMock);
  startSync();
});

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  fetchMock.mockImplementation(ok);
  state().applyBootstrap(bootstrap());
});

afterEach(async () => {
  await vi.runAllTimersAsync();
  vi.useRealTimers();
});

describe("sync", () => {
  it("does not echo a remote load back to the server", async () => {
    state().applyBootstrap(bootstrap());
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(status().pending).toBe(0);
  });

  it("pushes only the entity that changed", async () => {
    const target = state().issues[0];
    state().updateIssue(target.id, { summary: "Renamed" });
    expect(status().status).toBe("saving");
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/sync");
    expect(init.method).toBe("POST");
    const [body] = bodies();
    expect(Object.keys(body.upserts ?? {})).toEqual(["issues"]);
    expect(body.upserts?.issues).toHaveLength(1);
    expect(body.upserts?.issues?.[0]).toMatchObject({ id: target.id, summary: "Renamed" });
    expect(Object.keys(body.deletes ?? {})).toEqual([]);
    expect(body.settings).toBeUndefined();
    expect(status()).toMatchObject({ status: "saved", pending: 0 });
  });

  it("batches quick successive changes and sends the latest version of an entity", async () => {
    const [a, b] = state().issues;
    const client = state().clients[0];
    const linked = state().projects.filter((p) => p.clientId === client.id);
    state().updateIssue(a.id, { summary: "one" });
    state().updateIssue(a.id, { summary: "two" });
    state().updateIssue(b.id, { priority: "high" });
    state().deleteClient(client.id);
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [body] = bodies();
    expect(body.upserts?.issues?.map((i) => i.id).sort()).toEqual([a.id, b.id].sort());
    expect(body.upserts?.issues?.find((i) => i.id === a.id)?.summary).toBe("two");
    expect(body.upserts?.projects?.map((p) => p.id).sort()).toEqual(linked.map((p) => p.id).sort());
    expect(body.deletes).toEqual({ clients: [client.id] });
  });

  it("collapses a create followed by a delete into the delete alone", async () => {
    const tag = state().createTag("temporary");
    state().deleteTag(tag.id);
    await settle();

    const [body] = bodies();
    expect(body.upserts?.tags).toBeUndefined();
    expect(body.upserts?.timeEntries).toBeUndefined();
    expect(body.deletes).toEqual({ tags: [tag.id] });
  });

  it("sends settings changes with the batch", async () => {
    state().updateSettings({ hoursPerDay: 7 });
    await settle();
    expect(bodies()[0].settings?.hoursPerDay).toBe(7);
    expect(status().status).toBe("saved");
  });

  it("requeues the batch and retries when the request fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("boom"));
    const target = state().issues[0];
    state().updateIssue(target.id, { summary: "Retry me" });
    await vi.advanceTimersByTimeAsync(600);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(status().status).toBe("error");
    expect(status().lastError).toContain("boom");
    expect(status().pending).toBeGreaterThan(0);

    await vi.advanceTimersByTimeAsync(6000);
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    const last = bodies().at(-1)!;
    expect(last.upserts?.issues?.[0]).toMatchObject({ id: target.id, summary: "Retry me" });
    expect(status()).toMatchObject({ status: "saved", pending: 0 });
  });
});
