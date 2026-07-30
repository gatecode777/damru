import { API_URL } from "@/config";
import type { ApiError } from "@/types";

export class ApiRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Options = Omit<RequestInit, "body"> & { body?: unknown };

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const hasJsonBody = options.body !== undefined && !(options.body instanceof FormData);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    body: hasJsonBody ? JSON.stringify(options.body) : (options.body as BodyInit | undefined),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const error = payload as ApiError;
    throw new ApiRequestError(error.error ?? error.message ?? "Something went wrong.", response.status);
  }
  return payload as T;
}

export const get = <T>(path: string) => api<T>(path);
export const publicGet = <T>(path: string) => api<T>(path, { credentials: 'omit' });
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body });
export const patch = <T>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body });
export const del = <T>(path: string, body?: unknown) => api<T>(path, { method: 'DELETE', body });
