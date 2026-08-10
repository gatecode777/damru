import { API_URL } from "@/config";
import type { ApiError } from "@/types";

export class ApiRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Options = Omit<RequestInit, "body"> & { body?: unknown; timeoutMs?: number };

const DEFAULT_TIMEOUT_MS = 15000;

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: callerSignal, ...rest } = options;
  const hasJsonBody = rest.body !== undefined && !(rest.body instanceof FormData);

  // Respect a caller-provided signal as-is; otherwise enforce our own timeout so a
  // hung request can't block a screen indefinitely.
  const timeoutController = callerSignal ? null : new AbortController();
  const timeoutId = timeoutController
    ? setTimeout(() => timeoutController.abort(), timeoutMs)
    : null;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      credentials: "include",
      signal: callerSignal ?? timeoutController?.signal,
      headers: {
        Accept: "application/json",
        ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
        ...rest.headers,
      },
      body: hasJsonBody ? JSON.stringify(rest.body) : (rest.body as BodyInit | undefined),
    });
  } catch (err) {
    if (timeoutController?.signal.aborted) {
      throw new ApiRequestError("Request timed out. Please check your connection.", 0);
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

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
