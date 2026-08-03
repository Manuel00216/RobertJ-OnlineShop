"use client";

import { Mail } from "lucide-react";

import { FormField, type FormFieldProps } from "@/components/forms/FormField";
import { cn } from "@/lib/utils/cn";

import { AUTH_INPUT_CLASS } from "./field-classes";

/** Email field with the shared auth input shape (frozen spec §1/§3). */
export function EmailInput({ className, ...props }: Omit<FormFieldProps, "label" | "type" | "id">) {
  return (
    <FormField
      label="Email"
      type="email"
      autoComplete="email"
      tone="brand"
      icon={<Mail className="h-4 w-4" aria-hidden="true" />}
      className={cn(AUTH_INPUT_CLASS, "pl-11", className)}
      {...props}
    />
  );
}
