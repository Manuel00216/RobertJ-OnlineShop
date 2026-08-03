/**
 * Auth route group. Each page composes `AuthLayout` directly (passing its own
 * editorial copy), so this layout is a pass-through: the root layout provides
 * fonts, and `AuthLayout` provides the responsive split shell. Exists so the
 * group is explicit and future auth-wide concerns have a home.
 */
export default function AuthRouteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
