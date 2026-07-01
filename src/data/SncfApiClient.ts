import { TGVMAX_DATASET } from "@/config";
import type { DatasetMeta, RecordsResponse } from "./dto";

/** A `fetch`-compatible function (injectable for testing). */
export type FetchFn = typeof fetch;

export interface RecordsQuery {
  select?: string;
  groupBy?: string;
  orderBy?: string;
  limit?: number;
  offset?: number;
}

/**
 * Thin, typed client over the OpenDataSoft Explore v2.1 API.
 * `fetch` is injected so the query-building and pagination logic is unit-testable.
 */
export class SncfApiClient {
  constructor(
    // Wrapped so the global `fetch` keeps its `window` binding when stored on `this`.
    private readonly fetchFn: FetchFn = (input, init) => fetch(input, init),
    private readonly base: string = TGVMAX_DATASET,
  ) {}

  /** Build the records URL for a `where` clause and query options (pure). */
  buildUrl(where: string, q: RecordsQuery = {}): string {
    const p = new URLSearchParams();
    p.set("where", where);
    if (q.select) p.set("select", q.select);
    if (q.groupBy) p.set("group_by", q.groupBy);
    if (q.orderBy) p.set("order_by", q.orderBy);
    p.set("limit", String(q.limit ?? 100));
    if (q.offset) p.set("offset", String(q.offset));
    return `${this.base}/records?${p.toString()}`;
  }

  async records<T>(where: string, q: RecordsQuery = {}): Promise<RecordsResponse<T>> {
    const res = await this.fetchFn(this.buildUrl(where, q));
    if (!res.ok) throw new Error(`SNCF API ${res.status}`);
    return (await res.json()) as RecordsResponse<T>;
  }

  /** Fetch every row for a query, paginating in pages of 100 up to `cap`. */
  async all<T>(where: string, q: RecordsQuery = {}, cap = 2000): Promise<T[]> {
    const out: T[] = [];
    const limit = 100;
    for (let offset = 0; offset < cap; offset += limit) {
      const { results } = await this.records<T>(where, { ...q, limit, offset });
      out.push(...results);
      if (results.length < limit) break;
    }
    return out;
  }

  /** Dataset metadata (used for the last-refresh timestamp). */
  async datasetMeta(): Promise<DatasetMeta> {
    const res = await this.fetchFn(this.base);
    if (!res.ok) throw new Error(`SNCF API ${res.status}`);
    return (await res.json()) as DatasetMeta;
  }
}
