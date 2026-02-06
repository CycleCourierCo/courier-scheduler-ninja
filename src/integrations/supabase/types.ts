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
      bicycle_inspections: {
        Row: {
          created_at: string
          id: string
          inspected_at: string | null
          inspected_by_id: string | null
          inspected_by_name: string | null
          notes: string | null
          order_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          inspected_at?: string | null
          inspected_by_id?: string | null
          inspected_by_name?: string | null
          notes?: string | null
          order_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          inspected_at?: string | null
          inspected_by_id?: string | null
          inspected_by_name?: string | null
          notes?: string | null
          order_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bicycle_inspections_inspected_by_id_fkey"
            columns: ["inspected_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bicycle_inspections_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          lat: number | null
          lon: number | null
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          street: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      driver_checkins: {
        Row: {
          checkin_date: string
          checkin_latitude: number | null
          checkin_longitude: number | null
          checkin_time: string
          created_at: string | null
          distance_from_depot_meters: number | null
          driver_id: string
          fuel_photo_url: string
          id: string
          is_on_time: boolean | null
          uniform_photo_url: string
          updated_at: string | null
        }
        Insert: {
          checkin_date: string
          checkin_latitude?: number | null
          checkin_longitude?: number | null
          checkin_time: string
          created_at?: string | null
          distance_from_depot_meters?: number | null
          driver_id: string
          fuel_photo_url: string
          id?: string
          is_on_time?: boolean | null
          uniform_photo_url: string
          updated_at?: string | null
        }
        Update: {
          checkin_date?: string
          checkin_latitude?: number | null
          checkin_longitude?: number | null
          checkin_time?: string
          created_at?: string | null
          distance_from_depot_meters?: number | null
          driver_id?: string
          fuel_photo_url?: string
          id?: string
          is_on_time?: boolean | null
          uniform_photo_url?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_checkins_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_issues: {
        Row: {
          created_at: string
          customer_responded_at: string | null
          customer_response: string | null
          estimated_cost: number | null
          id: string
          inspection_id: string
          issue_description: string
          order_id: string
          requested_by_id: string
          requested_by_name: string
          resolved_at: string | null
          resolved_by_id: string | null
          resolved_by_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_responded_at?: string | null
          customer_response?: string | null
          estimated_cost?: number | null
          id?: string
          inspection_id: string
          issue_description: string
          order_id: string
          requested_by_id: string
          requested_by_name: string
          resolved_at?: string | null
          resolved_by_id?: string | null
          resolved_by_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_responded_at?: string | null
          customer_response?: string | null
          estimated_cost?: number | null
          id?: string
          inspection_id?: string
          issue_description?: string
          order_id?: string
          requested_by_id?: string
          requested_by_name?: string
          resolved_at?: string | null
          resolved_by_id?: string | null
          resolved_by_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_issues_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "bicycle_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_issues_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_issues_requested_by_id_fkey"
            columns: ["requested_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_issues_resolved_by_id_fkey"
            columns: ["resolved_by_id"]
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
          bike_type: string | null
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
          needs_inspection: boolean | null
          needs_payment_on_collection: boolean | null
          optimoroute_delivery_id: string | null
          optimoroute_pickup_id: string | null
          order_collected: boolean | null
          order_delivered: boolean | null
          payment_collection_phone: string | null
          pickup_date: Json | null
          pickup_timeslot: string | null
          receiver: Json
          receiver_confirmed_at: string | null
          receiver_contact_id: string | null
          receiver_notes: string | null
          scheduled_at: string | null
          scheduled_delivery_date: string | null
          scheduled_pickup_date: string | null
          sender: Json
          sender_confirmed_at: string | null
          sender_contact_id: string | null
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
          bike_type?: string | null
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
          needs_inspection?: boolean | null
          needs_payment_on_collection?: boolean | null
          optimoroute_delivery_id?: string | null
          optimoroute_pickup_id?: string | null
          order_collected?: boolean | null
          order_delivered?: boolean | null
          payment_collection_phone?: string | null
          pickup_date?: Json | null
          pickup_timeslot?: string | null
          receiver: Json
          receiver_confirmed_at?: string | null
          receiver_contact_id?: string | null
          receiver_notes?: string | null
          scheduled_at?: string | null
          scheduled_delivery_date?: string | null
          scheduled_pickup_date?: string | null
          sender: Json
          sender_confirmed_at?: string | null
          sender_contact_id?: string | null
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
          bike_type?: string | null
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
          needs_inspection?: boolean | null
          needs_payment_on_collection?: boolean | null
          optimoroute_delivery_id?: string | null
          optimoroute_pickup_id?: string | null
          order_collected?: boolean | null
          order_delivered?: boolean | null
          payment_collection_phone?: string | null
          pickup_date?: Json | null
          pickup_timeslot?: string | null
          receiver?: Json
          receiver_confirmed_at?: string | null
          receiver_contact_id?: string | null
          receiver_notes?: string | null
          scheduled_at?: string | null
          scheduled_delivery_date?: string | null
          scheduled_pickup_date?: string | null
          sender?: Json
          sender_confirmed_at?: string | null
          sender_contact_id?: string | null
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
            foreignKeyName: "orders_receiver_contact_id_fkey"
            columns: ["receiver_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_sender_contact_id_fkey"
            columns: ["sender_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
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
          shipday_driver_name: string | null
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
          shipday_driver_name?: string | null
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
          shipday_driver_name?: string | null
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
          mileage: number | null
          quickbooks_bill_created_at: string | null
          quickbooks_bill_id: string | null
          quickbooks_bill_number: string | null
          quickbooks_bill_url: string | null
          route_links: string[] | null
          status: string
          stop_hours: number
          total_hours: number | null
          total_jobs: number | null
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
          mileage?: number | null
          quickbooks_bill_created_at?: string | null
          quickbooks_bill_id?: string | null
          quickbooks_bill_number?: string | null
          quickbooks_bill_url?: string | null
          route_links?: string[] | null
          status: string
          stop_hours?: number
          total_hours?: number | null
          total_jobs?: number | null
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
          mileage?: number | null
          quickbooks_bill_created_at?: string | null
          quickbooks_bill_id?: string | null
          quickbooks_bill_number?: string | null
          quickbooks_bill_url?: string | null
          route_links?: string[] | null
          status?: string
          stop_hours?: number
          total_hours?: number | null
          total_jobs?: number | null
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
      webhook_configurations: {
        Row: {
          created_at: string | null
          endpoint_url: string
          events: string[] | null
          id: string
          is_active: boolean | null
          last_delivery_status: string | null
          last_error_message: string | null
          last_triggered_at: string | null
          name: string
          secret_hash: string
          secret_prefix: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          endpoint_url: string
          events?: string[] | null
          id?: string
          is_active?: boolean | null
          last_delivery_status?: string | null
          last_error_message?: string | null
          last_triggered_at?: string | null
          name: string
          secret_hash: string
          secret_prefix: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          endpoint_url?: string
          events?: string[] | null
          id?: string
          is_active?: boolean | null
          last_delivery_status?: string | null
          last_error_message?: string | null
          last_triggered_at?: string | null
          name?: string
          secret_hash?: string
          secret_prefix?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_configurations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_delivery_logs: {
        Row: {
          attempt_number: number | null
          delivered_at: string | null
          delivery_duration_ms: number | null
          event_type: string
          id: string
          order_id: string | null
          payload: Json
          response_body: string | null
          response_status: number | null
          success: boolean | null
          webhook_config_id: string | null
        }
        Insert: {
          attempt_number?: number | null
          delivered_at?: string | null
          delivery_duration_ms?: number | null
          event_type: string
          id?: string
          order_id?: string | null
          payload: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean | null
          webhook_config_id?: string | null
        }
        Update: {
          attempt_number?: number | null
          delivered_at?: string | null
          delivery_duration_ms?: number | null
          event_type?: string
          id?: string
          order_id?: string | null
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean | null
          webhook_config_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_delivery_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_delivery_logs_webhook_config_id_fkey"
            columns: ["webhook_config_id"]
            isOneToOne: false
            referencedRelation: "webhook_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_checkin_bonuses: {
        Row: {
          bonus_awarded: boolean
          compliance_percentage: number | null
          created_at: string | null
          driver_id: string
          id: string
          on_time_checkins: number
          timeslip_id: string | null
          total_checkins: number
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          bonus_awarded?: boolean
          compliance_percentage?: number | null
          created_at?: string | null
          driver_id: string
          id?: string
          on_time_checkins: number
          timeslip_id?: string | null
          total_checkins: number
          week_end_date: string
          week_start_date: string
        }
        Update: {
          bonus_awarded?: boolean
          compliance_percentage?: number | null
          created_at?: string | null
          driver_id?: string
          id?: string
          on_time_checkins?: number
          timeslip_id?: string | null
          total_checkins?: number
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_checkin_bonuses_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_checkin_bonuses_timeslip_id_fkey"
            columns: ["timeslip_id"]
            isOneToOne: false
            referencedRelation: "timeslips"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_plans: {
        Row: {
          created_at: string | null
          day_of_week: number
          driver_index: number
          id: string
          is_optimized: boolean | null
          job_data: Json
          region: string | null
          total_distance_miles: number | null
          updated_at: string | null
          week_start: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          driver_index: number
          id?: string
          is_optimized?: boolean | null
          job_data?: Json
          region?: string | null
          total_distance_miles?: number | null
          updated_at?: string | null
          week_start: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          driver_index?: number
          id?: string
          is_optimized?: boolean | null
          job_data?: Json
          region?: string | null
          total_distance_miles?: number | null
          updated_at?: string | null
          week_start?: string
        }
        Relationships: []
      }
      whatsapp_outbox: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string | null
          error: string | null
          from_number: string
          id: string
          job_type: string | null
          last_attempt_at: string | null
          message: string
          order_id: string | null
          request_id: string | null
          sent_at: string | null
          status: string
          to_number: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          from_number: string
          id?: string
          job_type?: string | null
          last_attempt_at?: string | null
          message: string
          order_id?: string | null
          request_id?: string | null
          sent_at?: string | null
          status?: string
          to_number: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          from_number?: string
          id?: string
          job_type?: string | null
          last_attempt_at?: string | null
          message?: string
          order_id?: string | null
          request_id?: string | null
          sent_at?: string | null
          status?: string
          to_number?: string
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
      admin_generate_webhook_secret: {
        Args: {
          p_endpoint_url: string
          p_events: string[]
          p_name: string
          p_user_id: string
        }
        Returns: {
          config_id: string
          webhook_secret: string
        }[]
      }
      admin_revoke_api_key: { Args: { key_id: string }; Returns: boolean }
      admin_revoke_webhook: { Args: { p_config_id: string }; Returns: boolean }
      admin_update_account_status: {
        Args: { status: string; user_id: string }
        Returns: boolean
      }
      calculate_weekly_checkin_compliance: {
        Args: { p_driver_id: string; p_week_end: string; p_week_start: string }
        Returns: {
          compliance_percentage: number
          on_time_checkins: number
          total_checkins: number
        }[]
      }
      create_webhook_secret: {
        Args: { p_name: string; p_secret: string }
        Returns: string
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
          shipday_driver_name: string | null
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
      get_vault_secret: { Args: { secret_name: string }; Returns: string }
      get_webhook_event_for_status: {
        Args: { new_status: string; old_status: string }
        Returns: string
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
      validate_checkin_location: {
        Args: { p_lat: number; p_lon: number }
        Returns: {
          distance_meters: number
          error_message: string
          is_valid: boolean
        }[]
      }
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
        | "mechanic"
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
        "mechanic",
      ],
    },
  },
} as const
