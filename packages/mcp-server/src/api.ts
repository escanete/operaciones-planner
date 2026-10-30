export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly data?: unknown;

  constructor(status: number, message: string, code?: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export interface ApiClientOptions {
  apiUrl: string;
  cookie?: string;
}

type Query = Record<string, string | number | boolean | undefined | null>;

function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export class ApiClient {
  private readonly apiUrl: string;
  private readonly cookie?: string;

  constructor(options: ApiClientOptions) {
    this.apiUrl = options.apiUrl.replace(/\/+$/, "");
    this.cookie = options.cookie;
  }

  async request<T = any>(
    method: string,
    path: string,
    options: { body?: unknown; query?: Query; timeoutMs?: number } = {}
  ): Promise<T> {
    const url = `${this.apiUrl}${path}${buildQuery(options.query)}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "operaciones-planner-mcp/1.0.0",
    };
    if (this.cookie) headers.Cookie = this.cookie;
    if (method !== "GET") headers.Origin = this.apiUrl;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ApiError(
        0,
        `No se pudo conectar con ${this.apiUrl}. Verifica que el servidor esté encendido y la URL sea correcta. (${reason})`
      );
    }

    const text = await response.text();
    let data: unknown = undefined;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      const payload = (data ?? {}) as Record<string, unknown>;
      const message =
        (typeof payload.error === "string" && payload.error) ||
        (typeof payload.message === "string" && payload.message) ||
        `Error HTTP ${response.status}`;
      const code = typeof payload.code === "string" ? payload.code : undefined;
      throw new ApiError(response.status, message, code, data);
    }

    return data as T;
  }

  get<T = any>(path: string, query?: Query): Promise<T> {
    return this.request<T>("GET", path, { query });
  }

  post<T = any>(path: string, body?: unknown, query?: Query): Promise<T> {
    return this.request<T>("POST", path, { body, query });
  }

  put<T = any>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, { body });
  }

  patch<T = any>(path: string, body?: unknown, query?: Query): Promise<T> {
    return this.request<T>("PATCH", path, { body, query });
  }

  delete<T = any>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}
