/** Password rules (NIST SP 800-63B length-first + short blocklist). */

export const PASSWORD_MIN_LENGTH = 10;

const COMMON = new Set(
  [
    "password",
    "password1",
    "password12",
    "password123",
    "12345678",
    "123456789",
    "1234567890",
    "qwerty123",
    "qwertyuiop",
    "abc123456",
    "1111111111",
    "0000000000",
    "iloveyou12",
    "admin12345",
    "letmein123",
    "welcome123",
    "mozambiqu1",
    "unisave123",
    "pulse12345",
  ].map((s) => s.toLowerCase()),
);

/**
 * Returns null if acceptable; otherwise a short Portuguese error message.
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Minimo ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (password.length > 128) {
    return "Senha demasiado longa.";
  }
  if (COMMON.has(password.toLowerCase())) {
    return "Essa senha e demasiado comum.";
  }
  // Reject only-digits short-ish passwords
  if (/^\d+$/.test(password) && password.length < 12) {
    return "Evita senhas so com numeros.";
  }
  return null;
}
