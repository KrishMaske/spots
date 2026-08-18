// Lightweight client-side validators. The server is authoritative — these
// exist to give fast feedback before a round-trip, not to replace backend
// validation.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export interface PasswordPolicyResult {
  valid: boolean;
  minLength: boolean;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

/**
 * Mirrors the Cognito user pool PasswordPolicy in
 * backend/deploy/aws/cognito-user-pool.yml: min 12 chars, >=1 lowercase,
 * >=1 uppercase, >=1 number, >=1 symbol.
 */
export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  const minLength = password.length >= 12;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  return {
    valid: minLength && hasLowercase && hasUppercase && hasNumber && hasSymbol,
    minLength,
    hasLowercase,
    hasUppercase,
    hasNumber,
    hasSymbol,
  };
}

export function passwordsMatch(password: string, confirmPassword: string): boolean {
  return password.length > 0 && password === confirmPassword;
}
