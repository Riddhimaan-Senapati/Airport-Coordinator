export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      airport_catalog_state: {
        Row: {
          activated_at: string | null
          active_generation: string | null
          singleton: boolean
        }
        Insert: {
          activated_at?: string | null
          active_generation?: string | null
          singleton?: boolean
        }
        Update: {
          activated_at?: string | null
          active_generation?: string | null
          singleton?: boolean
        }
        Relationships: []
      }
      airports: {
        Row: {
          catalog_generation: string
          country_code: string
          country_name: string
          gps_code: string | null
          iata_code: string | null
          id: number
          ident: string
          latitude: number
          longitude: number
          municipality: string | null
          name: string
          search_text: string | null
          timezone: string
          type: string
        }
        Insert: {
          catalog_generation: string
          country_code: string
          country_name: string
          gps_code?: string | null
          iata_code?: string | null
          id: number
          ident: string
          latitude: number
          longitude: number
          municipality?: string | null
          name: string
          search_text?: string | null
          timezone: string
          type: string
        }
        Update: {
          catalog_generation?: string
          country_code?: string
          country_name?: string
          gps_code?: string | null
          iata_code?: string | null
          id?: number
          ident?: string
          latitude?: number
          longitude?: number
          municipality?: string | null
          name?: string
          search_text?: string | null
          timezone?: string
          type?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          airport_generation: string
          airport_id: number
          consent_high: boolean
          consent_low: boolean
          created_at: string
          id: string
          overlap_end: string
          overlap_start: string
          revision_high: number
          revision_low: number
          updated_at: string
          user_high: string
          user_low: string
        }
        Insert: {
          airport_generation: string
          airport_id: number
          consent_high?: boolean
          consent_low?: boolean
          created_at?: string
          id?: string
          overlap_end: string
          overlap_start: string
          revision_high: number
          revision_low: number
          updated_at?: string
          user_high: string
          user_low: string
        }
        Update: {
          airport_generation?: string
          airport_id?: number
          consent_high?: boolean
          consent_low?: boolean
          created_at?: string
          id?: string
          overlap_end?: string
          overlap_start?: string
          revision_high?: number
          revision_low?: number
          updated_at?: string
          user_high?: string
          user_low?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_airport_generation_airport_id_fkey"
            columns: ["airport_generation", "airport_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["catalog_generation", "id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempt_count: number
          available_at: string
          created_at: string
          dedupe_key: string
          id: string
          kind: string
          last_error: string | null
          lease_token: string | null
          leased_until: string | null
          match_id: string | null
          payload: Json
          recipient_user_id: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          created_at?: string
          dedupe_key: string
          id?: string
          kind: string
          last_error?: string | null
          lease_token?: string | null
          leased_until?: string | null
          match_id?: string | null
          payload?: Json
          recipient_user_id: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          created_at?: string
          dedupe_key?: string
          id?: string
          kind?: string
          last_error?: string | null
          lease_token?: string | null
          leased_until?: string | null
          match_id?: string | null
          payload?: Json
          recipient_user_id?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          airport_generation: string
          airport_id: number
          arrival_at: string
          created_at: string
          revision: number
          updated_at: string
          user_id: string
          wait_hours: number
          wait_until: string
        }
        Insert: {
          airport_generation: string
          airport_id: number
          arrival_at: string
          created_at?: string
          revision?: number
          updated_at?: string
          user_id: string
          wait_hours: number
          wait_until: string
        }
        Update: {
          airport_generation?: string
          airport_id?: number
          arrival_at?: string
          created_at?: string
          revision?: number
          updated_at?: string
          user_id?: string
          wait_hours?: number
          wait_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_airport_generation_airport_id_fkey"
            columns: ["airport_generation", "airport_id"]
            isOneToOne: false
            referencedRelation: "airports"
            referencedColumns: ["catalog_generation", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_notification_batch: {
        Args: {
          p_batch_size?: number
          p_lease_seconds?: number
          p_worker_id: string
        }
        Returns: {
          attempt_count: number
          available_at: string
          created_at: string
          dedupe_key: string
          id: string
          kind: string
          last_error: string | null
          lease_token: string | null
          leased_until: string | null
          match_id: string | null
          payload: Json
          recipient_user_id: string
          sent_at: string | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_notification: {
        Args: { p_notification_id: string; p_worker_id: string }
        Returns: boolean
      }
      delete_my_trip: { Args: never; Returns: boolean }
      fail_notification: {
        Args: {
          p_error: string
          p_notification_id: string
          p_worker_id: string
        }
        Returns: boolean
      }
      get_trip_dashboard: { Args: never; Returns: Json }
      notification_is_deliverable: {
        Args: { p_notification_id: string; p_worker_id: string }
        Returns: boolean
      }
      prune_airport_catalog: {
        Args: { p_batch_size?: number }
        Returns: number
      }
      reconcile_airport_catalog: {
        Args: { p_generation: string }
        Returns: number
      }
      require_umass_user: { Args: never; Returns: string }
      restrict_signup_to_umass: { Args: { event: Json }; Returns: Json }
      save_trip_and_find_matches: {
        Args: {
          p_airport_id: number
          p_arrival_at: string
          p_wait_hours: number
        }
        Returns: Json
      }
      search_airports: {
        Args: { query: string; result_limit?: number }
        Returns: {
          code: string
          country_code: string
          country_name: string
          gps_code: string
          iata_code: string
          id: number
          ident: string
          latitude: number
          longitude: number
          municipality: string
          name: string
          score: number
          timezone: string
          type: string
        }[]
      }
      set_match_consent: {
        Args: { p_consented: boolean; p_match_id: string }
        Returns: Json
      }
      trip_json: {
        Args: { trip: Database["public"]["Tables"]["trips"]["Row"] }
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
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
    Enums: {},
  },
} as const

