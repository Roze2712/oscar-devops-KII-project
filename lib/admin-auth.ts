/**
 * Admin allow-list.
 *
 * - `ALWAYS_ALLOWED_ADMIN_EMAILS` is the hardcoded baseline of admins that are
 *   permitted regardless of environment configuration.
 * - When `ADMIN_EMAILS` (comma-separated) is set, those emails are additionally
 *   permitted.
 * - When `ADMIN_EMAILS` is unset or empty, ONLY the hardcoded baseline is
 *   permitted. We never fall back to "any authenticated user" — that would
 *   silently expose /admin in misconfigured environments.
 */
const ALWAYS_ALLOWED_ADMIN_EMAILS = ["tina.hristova03@gmail.com"];

function parseAdminEmailsFromEnv(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | undefined | null): boolean {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  if (ALWAYS_ALLOWED_ADMIN_EMAILS.includes(normalizedEmail)) {
    return true;
  }

  const envAllowed = parseAdminEmailsFromEnv();
  return envAllowed.includes(normalizedEmail);
}

export function getEmailFromClaims(
  claims: Record<string, unknown> | null | undefined,
): string | undefined {
  const email = claims?.email;
  return typeof email === "string" ? email : undefined;
}
