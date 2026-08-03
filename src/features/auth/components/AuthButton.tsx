import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * Auth CTA convenience wrapper. Defaults to the RobertJ `rj` primary pill and
 * full width (auth buttons are card-constrained on every breakpoint — spec §8);
 * pass `variant`/`size`/`className` to override (e.g. `rjOutline` + `rjSm`).
 */
export function AuthButton({
  variant = "rj",
  size = "rj",
  className,
  ...props
}: ButtonProps) {
  return <Button variant={variant} size={size} className={cn("w-full", className)} {...props} />;
}
