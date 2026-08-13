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
          /** Seller's receiving QR code image; null for buyers (also DB-enforced via CHECK). */
          payment_qr_url: string | null;
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
          payment_qr_url?: string | null;
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
          shop_id: string | null;
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
          shop_id?: string | null;
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
            foreignKeyName: "products_shop_id_fkey";
            columns: ["shop_id"];
            referencedRelation: "shops";
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
          /** Supabase Storage object path in the private payment-receipts bucket, not a public URL. */
          receipt_path: string | null;
          failure_reason: string | null;
          payment_method_type: Database["public"]["Enums"]["payment_method_type"];
          amount_cents: number;
          currency: string;
          status: Database["public"]["Enums"]["payment_status"];
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          receipt_path?: string | null;
          failure_reason?: string | null;
          payment_method_type?: Database["public"]["Enums"]["payment_method_type"];
          amount_cents: number;
          currency?: string;
          status?: Database["public"]["Enums"]["payment_status"];
          verified_by?: string | null;
          verified_at?: string | null;
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

      shops: {
        Row: {
          id: string;
          name: string;
          slug: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shops"]["Insert"]>;
        Relationships: [];
      };

      shop_users: {
        Row: {
          id: string;
          shop_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shop_users"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "shop_users_shop_id_fkey";
            columns: ["shop_id"];
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_users_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      inventory: {
        Row: {
          id: string;
          product_id: string;
          shop_id: string | null;
          quantity: number;
          low_stock_threshold: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          shop_id?: string | null;
          quantity?: number;
          low_stock_threshold?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["inventory"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_shop_id_fkey";
            columns: ["shop_id"];
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };

      stock_adjustments: {
        Row: {
          id: string;
          product_id: string;
          shop_id: string | null;
          delta: number;
          previous_quantity: number;
          new_quantity: number;
          reason: Database["public"]["Enums"]["stock_adjustment_reason"];
          note: string | null;
          related_order_id: string | null;
          /** Null = system-driven (sale, cancellation restock); set = a manual adjustment. */
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          shop_id?: string | null;
          delta: number;
          previous_quantity: number;
          new_quantity: number;
          reason: Database["public"]["Enums"]["stock_adjustment_reason"];
          note?: string | null;
          related_order_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stock_adjustments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_adjustments_shop_id_fkey";
            columns: ["shop_id"];
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_adjustments_related_order_id_fkey";
            columns: ["related_order_id"];
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_adjustments_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };

      admin_action_log: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          target_user_id: string | null;
          target_shop_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          target_user_id?: string | null;
          target_shop_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["admin_action_log"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "admin_action_log_actor_id_fkey";
            columns: ["actor_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_action_log_target_user_id_fkey";
            columns: ["target_user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_action_log_target_shop_id_fkey";
            columns: ["target_shop_id"];
            referencedRelation: "shops";
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
      check_rate_limit: {
        Args: {
          p_key: string;
          p_max_hits: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      submit_qr_payment: {
        Args: {
          p_order_id: string;
          p_receipt_path: string;
        };
        Returns: Database["public"]["Tables"]["payments"]["Row"];
      };
      verify_payment: {
        Args: {
          p_payment_id: string;
          p_decision: Database["public"]["Enums"]["payment_status"];
        };
        Returns: Database["public"]["Tables"]["payments"]["Row"];
      };
      is_shop_member: {
        Args: { p_shop_id: string };
        Returns: boolean;
      };
      adjust_stock: {
        Args: {
          p_product_id: string;
          p_delta: number;
          p_reason: Database["public"]["Enums"]["stock_adjustment_reason"];
          p_note?: string | null;
        };
        Returns: Database["public"]["Tables"]["inventory"]["Row"];
      };
      admin_assign_seller_shop: {
        Args: { p_user_id: string; p_shop_id: string };
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      admin_list_users: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          email: string | null;
          full_name: string | null;
          username: string | null;
          role: Database["public"]["Enums"]["user_role"];
          avatar_url: string | null;
          created_at: string;
          shop_id: string | null;
          shop_name: string | null;
        }[];
      };
      report_sales_summary: {
        Args: {
          p_from: string;
          p_to: string;
          p_shop_id?: string | null;
        };
        Returns: {
          total_orders: number;
          paid_orders: number;
          cancelled_orders: number;
          revenue_cents: number;
          units_sold: number;
          avg_order_value_cents: number;
          cod_paid_orders: number;
          qr_paid_orders: number;
          pending_payment_orders: number;
        }[];
      };
      report_sales_timeseries: {
        Args: {
          p_from: string;
          p_to: string;
          p_granularity?: string;
          p_shop_id?: string | null;
        };
        Returns: {
          bucket: string;
          order_count: number;
          revenue_cents: number;
        }[];
      };
      report_order_status_breakdown: {
        Args: {
          p_from: string;
          p_to: string;
          p_shop_id?: string | null;
        };
        Returns: {
          status: Database["public"]["Enums"]["order_status"];
          order_count: number;
        }[];
      };
      report_top_products: {
        Args: {
          p_from: string;
          p_to: string;
          p_limit?: number;
          p_shop_id?: string | null;
        };
        Returns: {
          product_id: string;
          product_title: string;
          units_sold: number;
          revenue_cents: number;
        }[];
      };
    };

    Enums: {
      user_role: "buyer" | "seller" | "admin";
      product_status: "draft" | "active" | "sold" | "archived";
      product_condition: "new" | "like_new" | "good" | "fair" | "poor";
      payment_method_type: "cod" | "card" | "qr_upload";
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
      stock_adjustment_reason:
        | "initial_stock"
        | "restock"
        | "correction"
        | "sale"
        | "cancellation_restock"
        | "shrinkage"
        | "other";
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
