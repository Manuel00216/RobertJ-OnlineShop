"use client";

import { Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";

import { FormField, type FormFieldProps } from "@/components/forms/FormField";
import { cn } from "@/lib/utils/cn";

import { AUTH_INPUT_CLASS } from "./field-classes";

export interface PasswordInputProps
  extends Omit<FormFieldProps, "label" | "type" | "id" | "icon" | "trailing"> {
  label?: string;
}

/**
 * Password field with a leading lock icon and an accessible visibility
 * toggle (44px hit area, dynamic `aria-label`, `type="button"` so it never
 * submits the form). Frozen spec §3/§4/§6.
 */
export function PasswordInput({ label = "Password", className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField
      label={label}
      type={visible ? "text" : "password"}
      tone="brand"
      icon={<Lock className="h-4 w-4" aria-hidden="true" />}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-rj-gray-400 transition-colors hover:text-rj-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      }
      className={cn(AUTH_INPUT_CLASS, "pl-11 pr-12", className)}
      {...props}
    />
  );
}
