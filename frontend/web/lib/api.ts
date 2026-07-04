// The one typed client. Talks ONLY to the ExileLab API (NEXT_PUBLIC_API_URL,
// default http://localhost:3001). No external hosts anywhere — compliance
// charter §7.5. Importers accept pasted/local payloads only; this client never
// fetches a build from Maxroll / poe.ninja / GGG etc.

import type {
  BuildDetailResponse,
  DoctorReport,
  Goal,
  GoalsResponse,
  ImportResponse,
  PromoteResponse,
  ScoreConstraints,
  TuneResponse,
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
};
