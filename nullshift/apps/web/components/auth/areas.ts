/**
 * The two self-service sign-in surfaces (bespoke client portal at /portal,
 * product console at /app) share one set of forms. An AuthArea names the
 * copy and the routes; the forms themselves do not know which they are on.
 */
export type AuthArea = {
  /** Eyebrow label above the title. */
  eyebrow: string;
  /** Where a non-staff user lands after sign-in when no ?next= is given. */
  home: string;
  loginHref: string;
  signupHref: string;
  forgotHref: string;
  /** Sign-up link copy on the login page. */
  signupCta: string;
};

export const PORTAL_AREA: AuthArea = {
  eyebrow: "Client Portal",
  home: "/portal",
  loginHref: "/portal/login",
  signupHref: "/portal/signup",
  forgotHref: "/portal/forgot",
  signupCta: "New client? Create an account →",
};

export const APP_AREA: AuthArea = {
  eyebrow: "Nullshift Products",
  home: "/app",
  loginHref: "/app/login",
  signupHref: "/app/signup",
  forgotHref: "/app/forgot",
  signupCta: "New here? Start a free trial →",
};
