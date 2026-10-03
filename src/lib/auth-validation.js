const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!value) return false;
  return EMAIL_REGEX.test(value);
}

export const AUTH_MESSAGES = {
  emailRequired: "Please enter valid email",
  passwordRequired: "Please enter valid password",
  emailAndPasswordRequired: "Please enter Email and Password",
};
