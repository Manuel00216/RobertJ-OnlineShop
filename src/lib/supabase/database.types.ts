/**
 * Database types for the Roberj Marketplace schema.
 *
 * Hand-written to match supabase/migrations/20260802000100_initial_schema.sql
 * exactly. Regenerate from the live database once the migration is applied —
 * the generated file is authoritative, this one is a stand-in:
 *
 *   npx supabase login
 *   npx supabase link --project-ref xthttwbggkmmkqunastg
 *   npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["user_role"];
          full_name: string | null;
          username: string | null;
          avatar_url: string | null;
          phone: string | null;
          bio: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: Database["public"]["Enums"]["user_role"];
          full_name?: string | null;
          username?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };

      categories: {
        Row: {
          id: string;
          parent_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          icon: string | null;
          image_url: string | null;
          active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          parent_id?: string | null;
          name: string;
          slug: string;
          description?: string | null;
          icon?: string | null;
          image_url?: string | null;
          active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };

      products: {
        Row: {
          id: string;
          seller_id: string;
          category_id: string | null;
          title: string;
          slug: string;
          description: string | null;
          price_cents: number;
          currency: string;
          quantity: number;
          condition: Database["public"]["Enums"]["product_condition"];
          status: Database["public"]["Enums"]["product_status"];
          featured: boolean;
          location: string | null;
          tags: string[];
          views_count: number;
          /** Generated column — read-only. */
          search_vector: unknown;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          category_id?: string | null;
          title: string;
          slug: string;
          description?: string | null;
          price_cents: number;
          currency?: string;
          quantity?: number;
          condition?: Database["public"]["Enums"]["product_condition"];
          status?: Database["public"]["Enums"]["product_status"];
          featured?: boolean;
          location?: string | null;
          tags?: string[];
          views_count?: number;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "products_seller_id_fkey";
            columns: ["seller_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };

      product_images: {
        Row: {
          id: string;
          product_id: string;
          url: string;
          alt_text: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          url: string;
          alt_text?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_images"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };

      orders: {
        Row: {
          id: string;
          order_number: string;
          buyer_id: string;
          seller_id: string;
          subtotal_cents: number;
          shipping_fee_cents: number;
          total_cents: number;
          currency: string;
          payment_status: Database["public"]["Enums"]["payment_status"];
          order_status: Database["public"]["Enums"]["order_status"];
          shipping_address: Json;
          notes: string | null;
          placed_at: string;
          paid_at: string | null;
          shipped_at: string | null;
          delivered_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          /** Assigned by the assign_order_number trigger when omitted. */
          order_number?: string;
          buyer_id: string;
          seller_id: string;
          subtotal_cents: number;
          shipping_fee_cents?: number;
          total_cents: number;
          currency?: string;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          order_status?: Database["public"]["Enums"]["order_status"];
          shipping_address: Json;
          notes?: string | null;
          placed_at?: string;
          paid_at?: string | null;
          shipped_at?: string | null;
          delivered_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey";
            columns: ["buyer_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_seller_id_fkey";
            columns: ["seller_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          product_title: string;
          quantity: number;
          unit_price_cents: number;
          subtotal_cents: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          product_title: string;
          quantity: number;
          unit_price_cents: number;
          subtotal_cents: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          provider: string;
          provider_transaction_id: string;
          stripe_event_id: string | null;
          charge_id: string | null;
          customer_id: string | null;
          customer_email: string | null;
          receipt_url: string | null;
          failure_reason: string | null;
          payment_method_type: Database["public"]["Enums"]["payment_method_type"];
          amount_cents: number;
          currency: string;
          status: Database["public"]["Enums"]["payment_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          provider?: string;
          provider_transaction_id: string;
          stripe_event_id?: string | null;
          charge_id?: string | null;
          customer_id?: string | null;
          customer_email?: string | null;
          receipt_url?: string | null;
          failure_reason?: string | null;
          payment_method_type?: Database["public"]["Enums"]["payment_method_type"];
          amount_cents: number;
          currency?: string;
          status?: Database["public"]["Enums"]["payment_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
    };

    Views: Record<string, never>;

    Functions: {
      create_order: {
        Args: {
          p_seller_id: string;
          p_items: Json;
          p_shipping_address: Json;
          p_shipping_fee_cents?: number;
          p_notes?: string | null;
        };
        Returns: Database["public"]["Tables"]["orders"]["Row"];
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      get_my_profile: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      slugify: {
        Args: { value: string };
        Returns: string;
      };
    };

    Enums: {
      user_role: "buyer" | "seller" | "admin";
      product_status: "draft" | "active" | "sold" | "archived";
      product_condition: "new" | "like_new" | "good" | "fair" | "poor";
      payment_method_type: "cod" | "card";
      payment_status:
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "partially_refunded";
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded";
    };

    CompositeTypes: Record<string, never>;
  };
}

/** Convenience aliases so features never spell out the deep index types. */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
