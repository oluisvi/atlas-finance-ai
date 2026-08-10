const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

export type ApiErrorBody = { statusCode: number; code: string; message: string | string[]; method?: string; path?: string; requestId?: string; timestamp?: string };
export class ApiError extends Error {
  constructor(public status: number, public body: ApiErrorBody) {
    super(Array.isArray(body.message) ? body.message.join(" ") : body.message);
    this.name = "ApiError";
  }
}

type Tokens = { accessToken: string; refreshToken: string };
let tokens: Tokens | null = null;
let refreshPromise: Promise<boolean> | null = null;

export const session = {
  get: () => tokens,
  set: (next: Tokens | null) => {
    tokens = next;
    if (typeof window !== "undefined") {
      if (next) sessionStorage.setItem("atlas.session", JSON.stringify(next));
      else sessionStorage.removeItem("atlas.session");
    }
  },
  hydrate: () => {
    if (typeof window !== "undefined" && !tokens) {
      try { tokens = JSON.parse(sessionStorage.getItem("atlas.session") ?? "null") as Tokens | null; }
      catch { tokens = null; }
    }
    return tokens;
  },
};

async function refresh() {
  if (refreshPromise) return refreshPromise;
  const current = session.hydrate();
  if (!current?.refreshToken) return false;
  refreshPromise = fetch(`${API_URL}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: current.refreshToken }) })
    .then(async (response) => { if (!response.ok) throw new Error(); const data = await response.json() as { tokens: Tokens }; session.set(data.tokens); return true; })
    .catch(() => { session.set(null); return false; })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export type RequestOptions = { method?: string; body?: unknown; query?: Record<string, string | number | boolean | undefined>; auth?: boolean; raw?: boolean };
export async function api<T = unknown>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const current = session.hydrate();
  const query = new URLSearchParams(Object.entries(options.query ?? {}).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  const headers: Record<string, string> = { "X-Request-Id": crypto.randomUUID() };
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) body = options.body;
  else if (options.body !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(options.body); }
  if (options.auth !== false && current?.accessToken) headers.Authorization = `Bearer ${current.accessToken}`;

  let response: Response;
  try { response = await fetch(`${API_URL}${path}${query.size ? `?${query}` : ""}`, { method: options.method ?? "GET", headers, body, cache: "no-store" }); }
  catch { throw new ApiError(0, { statusCode: 0, code: "NETWORK_ERROR", message: "Não foi possível conectar ao Atlas." }); }

  if (response.status === 401 && options.auth !== false && !retried && await refresh()) return api<T>(path, options, true);
  if (!response.ok) {
    let error: ApiErrorBody;
    try { error = await response.json() as ApiErrorBody; }
    catch { error = { statusCode: response.status, code: "HTTP_ERROR", message: response.status === 429 ? "Muitas tentativas. Aguarde um momento e tente novamente." : "Não foi possível concluir a operação." }; }
    throw new ApiError(response.status, error);
  }
  if (options.raw) return response as T;
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function downloadReport(type: string, format: string, query: Record<string, string> = {}) {
  const response = await api<Response>(`/exports/reports/${type}`, { query: { ...query, format }, raw: true });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `atlas-${type}.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}
