"use client";

import { useContext } from "react";

import { CartContext } from "@/features/cart/providers/CartProvider";

/** Access the cart. Throws when used outside CartProvider. */
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider.");
  }
  return context;
}
