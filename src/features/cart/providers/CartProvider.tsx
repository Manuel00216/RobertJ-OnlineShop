"use client";

import {
  createContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

import {
  cartReducer,
  getCartTotals,
  initialCartState,
} from "@/features/cart/utils/cart-reducer";
import type { CartItem, CartState } from "@/features/cart/types/cart.types";

const STORAGE_KEY = "roberj.cart.v1";

export interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  /** Removes several lines at once — used by checkout to clear only placed items. */
  removeMany: (productIds: string[]) => void;
  setQuantity: (productId: string, quantity: number) => void;
  /** Applies a server-confirmed price/stock correction to one line (user-triggered only). */
  updateItem: (
    productId: string,
    patch: Partial<Pick<CartItem, "unitPriceCents" | "maxQuantity">>,
  ) => void;
  clear: () => void;
}

export const CartContext = createContext<CartContextValue | null>(null);

/** Holds cart state client-side and mirrors it to localStorage. */
export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);
  // Skips exactly the first run of the persist effect below. Without this,
  // both effects fire in the same pass on mount: the hydrate effect reads
  // localStorage and *schedules* a "hydrate" dispatch (async — it doesn't
  // update `state` until the next render), while the persist effect, in that
  // same pass, still closes over the pre-hydration (empty) `state` and
  // immediately writes `{items:[]}` back — permanently clobbering the real
  // cart before the hydrate dispatch's re-render ever lands. Guest carts were
  // being silently wiped on every hard page load. A ref (not state) is
  // deliberate here: flipping it doesn't need to trigger a re-render, it only
  // needs to be readable — the effect already re-runs on its own once the
  // hydrate dispatch changes `state`.
  const isFirstPersist = useRef(true);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      dispatch({ type: "hydrate", state: JSON.parse(raw) as CartState });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (isFirstPersist.current) {
      isFirstPersist.current = false;
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const value = useMemo<CartContextValue>(() => {
    const { itemCount, subtotalCents } = getCartTotals(state);
    return {
      items: state.items,
      itemCount,
      subtotalCents,
      addItem: (item) => dispatch({ type: "add", item }),
      removeItem: (productId) => dispatch({ type: "remove", productId }),
      removeMany: (productIds) => dispatch({ type: "removeMany", productIds }),
      setQuantity: (productId, quantity) =>
        dispatch({ type: "setQuantity", productId, quantity }),
      updateItem: (productId, patch) =>
        dispatch({ type: "updateItem", productId, patch }),
      clear: () => dispatch({ type: "clear" }),
    };
  }, [state]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
