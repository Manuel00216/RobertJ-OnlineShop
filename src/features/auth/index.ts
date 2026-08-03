// UI foundation
export { AuthLayout } from "./components/layout/AuthLayout";
export { EditorialPanel } from "./components/layout/EditorialPanel";
export { AuthCard } from "./components/layout/AuthCard";
export { AuthHeader } from "./components/layout/AuthHeader";
export { AuthFooter } from "./components/layout/AuthFooter";
export { EmailInput } from "./components/fields/EmailInput";
export { PasswordInput } from "./components/fields/PasswordInput";
export { VerificationPending } from "./components/feedback/VerificationPending";
export { AuthSuccessState } from "./components/feedback/AuthSuccessState";
export { AuthButton } from "./components/AuthButton";
export { LoginForm } from "./components/forms/LoginForm";
export { RegisterForm } from "./components/forms/RegisterForm";
export { ForgotPasswordForm } from "./components/forms/ForgotPasswordForm";
export { ResetPasswordForm } from "./components/forms/ResetPasswordForm";

// Actions & schemas (already built, wired in the next phase)
export {
  signInAction,
  signUpAction,
  signOutAction,
  requestPasswordResetAction,
  updatePasswordAction,
  resendVerificationAction,
} from "./actions/auth.actions";
export {
  signInSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./schemas/auth.schema";
export type {
  SignInInput,
  SignUpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from "./schemas/auth.schema";
