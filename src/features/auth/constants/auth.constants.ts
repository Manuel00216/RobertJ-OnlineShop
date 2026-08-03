/**
 * Authentication screen copy (frozen UI/UX spec v1.0). Kept out of components
 * so a copy change is not a component change — same pattern as
 * `features/landing/constants`.
 *
 * Editorial headlines are brand phrases composed in the pages (they carry the
 * `<em>` emphasis); everything else lives here.
 */
export const AUTH_COPY = {
  signIn: {
    eyebrow: "WELCOME BACK",
    supporting: "Sign in to pick up where you left off.",
    cardTitle: "Sign In",
    registerPromptPrefix: "New here?",
    registerPromptLink: "Create an account",
    forgotPassword: "Forgot password?",
    emailPlaceholder: "you@example.com",
    submitLabel: "Sign In",
  },
  signUp: {
    eyebrow: "JOIN THE MARKETPLACE",
    supporting: "Create your account to shop 120+ verified sellers.",
    cardTitle: "Create Account",
    signInPromptPrefix: "Already a member?",
    signInPromptLink: "Sign in",
    fullNamePlaceholder: "Juan Dela Cruz",
    confirmPasswordLabel: "Confirm Password",
    passwordHint: "Must be at least 8 characters",
    termsPrefix: "By continuing, you agree to our",
    termsLink: "Terms",
    privacyLink: "Privacy Policy",
    submitLabel: "Create Account",
  },
  forgotPassword: {
    eyebrow: "ACCOUNT RECOVERY",
    supporting: "No worries — we'll send you a reset link.",
    cardTitle: "Reset Your Password",
    cardDescription:
      "Enter the email associated with your account and we'll send a reset link.",
    backToSignIn: "Back to Sign In",
    emailPlaceholder: "you@example.com",
    submitLabel: "Send Reset Link",
  },
  resetPassword: {
    eyebrow: "SECURE YOUR ACCOUNT",
    supporting: "Set a new password to get back into RobertJ.",
    cardTitle: "Set a New Password",
    cardDescription: "Choose a strong password you have not used before.",
    newPasswordLabel: "New Password",
    confirmPasswordLabel: "Confirm New Password",
    passwordHint: "Must be at least 8 characters",
    submitLabel: "Update Password",
  },
} as const;
