"use client";

import Image from "next/image";
import { useState } from "react";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getInitials } from "@/lib/utils/format";

export interface AvatarPreviewProps {
  /** Live (not-yet-saved) value of the avatar URL field. */
  url: string;
  /** Used for the initials fallback. */
  name: string;
}

/**
 * Live preview of a pasted avatar URL, debounced so it doesn't re-fetch on
 * every keystroke, with a graceful initials fallback when the field is empty
 * or the image fails to load (invalid URL, 404, etc).
 */
export function AvatarPreview({ url, name }: AvatarPreviewProps) {
  const debouncedUrl = useDebouncedValue(url.trim(), 400);
  // Keyed by the debounced URL so a new value remounts a fresh `Thumb` — that
  // naturally resets `failed` for the new URL instead of resetting it via an
  // effect (which would set state synchronously mid-effect).
  return <Thumb key={debouncedUrl} url={debouncedUrl} name={name} />;
}

function Thumb({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = url.length > 0 && !failed;

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rj-black text-sm font-bold text-rj-white">
        {showImage ? (
          <Image
            src={url}
            alt=""
            width={56}
            height={56}
            unoptimized
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <span aria-hidden="true">{getInitials(name) || "?"}</span>
        )}
      </div>
      <p className="text-xs text-rj-gray-600">
        {showImage
          ? "Preview"
          : "No image yet — your initials will show instead."}
      </p>
    </div>
  );
}
