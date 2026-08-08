/** Privacy-safe display helpers for referred-user identity in referral history. */

export function maskName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 1) return `${trimmed}***`;
  return `${trimmed[0]}***${trimmed[trimmed.length - 1]}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}
