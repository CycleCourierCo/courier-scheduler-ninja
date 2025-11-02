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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key_hash: string
          key_name: string
          key_prefix: string
          last_used_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash: string
          key_name: string
          key_prefix: string
          last_used_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          key_name?: string
          key_prefix?: string
          last_used_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_history: {
        Row: {
          created_at: string
          customer_email: string
          customer_id: string
          customer_name: string
          end_date: string
          id: string
          order_count: number
          quickbooks_invoice_id: string | null
          quickbooks_invoice_number: string | null
          quickbooks_invoice_url: string | null
          start_date: string
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_email: string
          customer_id: string
          customer_name: string
          end_date: string
          id?: string
          order_count: number
          quickbooks_invoice_id?: string | null
          quickbooks_invoice_number?: string | null
          quickbooks_invoice_url?: string | null
          start_date: string
          status?: string
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_email?: string
          customer_id?: string
          customer_name?: string
          end_date?: string
          id?: string
          order_count?: number
          quickbooks_invoice_id?: string | null
          quickbooks_invoice_number?: string | null
          quickbooks_invoice_url?: string | null
          start_date?: string
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          created_at: string
          id: string
          lat: number | null
          location: string
          lon: number | null
          order_id: string
          preferred_date: Json | null
          related_job_id: string | null
          status: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat?: number | null
          location: string
          lon?: number | null
          order_id: string
          preferred_date?: Json | null
          related_job_id?: string | null
          status?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number | null
          location?: string
          lon?: number | null
          order_id?: string
          preferred_date?: Json | null
          related_job_id?: string | null
          status?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_related_job_id_fkey"
            columns: ["related_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          provider: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          provider: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          provider?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      order_comments: {
        Row: {
          admin_id: string
          admin_name: string
          comment: string
          created_at: string
          id: string
          order_id: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          admin_name: string
          comment: string
          created_at?: string
          id?: string
          order_id: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          admin_name?: string
          comment?: string
          created_at?: string
          id?: string
          order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_comments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          bike_brand: string | null
          bike_model: string | null
          bike_quantity: number | null
          collection_code: string | null
          collection_confirmation_sent_at: string | null
          collection_driver_name: string | null
          created_at: string
          customer_order_number: string | null
          delivery_confirmation_sent_at: string | null
          delivery_date: Json | null
          delivery_driver_name: string | null
          delivery_instructions: string | null
          delivery_timeslot: string | null
          id: string
          is_bike_swap: boolean | null
          is_ebay_order: boolean | null
          loaded_onto_van: boolean | null
          loaded_onto_van_at: string | null
          needs_payment_on_collection: boolean | null
          payment_collection_phone: string | null
          pickup_date: Json | null
          pickup_timeslot: string | null
          receiver: Json
          receiver_confirmed_at: string | null
          receiver_notes: string | null
          scheduled_at: string | null
          scheduled_delivery_date: string | null
          scheduled_pickup_date: string | null
          sender: Json
          sender_confirmed_at: string | null
          sender_notes: string | null
          shipday_delivery_id: string | null
          shipday_pickup_id: string | null
          shopify_order_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          storage_locations: Json | null
          tracking_events: Json | null
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bike_brand?: string | null
          bike_model?: string | null
          bike_quantity?: number | null
          collection_code?: string | null
          collection_confirmation_sent_at?: string | null
          collection_driver_name?: string | null
          created_at?: string
          customer_order_number?: string | null
          delivery_confirmation_sent_at?: string | null
          delivery_date?: Json | null
          delivery_driver_name?: string | null
          delivery_instructions?: string | null
          delivery_timeslot?: string | null
          id?: string
          is_bike_swap?: boolean | null
          is_ebay_order?: boolean | null
          loaded_onto_van?: boolean | null
          loaded_onto_van_at?: string | null
          needs_payment_on_collection?: boolean | null
          payment_collection_phone?: string | null
          pickup_date?: Json | null
          pickup_timeslot?: string | null
          receiver: Json
          receiver_confirmed_at?: string | null
          receiver_notes?: string | null
          scheduled_at?: string | null
          scheduled_delivery_date?: string | null
          scheduled_pickup_date?: string | null
          sender: Json
          sender_confirmed_at?: string | null
          sender_notes?: string | null
          shipday_delivery_id?: string | null
          shipday_pickup_id?: string | null
          shopify_order_id?: string | null
          status: Database["public"]["Enums"]["order_status"]
          storage_locations?: Json | null
          tracking_events?: Json | null
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bike_brand?: string | null
          bike_model?: string | null
          bike_quantity?: number | null
          collection_code?: string | null
          collection_confirmation_sent_at?: string | null
          collection_driver_name?: string | null
          created_at?: string
          customer_order_number?: string | null
          delivery_confirmation_sent_at?: string | null
          delivery_date?: Json | null
          delivery_driver_name?: string | null
          delivery_instructions?: string | null
          delivery_timeslot?: string | null
          id?: string
          is_bike_swap?: boolean | null
          is_ebay_order?: boolean | null
          loaded_onto_van?: boolean | null
          loaded_onto_van_at?: string | null
          needs_payment_on_collection?: boolean | null
          payment_collection_phone?: string | null
          pickup_date?: Json | null
          pickup_timeslot?: string | null
          receiver?: Json
          receiver_confirmed_at?: string | null
          receiver_notes?: string | null
          scheduled_at?: string | null
          scheduled_delivery_date?: string | null
          scheduled_pickup_date?: string | null
          sender?: Json
          sender_confirmed_at?: string | null
          sender_notes?: string | null
          shipday_delivery_id?: string | null
          shipday_pickup_id?: string | null
          shopify_order_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          storage_locations?: Json | null
          tracking_events?: Json | null
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status:
            | Database["public"]["Enums"]["account_status_type"]
            | null
          accounts_email: string | null
          address_line_1: string | null
          address_line_2: string | null
          available_hours: number | null
          city: string | null
          company_name: string | null
          country: string | null
          county: string | null
          created_at: string
          email: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          is_business: boolean | null
          latitude: number | null
          longitude: number | null
          name: string | null
          phone: string | null
          postal_code: string | null
          role: Database["public"]["Enums"]["user_role"]
          shipday_driver_id: string | null
          table_preferences: Json | null
          updated_at: string
          uses_own_van: boolean | null
          van_allowance: number | null
          website: string | null
        }
        Insert: {
          account_status?:
            | Database["public"]["Enums"]["account_status_type"]
            | null
          accounts_email?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          available_hours?: number | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          county?: string | null
          created_at?: string
          email?: string | null
          hourly_rate?: number | null
          id: string
          is_active?: boolean | null
          is_business?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          phone?: string | null
          postal_code?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          shipday_driver_id?: string | null
          table_preferences?: Json | null
          updated_at?: string
          uses_own_van?: boolean | null
          van_allowance?: number | null
          website?: string | null
        }
        Update: {
          account_status?:
            | Database["public"]["Enums"]["account_status_type"]
            | null
          accounts_email?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          available_hours?: number | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          county?: string | null
          created_at?: string
          email?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          is_business?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          phone?: string | null
          postal_code?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          shipday_driver_id?: string | null
          table_preferences?: Json | null
          updated_at?: string
          uses_own_van?: boolean | null
          van_allowance?: number | null
          website?: string | null
        }
        Relationships: []
      }
      quickbooks_tokens: {
        Row: {
          access_token: string
          company_id: string | null
          created_at: string
          expires_at: string
          id: string
          refresh_token: string | null
          scope: string | null
          token_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          company_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          company_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      routes: {
        Row: {
          created_at: string
          day: number
          driver_id: string
          id: string
          stops: Json
          total_time: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          day: number
          driver_id: string
          id?: string
          stops: Json
          total_time: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          day?: number
          driver_id?: string
          id?: string
          stops?: Json
          total_time?: number
          updated_at?: string
        }
        Relationships: []
      }
      timeslip_generation_logs: {
        Row: {
          drivers_processed: number | null
          error_message: string | null
          execution_duration_ms: number | null
          execution_time: string | null
          id: string
          run_date: string
          status: string
          timeslips_created: number | null
          warnings: string[] | null
        }
        Insert: {
          drivers_processed?: number | null
          error_message?: string | null
          execution_duration_ms?: number | null
          execution_time?: string | null
          id?: string
          run_date: string
          status: string
          timeslips_created?: number | null
          warnings?: string[] | null
        }
        Update: {
          drivers_processed?: number | null
          error_message?: string | null
          execution_duration_ms?: number | null
          execution_time?: string | null
          id?: string
          run_date?: string
          status?: string
          timeslips_created?: number | null
          warnings?: string[] | null
        }
        Relationships: []
      }
      timeslips: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          custom_addon_hours: number
          custom_addons: Json | null
          date: string
          driver_id: string
          driving_hours: number
          hourly_rate: number
          id: string
          job_locations: Json | null
          lunch_hours: number
          quickbooks_bill_created_at: string | null
          quickbooks_bill_id: string | null
          quickbooks_bill_number: string | null
          quickbooks_bill_url: string | null
          route_links: string[] | null
          status: string
          stop_hours: number
          total_hours: number | null
          total_pay: number | null
          total_stops: number
          updated_at: string | null
          van_allowance: number | null
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          custom_addon_hours?: number
          custom_addons?: Json | null
          date: string
          driver_id: string
          driving_hours?: number
          hourly_rate: number
          id?: string
          job_locations?: Json | null
          lunch_hours?: number
          quickbooks_bill_created_at?: string | null
          quickbooks_bill_id?: string | null
          quickbooks_bill_number?: string | null
          quickbooks_bill_url?: string | null
          route_links?: string[] | null
          status: string
          stop_hours?: number
          total_hours?: number | null
          total_pay?: number | null
          total_stops?: number
          updated_at?: string | null
          van_allowance?: number | null
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          custom_addon_hours?: number
          custom_addons?: Json | null
          date?: string
          driver_id?: string
          driving_hours?: number
          hourly_rate?: number
          id?: string
          job_locations?: Json | null
          lunch_hours?: number
          quickbooks_bill_created_at?: string | null
          quickbooks_bill_id?: string | null
          quickbooks_bill_number?: string | null
          quickbooks_bill_url?: string | null
          route_links?: string[] | null
          status?: string
          stop_hours?: number
          total_hours?: number | null
          total_pay?: number | null
          total_stops?: number
          updated_at?: string | null
          van_allowance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "timeslips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_generate_api_key: {
        Args: { customer_id: string; key_name: string }
        Returns: {
          api_key: string
          key_id: string
        }[]
      }
      admin_revoke_api_key: { Args: { key_id: string }; Returns: boolean }
      admin_update_account_status: {
        Args: { status: string; user_id: string }
        Returns: boolean
      }
      get_business_accounts_for_admin: {
        Args: never
        Returns: {
          account_status:
            | Database["public"]["Enums"]["account_status_type"]
            | null
          accounts_email: string | null
          address_line_1: string | null
          address_line_2: string | null
          available_hours: number | null
          city: string | null
          company_name: string | null
          country: string | null
          county: string | null
          created_at: string
          email: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          is_business: boolean | null
          latitude: number | null
          longitude: number | null
          name: string | null
          phone: string | null
          postal_code: string | null
          role: Database["public"]["Enums"]["user_role"]
          shipday_driver_id: string | null
          table_preferences: Json | null
          updated_at: string
          uses_own_van: boolean | null
          van_allowance: number | null
          website: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_account_approved: { Args: { user_id: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_current_user_admin: { Args: never; Returns: boolean }
      verify_api_key: { Args: { api_key: string }; Returns: string }
    }
    Enums: {
      account_status_type: "pending" | "approved" | "rejected" | "suspended"
      order_status:
        | "created"
        | "sender_availability_pending"
        | "sender_availability_confirmed"
        | "receiver_availability_pending"
        | "receiver_availability_confirmed"
        | "pending_approval"
        | "scheduled"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "scheduled_dates_pending"
        | "driver_to_collection"
        | "collected"
        | "driver_to_delivery"
        | "collection_scheduled"
        | "delivery_scheduled"
      user_role:
        | "admin"
        | "b2b_customer"
        | "b2c_customer"
        | "loader"
        | "route_planner"
        | "sales"
        | "driver"
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
  public: {
    Enums: {
      account_status_type: ["pending", "approved", "rejected", "suspended"],
      order_status: [
        "created",
        "sender_availability_pending",
        "sender_availability_confirmed",
        "receiver_availability_pending",
        "receiver_availability_confirmed",
        "pending_approval",
        "scheduled",
        "shipped",
        "delivered",
        "cancelled",
        "scheduled_dates_pending",
        "driver_to_collection",
        "collected",
        "driver_to_delivery",
        "collection_scheduled",
        "delivery_scheduled",
      ],
      user_role: [
        "admin",
        "b2b_customer",
        "b2c_customer",
        "loader",
        "route_planner",
        "sales",
        "driver",
      ],
    },
  },
} as const
