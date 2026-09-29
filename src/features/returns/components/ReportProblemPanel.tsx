"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { RJ_CARD } from "@/components/ui/card";
import { ErrorState } from "@/components/feedback/ErrorState";
import { requestReturnAction } from "@/features/returns/actions/return.actions";
import { cn } from "@/lib/utils/cn";
import type { ActionResult } from "@/types/action.types";

export interface ReportProblemPanelProps {
  orderId: string;
  /** Shown when this panel is presented as one of two side-by-side choices (paired with `ConfirmReceivedButton`) rather than the only option on the page. */
  onCancel?: () => void;
}

const ISSUE_OPTIONS = [
  { value: "non_delivery", label: "Non-delivery" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "damaged_item", label: "Damaged item" },
  { value: "missing_item", label: "Missing item" },
  { value: "other", label: "Other" },
] as const;

type IssueValue = (typeof ISSUE_OPTIONS)[number]["value"];

/** Mirrors `requestReturnSchema`'s `reason` cap (`return.schema.ts`) — the
 * composed string below must never exceed it, or a maxed-out "Other"
 * description combined with several checked issues would fail server-side
 * validation after the buyer already submitted. */
const REASON_MAX_LENGTH = 500;
const DETAILS_PREFIX = "Details: ";

/**
 * Buyer's "something's wrong" path — the counterpart to
 * `ConfirmReceivedButton`'s "everything arrived as expected" path. Replaces
 * the old single free-text `RequestReturnPanel` with a checkbox issue list;
 * submits through the exact same `requestReturnAction`/`request_return` RPC
 * as before (no schema/backend change) by composing the checked issues (plus
 * the "Other" detail, if given) into that action's existing `reason` field.
 * Filing this creates a `return_requests` row your seller (then an admin, if
 * escalated) must resolve — the order is not treated as done in the
 * meantime.
 */
export function ReportProblemPanel({ orderId, onCancel }: ReportProblemPanelProps) {
  const [state, formAction, isPending] = useActionState<
    ActionResult<null> | null,
    FormData
  >(requestReturnAction, null);

  const [selected, setSelected] = useState<Set<IssueValue>>(new Set());
  const [otherText, setOtherText] = useState("");

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;
  const formError = state && !state.success && !state.fieldErrors ? state.error : undefined;

  const otherChecked = selected.has("other");
  const canSubmit = selected.size > 0 && (!otherChecked || otherText.trim().length > 0);

  function toggle(value: IssueValue, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(value);
      else next.delete(value);
      return next;
    });
  }

  const issueLabels = ISSUE_OPTIONS.filter(
    (option) => option.value !== "other" && selected.has(option.value),
  ).map((option) => option.label);
  const issuesPrefix = issueLabels.length > 0 ? `Reported issues: ${issueLabels.join(", ")}.` : "";

  // Budget left for the "Other" description once the issue-list prefix (and
  // the space joining it to "Details: ") is accounted for, so the composed
  // reason below can never exceed REASON_MAX_LENGTH regardless of how many
  // boxes are checked.
  const otherOverhead = (issuesPrefix ? issuesPrefix.length + 1 : 0) + DETAILS_PREFIX.length;
  const maxOtherLength = Math.max(0, REASON_MAX_LENGTH - otherOverhead);

  function composeReason(): string {
    const parts: string[] = [];
    if (issuesPrefix) parts.push(issuesPrefix);
    const trimmedOther = otherText.trim().slice(0, maxOtherLength);
    if (otherChecked && trimmedOther) parts.push(`${DETAILS_PREFIX}${trimmedOther}`);
    return parts.join(" ");
  }

  return (
    <section aria-label="Report a problem with this order" className={cn(RJ_CARD, "p-5")}>
      <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-rj-gray-600">
        Report a Problem
      </h2>
      <p className="mt-1 text-xs text-rj-gray-600">
        Select every issue that applies. Your seller will review it first; if they
        can&apos;t resolve it, an administrator will step in.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-3" aria-busy={isPending}>
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="reason" value={composeReason()} />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ISSUE_OPTIONS.map((option) => {
            const checked = selected.has(option.value);
            return (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-md border p-3 text-sm font-medium transition-colors",
                  checked ? "border-rj-black bg-rj-gray-50" : "border-rj-gray-200",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => toggle(option.value, event.target.checked)}
                  className="h-4 w-4 shrink-0 accent-rj-red"
                />
                {option.label}
              </label>
            );
          })}
        </div>
        {fieldErrors?.reason ? (
          <p role="alert" className="text-xs text-rj-red-dark">
            {fieldErrors.reason[0]}
          </p>
        ) : null}

        {otherChecked ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="other-detail" className="text-sm font-medium text-rj-black">
              Describe the problem
            </label>
            <textarea
              id="other-detail"
              value={otherText}
              onChange={(event) => setOtherText(event.target.value)}
              required
              maxLength={maxOtherLength}
              rows={3}
              className="rounded-md border border-rj-gray-200 bg-rj-white px-3 py-2 text-sm text-rj-black outline-none transition-colors focus-visible:border-rj-black focus-visible:ring-2 focus-visible:ring-rj-red/30"
              placeholder="Tell us specifically what happened…"
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="evidence" className="text-sm font-medium text-rj-black">
            Evidence photo (optional)
          </label>
          <input
            id="evidence"
            name="evidence"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm text-rj-gray-600 file:mr-3 file:rounded-full file:border-0 file:bg-rj-black file:px-4 file:py-2 file:text-xs file:font-bold file:text-rj-white"
          />
          {fieldErrors?.evidence ? (
            <p role="alert" className="text-xs text-rj-red-dark">
              {fieldErrors.evidence[0]}
            </p>
          ) : null}
        </div>

        {formError ? (
          <ErrorState title="Couldn't submit your report" message={formError} />
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            variant="rj"
            size="rjSm"
            isLoading={isPending}
            disabled={!canSubmit}
          >
            {isPending ? "Submitting…" : "Submit report"}
          </Button>
          {onCancel ? (
            <Button type="button" variant="rjOutline" size="rjSm" onClick={onCancel} disabled={isPending}>
              Cancel
            </Button>
          ) : null}
        </div>
        {!canSubmit ? (
          <p className="text-xs text-rj-gray-500">
            {selected.size === 0
              ? "Select at least one issue."
              : "Describe the problem before submitting."}
          </p>
        ) : null}
      </form>
    </section>
  );
}
