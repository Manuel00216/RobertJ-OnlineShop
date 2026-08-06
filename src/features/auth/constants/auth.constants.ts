/**
 * Authentication screen copy (frozen UI/UX spec v1.0). Kept out of components
 * so a copy change is not a component change — same pattern as
 * `features/landing/constants`.
 */
export const AUTH_COPY = {
  signIn: {
    cardTitle: "Sign In",
    registerPromptPrefix: "New here?",
    registerPromptLink: "Create an account",
    forgotPassword: "Forgot password?",
    emailPlaceholder: "you@example.com",
    submitLabel: "Sign In",
  },
  signUp: {
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
    cardTitle: "Reset Your Password",
    cardDescription:
      "Enter the email associated with your account and we'll send a reset link.",
    backToSignIn: "Back to Sign In",
    emailPlaceholder: "you@example.com",
    submitLabel: "Send Reset Link",
  },
  resetPassword: {
    cardTitle: "Set a New Password",
    cardDescription: "Choose a strong password you have not used before.",
    newPasswordLabel: "New Password",
    confirmPasswordLabel: "Confirm New Password",
    passwordHint: "Must be at least 8 characters",
    submitLabel: "Update Password",
  },
} as const;
