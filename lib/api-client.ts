/**
 * Tiny fetch wrapper used by all client components. Every API route returns
 * { success: true, data } or { success: false, error }, so this normalizes
 * that shape and throws a plain Error with the server's message on failure.
 */

type ApiResult<T> = { success: true; data: T } | { success: false; error: string };

async function request<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    credentials: 'same-origin'
  });

  let json: ApiResult<T>;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Unexpected server response (status ${res.status}).`);
  }

  if (json.success === false) {
    throw new Error(json.error || 'Something went wrong.');
  }
  return json.data;
}

export const api = {
  get: <T = any>(url: string) => request<T>(url, { method: 'GET' }),
  post: <T = any>(url: string, body?: any) =>
    request<T>(url, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T = any>(url: string, body?: any) =>
    request<T>(url, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T = any>(url: string) => request<T>(url, { method: 'DELETE' })
};
