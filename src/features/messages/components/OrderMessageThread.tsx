import { RJ_CARD, THEMED_CARD } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { MessageThreadBody } from "@/features/messages/components/MessageThreadBody";
import type { OrderMessageView } from "@/features/messages/types/message.types";

export interface OrderMessageThreadProps {
  orderId: string;
  /** Display-ready messages, oldest-first, author resolved per viewer on the server. */
  messages: OrderMessageView[];
  /** Headline for the panel — e.g. "Messages" (seller/admin inline view). */
  title?: string;
  /** Helper copy under the header. */
  description?: string;
  /** Renders through the Admin/Seller portal tokens; omit for the buyer view. */
  themed?: boolean;
}

/**
 * Inline order-conversation card — used on the seller/admin order-detail page.
 * The buyer side uses the docked `ContactSellerDock` instead; both share
 * `MessageThreadBody` so the send logic lives in one place.
 */
export function OrderMessageThread({
  orderId,
  messages,
  title = "Messages",
  description,
  themed = false,
}: OrderMessageThreadProps) {
  const muted = themed ? "text-muted-foreground" : "text-rj-gray-600";
  return (
    <section
      aria-label={title}
      className={cn(themed ? THEMED_CARD : RJ_CARD, "flex flex-col p-5")}
    >
      <h2 className={cn("text-[10px] font-bold uppercase tracking-[0.3em]", muted)}>
        {title}
      </h2>
      {description ? <p className={cn("mt-1 text-xs", muted)}>{description}</p> : null}
      <MessageThreadBody
        orderId={orderId}
        messages={messages}
        themed={themed}
        className="mt-4"
        listClassName="max-h-96"
      />
    </section>
  );
}
