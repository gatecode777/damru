type ErrorPayload = { error?: unknown; message?: unknown };

const STATUS_MESSAGES: Record<number, string> = {
  400: "Please check the information and try again.",
  401: "Your session has expired. Please sign in again.",
  403: "You don't have permission to perform this action.",
  404: "The requested resource was not found.",
  409: "This action conflicts with an existing or already processed record.",
  429: "Too many requests. Please try again later.",
  500: "Something went wrong. Please try again.",
};

function safeMessage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const message = value.trim();
  if (!message || /Mongo|Mongoose|CastError|AxiosError|ECONN|RazorpayError|stack|BSON|duplicate key/i.test(message)) return undefined;
  return message.length <= 180 ? message : undefined;
}

export function getAdminErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof Response) return STATUS_MESSAGES[error.status] || fallback;
  if (error && typeof error === "object") {
    const candidate = error as ErrorPayload & { status?: number; response?: { status?: number; data?: ErrorPayload } };
    const status = candidate.status ?? candidate.response?.status;
    if (status === 401 || status === 403 || status === 404 || status === 429 || (status && status >= 500)) {
      return STATUS_MESSAGES[status] || fallback;
    }
    const message = safeMessage(candidate.response?.data?.error) ?? safeMessage(candidate.response?.data?.message)
      ?? safeMessage(candidate.error) ?? safeMessage(candidate.message);
    if (message) return message;
    if (status) return STATUS_MESSAGES[status] || fallback;
  }
  return fallback;
}

export async function getAdminResponseError(response: Response, fallback: string): Promise<string> {
  let payload: ErrorPayload = {};
  try { payload = await response.clone().json() as ErrorPayload; } catch { /* non-JSON response */ }
  if ([401, 403, 404, 429].includes(response.status) || response.status >= 500) {
    return STATUS_MESSAGES[response.status] || fallback;
  }
  return safeMessage(payload.error) ?? safeMessage(payload.message) ?? STATUS_MESSAGES[response.status] ?? fallback;
}
