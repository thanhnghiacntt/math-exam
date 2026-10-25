const TOKEN_KEY = 'token';

export const tokenStore = {
  get(): string | null {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(v: string | null) {
    try { if (v) localStorage.setItem(TOKEN_KEY, v); else localStorage.removeItem(TOKEN_KEY); } catch { /* bỏ qua */ }
  },
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Gọi khi gặp 401 (được AuthProvider gán) */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<T>(path: string, method: Method = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  const res = await fetch('/api' + path, { method, headers, body: payload });
  let data: unknown = null;
  try { data = await res.json(); } catch { /* không phải JSON */ }
  const err = (data as { error?: string } | null)?.error;
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    tokenStore.set(null);
    onUnauthorized();
  }
  if (!res.ok) throw new ApiError(err || `Lỗi ${res.status}`, res.status);
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, b?: unknown) => request<T>(p, 'POST', b ?? {}),
  put: <T>(p: string, b?: unknown) => request<T>(p, 'PUT', b ?? {}),
  patch: <T>(p: string, b?: unknown) => request<T>(p, 'PATCH', b ?? {}),
  del: <T>(p: string) => request<T>(p, 'DELETE'),
  upload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ url: string; width: number; height: number }>('/admin/uploads', 'POST', fd);
  },
};

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
