"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { MessageSquare, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MessageThreadBody } from "@/features/messages/components/MessageThreadBody";
import type { OrderMessageView } from "@/features/messages/types/message.types";

export interface ContactSellerDockProps {
  orderId: string;
  messages: OrderMessageView[];
  /** Shop name shown in the panel header (the buyer never sees individual staff names). */
  shopName: string | null;
  orderNumber: string;
  /** e.g. "Delivered" / "Shipped" — the order's current status label. */
  statusLabel: string;
  /** e.g. "1 item". */
  itemSummary: string;
  /** Pre-formatted order total, e.g. "₱685.00". */
  totalLabel: string;
  /** First item's image, or null for a placeholder. */
  thumbnailUrl: string | null;
}

/**
 * Buyer-facing "Contact Seller" control: a trigger button (rendered in-flow,
 * meant to sit above the E-invoice action) that toggles a chat panel docked at
 * the bottom-right of the viewport. The panel shows an order-context card, the
 * conversation, and a composer. One shared `MessageThreadBody` powers both this
 * dock and the seller's inline thread.
 */
export function ContactSellerDock({
  orderId,
  messages,
  shopName,
  orderNumber,
  statusLabel,
  itemSummary,
  totalLabel,
  thumbnailUrl,
}: ContactSellerDockProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  return (
    <>
      <Button
        type="button"
        variant="rjOutline"
        size="rjSm"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Contact Seller
        {messages.length > 0 ? (
          <span className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rj-red px-1 text-[10px] font-bold text-rj-white">
            {messages.length}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-labelledby={titleId}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          className="fixed bottom-4 right-4 z-50 flex h-[32rem] max-h-[calc(100vh-2rem)] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-rj-gray-200 bg-rj-white shadow-xl"
        >
          <div className="flex items-center justify-between gap-2 bg-rj-red px-4 py-3 text-rj-white">
            <div className="flex min-w-0 items-center gap-2">
              <MessageSquare className="h-4 w-4 shrink-0" aria-hidden="true" />
              <p id={titleId} className="truncate text-sm font-bold">
                {shopName ?? "Seller"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded p-1 transition-colors hover:bg-white/20"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-3 border-b border-rj-gray-100 bg-rj-gray-50 px-4 py-3">
            {thumbnailUrl ? (
              <Image
                src={thumbnailUrl}
                alt=""
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="h-11 w-11 shrink-0 rounded bg-rj-gray-200" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-rj-red-dark">{statusLabel}</p>
              <p className="truncate text-xs text-rj-gray-600">
                {itemSummary} · Order Total {totalLabel}
              </p>
              <p className="truncate text-[10px] text-rj-gray-400">{orderNumber}</p>
            </div>
          </div>

          <MessageThreadBody
            orderId={orderId}
            messages={messages}
            className="min-h-0 flex-1 p-4"
            listClassName="min-h-0 flex-1"
            autoFocus
          />
        </div>
      ) : null}
    </>
  );
}
