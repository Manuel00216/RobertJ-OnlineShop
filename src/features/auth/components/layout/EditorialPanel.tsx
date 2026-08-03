import type { ReactNode } from "react";

import { Wordmark } from "@/components/brand/Wordmark";

export interface EditorialPanelProps {
  eyebrow: string;
  title: ReactNode;
  description?: string;
}

/**
 * Desktop-only left panel (frozen spec §2.1). Mirrors `Hero.tsx`'s
 * editorial column: `bg-rj-black`, ambient red glow, serif display headline.
 * Hidden below `lg:` — mobile/tablet use the card's own `AuthHeader`.
 */
export function EditorialPanel({ eyebrow, title, description }: EditorialPanelProps) {
  return (
    <aside className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-rj-black p-10 text-rj-white lg:flex">
      <Wordmark onDark />

      <div className="relative z-10 flex flex-col gap-4 py-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-200">
          {eyebrow}
        </p>
        <h2 className="max-w-md font-serif text-[clamp(2.5rem,5vw,4rem)] leading-[1.05] text-rj-white">
          {title}
        </h2>
        {description ? <p className="max-w-sm text-sm text-rj-gray-400">{description}</p> : null}
      </div>

      <div
        className="pointer-events-none absolute bottom-0 left-0 h-72 w-72 rounded-full bg-rj-red/10 blur-[120px]"
        aria-hidden="true"
      />
    </aside>
  );
}
