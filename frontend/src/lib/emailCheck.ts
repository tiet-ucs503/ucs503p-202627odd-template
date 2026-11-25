// Email format check for the sign-in and sign-up forms. It mirrors the server's
// rule (backend/schemas.py), so most mistakes are caught before anything is sent:
// something@domain.tld, no spaces, exactly one @, a dot in the domain, at most 254 characters.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** null when the address looks valid, otherwise a short message saying what is wrong. */
export function emailProblem(raw: string): string | null {
  const email = raw.trim();
  if (!email) return 'Enter your email address.';
  if (email.length > 254) return 'That email address is too long.';
  if (/\s/.test(email)) return 'An email address cannot contain spaces.';
  if ((email.match(/@/g) ?? []).length !== 1) return 'An email address needs exactly one @.';
  if (!EMAIL_PATTERN.test(email)) return 'Enter a full email address, like name@example.com.';
  return null;
}
