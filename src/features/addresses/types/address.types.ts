/** A buyer's saved shipping address (domain model, camelCase — distinct from
 * the snake_case `addresses` row in `database.types.ts`). */
export interface Address {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  region: string | null;
  province: string | null;
  city: string;
  barangay: string | null;
  streetDetails: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
