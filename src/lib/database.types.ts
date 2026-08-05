export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      countries: {
        Row: {
          code: string
          currency: string
          features: Json
          locale: string
          tax_display: string
          timezone: string
        }
        Insert: {
          code: string
          currency: string
          features?: Json
          locale: string
          tax_display?: string
          timezone: string
        }
        Update: {
          code?: string
          currency?: string
          features?: Json
          locale?: string
          tax_display?: string
          timezone?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          auth_user_id: string | null
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          push_subscription: Json | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          push_subscription?: Json | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          push_subscription?: Json | null
        }
        Relationships: []
      }
      locations: {
        Row: {
          address: string
          id: string
          shop_id: string
        }
        Insert: {
          address: string
          id?: string
          shop_id: string
        }
        Update: {
          address?: string
          id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          id: string
          name: string
          shop_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          shop_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          shop_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          allergens: string[]
          category_id: string
          currency: string
          description: string | null
          id: string
          is_available: boolean
          name: string
          photo_url: string | null
          price_minor: number
          shop_id: string
          sort_order: number
        }
        Insert: {
          allergens?: string[]
          category_id: string
          currency: string
          description?: string | null
          id?: string
          is_available?: boolean
          name: string
          photo_url?: string | null
          price_minor: number
          shop_id: string
          sort_order?: number
        }
        Update: {
          allergens?: string[]
          category_id?: string
          currency?: string
          description?: string | null
          id?: string
          is_available?: boolean
          name?: string
          photo_url?: string | null
          price_minor?: number
          shop_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      option_groups: {
        Row: {
          id: string
          item_id: string
          name: string
          required: boolean
          sort_order: number
          type: Database["public"]["Enums"]["option_group_type"]
        }
        Insert: {
          id?: string
          item_id: string
          name: string
          required?: boolean
          sort_order?: number
          type?: Database["public"]["Enums"]["option_group_type"]
        }
        Update: {
          id?: string
          item_id?: string
          name?: string
          required?: boolean
          sort_order?: number
          type?: Database["public"]["Enums"]["option_group_type"]
        }
        Relationships: [
          {
            foreignKeyName: "option_groups_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      options: {
        Row: {
          group_id: string
          id: string
          name: string
          price_delta_minor: number
          sort_order: number
        }
        Insert: {
          group_id: string
          id?: string
          name: string
          price_delta_minor?: number
          sort_order?: number
        }
        Update: {
          group_id?: string
          id?: string
          name?: string
          price_delta_minor?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          action: string
          actor: string
          at: string
          id: string
          order_id: string
          shop_id: string
        }
        Insert: {
          action: string
          actor: string
          at?: string
          id?: string
          order_id: string
          shop_id: string
        }
        Update: {
          action?: string
          actor?: string
          at?: string
          id?: string
          order_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          item_snapshot: Json
          order_id: string
          qty: number
        }
        Insert: {
          id?: string
          item_snapshot: Json
          order_id: string
          qty: number
        }
        Update: {
          id?: string
          item_snapshot?: Json
          order_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          access_token: string
          collected_at: string | null
          currency: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          order_number: number
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          placed_at: string
          push_subscription: Json | null
          ready_at: string | null
          reject_reason: string | null
          shop_id: string
          status: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id: string | null
          total_minor: number
        }
        Insert: {
          access_token?: string
          collected_at?: string | null
          currency: string
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          order_number: number
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          placed_at?: string
          push_subscription?: Json | null
          ready_at?: string | null
          reject_reason?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          total_minor: number
        }
        Update: {
          access_token?: string
          collected_at?: string | null
          currency?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          order_number?: number
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          placed_at?: string
          push_subscription?: Json | null
          ready_at?: string | null
          reject_reason?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          total_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          branding: Json
          country_code: string
          created_at: string
          hours: Json
          id: string
          is_paused: boolean
          name: string
          payment_modes: Database["public"]["Enums"]["payment_mode"][]
          plan_tier: Database["public"]["Enums"]["plan_tier"]
          prep_minutes: number
          slug: string
          stripe_account_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          trial_ends_at: string | null
        }
        Insert: {
          branding?: Json
          country_code: string
          created_at?: string
          hours?: Json
          id?: string
          is_paused?: boolean
          name: string
          payment_modes?: Database["public"]["Enums"]["payment_mode"][]
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          prep_minutes?: number
          slug: string
          stripe_account_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
        }
        Update: {
          branding?: Json
          country_code?: string
          created_at?: string
          hours?: Json
          id?: string
          is_paused?: boolean
          name?: string
          payment_modes?: Database["public"]["Enums"]["payment_mode"][]
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          prep_minutes?: number
          slug?: string
          stripe_account_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shops_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      staff_users: {
        Row: {
          auth_user_id: string
          id: string
          role: Database["public"]["Enums"]["staff_role"]
          shop_id: string
        }
        Insert: {
          auth_user_id: string
          id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          shop_id: string
        }
        Update: {
          auth_user_id?: string
          id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_users_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      attach_push_subscription: {
        Args: { p_subscription: Json; p_token: string }
        Returns: undefined
      }
      create_order: {
        Args: {
          p_customer_name: string
          p_customer_phone: string
          p_items: Json
          p_payment_mode: string
          p_shop_slug: string
        }
        Returns: Json
      }
      get_order_by_token: { Args: { p_token: string }; Returns: Json }
      is_entitled: { Args: { p_shop_id: string }; Returns: boolean }
      is_staff_of: { Args: { target_shop: string }; Returns: boolean }
      register_shop: {
        Args: { p_name: string; p_slug: string }
        Returns: Database["public"]["Tables"]["shops"]["Row"]
      }
      set_online_payments: {
        Args: { p_enabled: boolean }
        Returns: Database["public"]["Tables"]["shops"]["Row"]
      }
    }
    Enums: {
      option_group_type: "single" | "multi"
      order_status:
        | "pending_payment"
        | "new"
        | "accepted"
        | "preparing"
        | "ready"
        | "collected"
        | "rejected"
        | "refunded"
      payment_mode: "in_store" | "online"
      plan_tier: "basic" | "pro"
      staff_role: "owner" | "staff"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      option_group_type: ["single", "multi"],
      order_status: [
        "pending_payment",
        "new",
        "accepted",
        "preparing",
        "ready",
        "collected",
        "rejected",
        "refunded",
      ],
      payment_mode: ["in_store", "online"],
      plan_tier: ["basic", "pro"],
      staff_role: ["owner", "staff"],
    },
  },
} as const
