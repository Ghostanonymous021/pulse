/** Phone helpers — product: phone-first, no SMS (sec. 7). */

const PHONE_EMAIL_DOMAIN = "users.pulse.app";

export function looksLikePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 9 && !value.includes("@");
}

export function looksLikeEmail(value: string) {
  return value.includes("@") && value.includes(".");
}

/** E.164-ish with Mozambique default (+258). */
export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (value.trim().startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.startsWith("258")) {
    return `+${digits}`;
  }
  return `+258${digits}`;
}

export function phoneDigits(value: string) {
  return normalizePhone(value).replace(/\D/g, "");
}

/**
 * Maps a phone number to the internal auth email.
 * Public phone provider is disabled on this project; we authenticate via
 * confirmed email under the hood while the product UX stays phone-first.
 */
export function phoneToAuthEmail(phone: string) {
  return `p${phoneDigits(phone)}@${PHONE_EMAIL_DOMAIN}`;
}

export function isSyntheticPhoneEmail(email: string | null | undefined) {
  if (!email) return false;
  return email.endsWith(`@${PHONE_EMAIL_DOMAIN}`);
}

export { suggestUsernameFromName as suggestUsername } from "@/lib/auth/username";
