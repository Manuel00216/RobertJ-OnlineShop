import Image from "next/image";

import { CalloutBubble } from "./CalloutBubble";

export interface EditorialPanelProps {
  imageSrc?: string;
}

const DEFAULT_IMAGE_SRC = "/landing/editorial-banner.jpg";

/** Evergreen trust copy, shared with `SiteFooter.tsx`'s `TRUST_BADGES`. */
const CALLOUTS = ["Verified Sellers", "Buyer Protected", "Secure Payments"];

/**
 * Desktop-only photo block: a contained (not full-bleed/full-height) square
 * lifestyle image with floating trust-badge callouts, matching the reference
 * sign-in layout's inset photo treatment.
 */
export function EditorialPanel({ imageSrc = DEFAULT_IMAGE_SRC }: EditorialPanelProps) {
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-3xl">
      <Image src={imageSrc} alt="" fill priority sizes="58vw" className="object-cover" />
      <CalloutBubble label={CALLOUTS[0]} className="absolute left-6 top-[16%]" />
      <CalloutBubble label={CALLOUTS[1]} className="absolute right-6 top-[46%]" />
      <CalloutBubble label={CALLOUTS[2]} className="absolute bottom-[12%] left-8" />
    </div>
  );
}
