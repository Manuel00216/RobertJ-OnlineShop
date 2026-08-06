import { FacebookIcon, GoogleIcon } from "./icons";
import { SocialButton } from "./SocialButton";

/** Stacked Google/Facebook options — see `SocialButton` for why they're disabled. */
export function SocialLoginButtons() {
  return (
    <div className="flex flex-col gap-3">
      <SocialButton icon={<GoogleIcon />} label="Continue with Google" />
      <SocialButton icon={<FacebookIcon />} label="Continue with Facebook" />
    </div>
  );
}
