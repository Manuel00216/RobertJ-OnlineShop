"use client";

import Image from "next/image";
import { useRef, useState, useTransition, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  removeAvatarAction,
  uploadAvatarAction,
} from "@/features/account/actions/account.actions";
import { getInitials } from "@/lib/utils/format";

const IMAGE_INPUT_ACCEPT = "image/jpeg,image/png";

export interface AvatarUploaderProps {
  /** Current, real, persisted avatar URL — null when none is set yet. */
  currentUrl: string | null;
  /** Used only for the initials fallback and the image's alt text. */
  name: string;
}

/**
 * Profile-picture upload — a real Supabase Storage upload (`avatars`
 * bucket), replacing the previous "paste a hosted image URL" field. Mirrors
 * `ShopImageUploader`'s logo mode (hidden file input, immediate upload, no
 * crop needed for a circular avatar) but saves independently of the rest of
 * `ProfileForm` — same as Shopee's own profile screen, where the photo
 * picker and the form's Save button are separate actions.
 */
export function AvatarUploader({ currentUrl, name }: AvatarUploaderProps) {
  const [url, setUrl] = useState(currentUrl);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("image", file);
      const result = await uploadAvatarAction(formData);
      if (result.success) {
        setUrl(result.data);
      } else {
        setError(result.error);
      }
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeAvatarAction();
      if (result.success) {
        setUrl(null);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rj-black text-xl font-bold text-rj-white">
        {url ? (
          <Image
            src={url}
            alt={name}
            width={96}
            height={96}
            unoptimized
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-hidden="true">{getInitials(name) || "?"}</span>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          variant="rjOutline"
          size="rjSm"
          isLoading={isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {url ? "Change photo" : "Upload photo"}
        </Button>
        {url ? (
          <Button
            type="button"
            variant="ghost"
            size="rjSm"
            isLoading={isPending}
            onClick={handleRemove}
          >
            Remove
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-rj-gray-600">JPEG or PNG, up to 1MB.</p>
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_INPUT_ACCEPT}
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
