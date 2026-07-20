/**
 * Structured security event log (stdout JSON for platform log drains).
 * Never log passwords, tokens, or full PII.
 */

export type SecurityEvent =
  | "signup_rate_limited"
  | "signup_failed"
  | "signup_ok"
  | "username_check_rate_limited"
  | "verification_pay_blocked"
  | "verification_pay_simulated"
  | "verification_pay_unavailable"
  | "delete_account_ok"
  | "delete_account_failed"
  | "delete_account_bad_password"
  | "origin_rejected"
  | "ssrf_blocked"
  | "link_preview_rate_limited"
  | "chat_link_preview_rate_limited";

export function securityLog(
  event: SecurityEvent,
  fields: Record<string, string | number | boolean | null | undefined> = {},
) {
  const line = JSON.stringify({
    level: "security",
    event,
    ts: new Date().toISOString(),
    ...fields,
  });
  console.info(line);
}
