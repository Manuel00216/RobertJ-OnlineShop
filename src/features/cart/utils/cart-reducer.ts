import type {
  CartAction,
  CartItem,
  CartState,
} from "@/features/cart/types/cart.types";

export const initialCartState: CartState = { items: [] };

function clampQuantity(item: CartItem, quantity: number) {
  return Math.max(1, Math.min(quantity, item.maxQuantity));
}

/** Pure cart transitions — kept out of the provider so they stay testable. */
export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "hydrate":
      return action.state;

    case "add": {
      const existing = state.items.find(
        (item) => item.productId === action.item.productId,
      );

      if (!existing) {
        return { items: [...state.items, action.item] };
      }

      return {
        items: state.items.map((item) =>
          item.productId === action.item.productId
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
          items: state.items.filter(
            (item) => item.productId !== action.productId,
          ),
        };
      }
      return {
        items: state.items.map((item) =>
          item.productId === action.productId
            ? { ...item, quantity: clampQuantity(item, action.quantity) }
            : item,
        ),
      };
    }

    case "remove":
      return {
        items: state.items.filter((item) => item.productId !== action.productId),
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
