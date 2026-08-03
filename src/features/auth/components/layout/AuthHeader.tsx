import type { ReactNode } from "react";

import { Wordmark } from "@/components/brand/Wordmark";

export interface AuthHeaderProps {
  /** Small kicker, shown only below `lg:` (the desktop left panel owns it there). */
  eyebrow?: string;
  title: string;
  description?: string;
  /** e.g. the Login↔Register cross-link, placed directly under the headline. */
  switchLink?: ReactNode;
}

/**
 * Card headline + subtext + optional switch-mode link (frozen spec §3/§7).
 * The wordmark renders here on mobile/tablet and is hidden on desktop, where
 * the editorial panel already shows it.
 */
export function AuthHeader({ eyebrow, title, description, switchLink }: AuthHeaderProps) {
  return (
    <header className="flex flex-col gap-2">
      <Wordmark className="mb-1 lg:hidden" />
      {eyebrow ? (
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red-dark">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-serif text-[28px] leading-[1.1] text-rj-black md:text-[32px]">
        {title}
      </h2>
      {description ? <p className="text-sm text-rj-gray-600">{description}</p> : null}
      {switchLink ? <div className="mt-1.5">{switchLink}</div> : null}
    </header>
  );
}
