import type { ScenarioRequest, ScenarioResponse } from "./types";

// The only place the page talks to the R API. No financial calculation happens in TypeScript.

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * A request ID such as "lfl-3f9a0c12d4e5b678". crypto.getRandomValues works over plain HTTP on the LAN,
 * where crypto.randomUUID does not (it needs a secure context).
 */
export function newRequestId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `lfl-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(`APIの応答がJSONではありません（HTTP ${res.status}）`, res.status);
  }
}

export async function fetchScenario(
  request: ScenarioRequest,
  options: { baseUrl?: string; signal?: AbortSignal; requestId?: string } = {},
): Promise<ScenarioResponse> {
  const requestId = options.requestId ?? newRequestId();
  let res: Response;
  try {
    res = await fetch(`${options.baseUrl ?? ""}/api/scenario`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
      body: JSON.stringify(request),
      signal: options.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("R APIに接続できません。server/server.R を起動してください。", null);
  }
  const body = await readJson(res);
  if (!res.ok) {
    const message = typeof body === "object" && body !== null && "error" in body ? String(body.error) : res.statusText;
    throw new ApiError(message, res.status);
  }
  const data = body as ScenarioResponse;
  if (data.response?.request_id !== requestId) {
    throw new ApiError(`APIの応答が要求と対応していません（送信 ${requestId}、受信 ${data.response?.request_id}）`, res.status);
  }
  return data;
}
