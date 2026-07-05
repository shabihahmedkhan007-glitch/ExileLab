// The one typed client. Talks ONLY to the ExileLab API (NEXT_PUBLIC_API_URL,
// default http://localhost:3001). No external hosts anywhere — compliance
// charter §7.5. Importers accept pasted/local payloads only; this client never
// fetches a build from Maxroll / poe.ninja / GGG etc.

import type {
  AxisWeights,
  BuildDetailResponse,
  CompareImportResponse,
  CompareResponse,
  CreateReportResponse,
  DoctorReport,
  Goal,
  GoalsResponse,
  ImportResponse,
  ItemSwapResponse,
  PromoteResponse,
  ReportKind,
  ReportResponse,
  ScoreConstraints,
  TuneResponse,
  UpgradesResponse,
  WastedResponse,
} from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        ...(json !== undefined ? { "content-type": "application/json" } : {}),
        ...(rest.headers ?? {}),
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      0,
      `Can't reach the ExileLab engine at ${API_URL}. Is the API running?`,
    );
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* keep default */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export const api = {
  importBuild(input: string): Promise<ImportResponse> {
    return request<ImportResponse>("/import", {
      method: "POST",
      json: { input },
    });
  },

  getBuild(id: string): Promise<BuildDetailResponse> {
    return request<BuildDetailResponse>(`/builds/${encodeURIComponent(id)}`);
  },

  tuneByPreset(id: string, presetId: string): Promise<TuneResponse> {
    return request<TuneResponse>(`/builds/${encodeURIComponent(id)}/tune`, {
      method: "POST",
      json: { presetId },
    });
  },

  tuneByWeights(
    id: string,
    weights: Record<string, number>,
    constraints?: ScoreConstraints,
  ): Promise<TuneResponse> {
    return request<TuneResponse>(`/builds/${encodeURIComponent(id)}/tune`, {
      method: "POST",
      json: constraints ? { weights, constraints } : { weights },
    });
  },

  promote(id: string, mutationId: string): Promise<PromoteResponse> {
    return request<PromoteResponse>(
      `/builds/${encodeURIComponent(id)}/promote`,
      { method: "POST", json: { mutationId } },
    );
  },

  doctor(id: string, goal: Goal, tier?: number): Promise<DoctorReport> {
    const q = new URLSearchParams({ goal });
    if (tier !== undefined) q.set("tier", String(tier));
    return request<DoctorReport>(
      `/builds/${encodeURIComponent(id)}/doctor?${q.toString()}`,
    );
  },

  goals(): Promise<GoalsResponse> {
    return request<GoalsResponse>("/goals");
  },

  // -- Compare (UX §4.4) ----------------------------------------------------
  // Import the pasted "other" build (any format), then diff + re-score BOTH
  // under the USER'S weights (the pivot's thesis row). No external fetch: the
  // other build is a pasted payload, never scraped (charter §7.5).

  compareImport(id: string, input: string): Promise<CompareImportResponse> {
    return request<CompareImportResponse>(
      `/builds/${encodeURIComponent(id)}/compare/import`,
      { method: "POST", json: { input } },
    );
  },

  compare(
    id: string,
    withBuildId: string,
    presetId?: string,
    weights?: Record<string, number>,
  ): Promise<CompareResponse> {
    // Custom slider weights ride the POST form (Law 1 — the thesis row is scored
    // under the user's LIVE weights, never a silent preset fallback).
    if (weights !== undefined && !presetId) {
      return request<CompareResponse>(`/builds/${encodeURIComponent(id)}/compare`, {
        method: "POST",
        json: { with: withBuildId, weights },
      });
    }
    const q = new URLSearchParams({ with: withBuildId });
    if (presetId) q.set("presetId", presetId);
    return request<CompareResponse>(
      `/builds/${encodeURIComponent(id)}/compare?${q.toString()}`,
    );
  },

  // -- Upgrades (UX §4.5) ---------------------------------------------------
  // Ranked by score-per-Divine; a 503 ApiError means the kill-switched price
  // layer is off — the caller renders a calm empty state, never invents prices.

  upgrades(
    id: string,
    opts: {
      budgetDivines: number;
      presetId?: string;
      weights?: Partial<AxisWeights>;
    },
  ): Promise<UpgradesResponse> {
    return request<UpgradesResponse>(
      `/builds/${encodeURIComponent(id)}/upgrades`,
      { method: "POST", json: opts },
    );
  },

  // -- Item swap (OPT-3) ----------------------------------------------------
  // 422 ApiError on unparseable text (a typed error, never a wrong swap).

  itemSwap(id: string, itemText: string): Promise<ItemSwapResponse> {
    return request<ItemSwapResponse>(
      `/builds/${encodeURIComponent(id)}/itemswap`,
      { method: "POST", json: { itemText } },
    );
  },

  // -- Wasted-stat finder (OPT-1) -------------------------------------------
  // Severity weighted by the active preset's axis weights.

  wasted(id: string, presetId?: string): Promise<WastedResponse> {
    const q = presetId
      ? `?${new URLSearchParams({ presetId }).toString()}`
      : "";
    return request<WastedResponse>(
      `/builds/${encodeURIComponent(id)}/wasted${q}`,
    );
  },

  // -- Frozen shared reports (/r/{id}) --------------------------------------
  // Freeze a result into an immutable, shareable snapshot, then read it back
  // by id. The read path powers the statically-renderable /r/{id} page; no
  // auth (the permalink IS the capability — UX §2.1 permalink reports).

  createReport(
    buildId: string,
    kind: ReportKind,
    payload: unknown,
  ): Promise<CreateReportResponse> {
    return request<CreateReportResponse>("/reports", {
      method: "POST",
      json: { buildId, kind, payload },
    });
  },

  getReport(reportId: string): Promise<ReportResponse> {
    return request<ReportResponse>(
      `/reports/${encodeURIComponent(reportId)}`,
    );
  },
};
