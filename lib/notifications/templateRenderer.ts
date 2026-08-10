/**
 * Safe `{{variable}}` interpolation for admin-authored templates (PRD 4B v2
 * sections 11/12/76). Deliberately NOT a real templating engine — plain
 * regex substitution only, so there is no way for admin-entered template
 * text to execute code. Every `{{token}}` found in the template MUST be
 * present in `data`, or the whole render is rejected — a template can never
 * silently send "Your order {{orderNumber}} is ready" with the placeholder
 * left in.
 */

const ALLOWED_VARIABLES = new Set([
  "firstName",
  "orderNumber",
  "orderAmount",
  "damruAmount",
  "couponCode",
  "discount",
  "expiryDate",
  "missionName",
  "achievementName",
  "loyaltyTier",
  "refundAmount",
]);

const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function extractTemplateVariables(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(TOKEN_PATTERN)) found.add(match[1]);
  return [...found];
}

export interface RenderResult {
  ok: boolean;
  text?: string;
  error?: string;
}

/**
 * `data` values are already-formatted strings/numbers the caller trusts —
 * this function does no HTML escaping of its own beyond plain substitution,
 * so callers must never pass raw, un-trusted user HTML through it (values
 * here always come from backend-computed reward/order/payment data, never
 * directly from another user's free-text input).
 */
export function renderTemplate(template: string, data: Record<string, string | number>): RenderResult {
  const tokens = extractTemplateVariables(template);

  const unknown = tokens.filter(t => !ALLOWED_VARIABLES.has(t));
  if (unknown.length > 0) {
    return { ok: false, error: `Unsupported template variable(s): ${unknown.join(", ")}` };
  }

  const missing = tokens.filter(t => data[t] === undefined || data[t] === null || data[t] === "");
  if (missing.length > 0) {
    return { ok: false, error: `Missing required value(s) for: ${missing.join(", ")}` };
  }

  const text = template.replace(TOKEN_PATTERN, (_m, name: string) => String(data[name]));
  return { ok: true, text };
}

export { ALLOWED_VARIABLES };
