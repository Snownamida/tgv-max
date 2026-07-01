import { describe, expect, it } from "vitest";
import { SncfApiClient } from "@/data/SncfApiClient";

const BASE = "https://ex/datasets/tgvmax";
const ok = (body: unknown): Response =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

describe("SncfApiClient.buildUrl", () => {
  it("encodes query params and targets /records", () => {
    const client = new SncfApiClient(async () => ok({}), BASE);
    const url = new URL(
      client.buildUrl('origine="PARIS (intramuros)"', {
        select: "date",
        orderBy: "date",
        limit: 50,
      }),
    );
    expect(url.pathname.endsWith("/records")).toBe(true);
    expect(url.searchParams.get("where")).toBe('origine="PARIS (intramuros)"');
    expect(url.searchParams.get("select")).toBe("date");
    expect(url.searchParams.get("order_by")).toBe("date");
    expect(url.searchParams.get("limit")).toBe("50");
  });

  it("defaults limit to 100 and omits absent options", () => {
    const client = new SncfApiClient(async () => ok({}), BASE);
    const url = new URL(client.buildUrl("x=1"));
    expect(url.searchParams.get("limit")).toBe("100");
    expect(url.searchParams.has("group_by")).toBe(false);
    expect(url.searchParams.has("offset")).toBe(false);
  });
});

describe("SncfApiClient.all", () => {
  it("paginates until a short page and forwards offsets", async () => {
    const pages = [
      { total_count: 130, results: Array.from({ length: 100 }, (_, i) => i) },
      { total_count: 130, results: Array.from({ length: 30 }, (_, i) => 100 + i) },
    ];
    const calls: string[] = [];
    let page = 0;
    const client = new SncfApiClient(async (input) => {
      calls.push(String(input));
      return ok(pages[page++]);
    }, BASE);

    const rows = await client.all<number>("x=1");
    expect(rows).toHaveLength(130);
    expect(calls).toHaveLength(2);
    expect(new URL(calls[0]).searchParams.get("offset")).toBeNull();
    expect(new URL(calls[1]).searchParams.get("offset")).toBe("100");
  });
});

describe("SncfApiClient error handling", () => {
  it("throws with the HTTP status", async () => {
    const client = new SncfApiClient(
      async () => ({ ok: false, status: 500 }) as unknown as Response,
      BASE,
    );
    await expect(client.records("x=1")).rejects.toThrow("SNCF API 500");
  });
});
