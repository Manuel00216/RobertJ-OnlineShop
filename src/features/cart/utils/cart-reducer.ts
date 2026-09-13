import type {
  CartAction,
  CartItem,
  CartLineRef,
  CartState,
} from "@/features/cart/types/cart.types";

export const initialCartState: CartState = { items: [] };

function clampQuantity(item: CartItem, quantity: number) {
  return Math.max(1, Math.min(quantity, item.maxQuantity));
}

/** A cart line's real identity — see `CartItem.variantId`'s doc comment. */
function isSameLine(item: CartItem, ref: CartLineRef): boolean {
  return item.productId === ref.productId && item.variantId === ref.variantId;
}

/** Stable string key for a line — for React `key`s and Set-based selection state. */
export function getCartLineKey(ref: CartLineRef): string {
  return ref.variantId ? `${ref.productId}:${ref.variantId}` : ref.productId;
}

/** Pure cart transitions — kept out of the provider so they stay testable. */
export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "hydrate":
      return action.state;

    case "add": {
      const existing = state.items.find((item) => isSameLine(item, action.item));

      if (!existing) {
        return { items: [...state.items, action.item] };
      }

      return {
        items: state.items.map((item) =>
          isSameLine(item, action.item)
            ? {
                ...item,
                quantity: clampQuantity(
                  item,
                  item.quantity + action.item.quantity,
                ),
              }
            : item,
        ),
      };
    }

    case "setQuantity": {
      if (action.quantity <= 0) {
        return {
          items: state.items.filter((item) => !isSameLine(item, action)),
        };
      }
      return {
        items: state.items.map((item) =>
          isSameLine(item, action)
            ? { ...item, quantity: clampQuantity(item, action.quantity) }
            : item,
        ),
      };
    }

    case "updateItem": {
      return {
        items: state.items.map((item) => {
          if (!isSameLine(item, action)) return item;
          const patched = { ...item, ...action.patch };
          return { ...patched, quantity: clampQuantity(patched, item.quantity) };
        }),
      };
    }

    case "remove":
      return {
        items: state.items.filter((item) => !isSameLine(item, action)),
      };

    case "removeMany":
      return {
        items: state.items.filter(
          (item) => !action.lines.some((line) => isSameLine(item, line)),
        ),
      };

    case "clear":
      return initialCartState;

    default:
      return state;
  }
}

/** Derived totals — never stored, always computed from items. */
export function getCartTotals(state: CartState) {
  return state.items.reduce(
    (totals, item) => ({
      itemCount: totals.itemCount + item.quantity,
      subtotalCents: totals.subtotalCents + item.unitPriceCents * item.quantity,
    }),
    { itemCount: 0, subtotalCents: 0 },
  );
}

/** Cart lines whose line key is in the given selection — used by the cart
 * page's per-item checkboxes and by checkout to place an order for only those. */
export function getSelectedItems(
  items: CartItem[],
  selectedIds: ReadonlySet<string>,
): CartItem[] {
  return items.filter((item) => selectedIds.has(getCartLineKey(item)));
}
