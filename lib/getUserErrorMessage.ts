const TECHNICAL_ERROR = /(?:mongoose|mongodb|mongoerror|validationerror|casterror|axioserror|react query|stack trace|\bat\s+\w+\s*\(|ECONN|ENOTFOUND)/i;

const STATUS_MESSAGES: Record<number, string> = {
  401: "Your session has expired. Please sign in again.",
  403: "You do not have permission to perform this action.",
  404: "Requested information could not be found.",
  409: "This action has already been completed or is no longer available.",
  429: "Too many requests. Please try again shortly.",
  500: "Something went wrong. Please try again.",
};

export function getSafeUserMessage(value: unknown, fallback = "Something went wrong. Please try again."): string {
  if (typeof value !== "string") return fallback;
  const message = value.trim().slice(0, 240);
  return message && !TECHNICAL_ERROR.test(message) ? message : fallback;
}

function safeApiMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = "error" in payload ? (payload as { error?: unknown }).error : "message" in payload ? (payload as { message?: unknown }).message : null;
  if (typeof value !== "string") return null;
  const message = getSafeUserMessage(value, "");
  return message || null;
}

export function getUserResponseError(response: Pick<Response, "status">, payload?: unknown, fallback = "Something went wrong. Please try again."): string {
  if (response.status === 0) return "Unable to connect. Check your internet connection.";
  if (response.status === 400 || response.status === 422) return safeApiMessage(payload) || fallback;
  if (response.status === 409) return safeApiMessage(payload) || STATUS_MESSAGES[409];
  return STATUS_MESSAGES[response.status] || (response.status >= 500 ? STATUS_MESSAGES[500] : fallback);
}

export function getUserErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof TypeError) return "Unable to connect. Check your internet connection.";
  if (error instanceof Error) return getSafeUserMessage(error.message, fallback);
  return fallback;
}
