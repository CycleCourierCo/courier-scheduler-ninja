export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      drivers: {
        Row: {
          available_hours: number | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          available_hours?: number | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          available_hours?: number | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          created_at: string
          id: string
          location: string
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
          location: string
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
          location?: string
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
      orders: {
        Row: {
          bike_brand: string | null
          bike_model: string | null
          created_at: string
          customer_order_number: string | null
          delivery_date: Json | null
          delivery_instructions: string | null
          id: string
          is_bike_swap: boolean | null
          needs_payment_on_collection: boolean | null
          pickup_date: Json | null
          receiver: Json
          receiver_confirmed_at: string | null
          receiver_notes: string | null
          scheduled_at: string | null
          scheduled_delivery_date: string | null
          scheduled_pickup_date: string | null
          sender: Json
          sender_confirmed_at: string | null
          sender_notes: string | null
          status: Database["public"]["Enums"]["order_status"]
          tracking_events: Json | null
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bike_brand?: string | null
          bike_model?: string | null
          created_at?: string
          customer_order_number?: string | null
          delivery_date?: Json | null
          delivery_instructions?: string | null
          id?: string
          is_bike_swap?: boolean | null
          needs_payment_on_collection?: boolean | null
          pickup_date?: Json | null
          receiver: Json
          receiver_confirmed_at?: string | null
          receiver_notes?: string | null
          scheduled_at?: string | null
          scheduled_delivery_date?: string | null
          scheduled_pickup_date?: string | null
          sender: Json
          sender_confirmed_at?: string | null
          sender_notes?: string | null
          status: Database["public"]["Enums"]["order_status"]
          tracking_events?: Json | null
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bike_brand?: string | null
          bike_model?: string | null
          created_at?: string
          customer_order_number?: string | null
          delivery_date?: Json | null
          delivery_instructions?: string | null
          id?: string
          is_bike_swap?: boolean | null
          needs_payment_on_collection?: boolean | null
          pickup_date?: Json | null
          receiver?: Json
          receiver_confirmed_at?: string | null
          receiver_notes?: string | null
          scheduled_at?: string | null
          scheduled_delivery_date?: string | null
          scheduled_pickup_date?: string | null
          sender?: Json
          sender_confirmed_at?: string | null
          sender_notes?: string | null
          status?: Database["public"]["Enums"]["order_status"]
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
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          company_name: string | null
          created_at: string
          email: string | null
          id: string
          is_business: boolean | null
          name: string | null
          phone: string | null
          postal_code: string | null
          role: Database["public"]["Enums"]["user_role"]
          table_preferences: Json | null
          updated_at: string
          website: string | null
        }
        Insert: {
          account_status?:
            | Database["public"]["Enums"]["account_status_type"]
            | null
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          id: string
          is_business?: boolean | null
          name?: string | null
          phone?: string | null
          postal_code?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          table_preferences?: Json | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_status?:
            | Database["public"]["Enums"]["account_status_type"]
            | null
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_business?: boolean | null
          name?: string | null
          phone?: string | null
          postal_code?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          table_preferences?: Json | null
          updated_at?: string
          website?: string | null
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
        Relationships: [
          {
            foreignKeyName: "routes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_update_account_status: {
        Args: {
          user_id: string
          status: string
        }
        Returns: boolean
      }
      get_business_accounts_for_admin: {
        Args: Record<PropertyKey, never>
        Returns: {
          account_status:
            | Database["public"]["Enums"]["account_status_type"]
            | null
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          company_name: string | null
          created_at: string
          email: string | null
          id: string
          is_business: boolean | null
          name: string | null
          phone: string | null
          postal_code: string | null
          role: Database["public"]["Enums"]["user_role"]
          table_preferences: Json | null
          updated_at: string
          website: string | null
        }[]
      }
      get_user_role: {
        Args: {
          user_id: string
        }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_account_approved: {
        Args: {
          user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
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
      user_role: "admin" | "b2b_customer" | "b2c_customer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
