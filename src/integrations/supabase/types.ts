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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_config: {
        Row: {
          key: string
          label: string | null
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          label?: string | null
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          label?: string | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          field_changed: string | null
          id: string
          lot_id: string | null
          lot_ref: string | null
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          field_changed?: string | null
          id?: string
          lot_id?: string | null
          lot_ref?: string | null
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          field_changed?: string | null
          id?: string
          lot_id?: string | null
          lot_ref?: string | null
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: []
      }
      bug_reports: {
        Row: {
          category: string
          created_at: string | null
          description: string
          id: string
          lot_ref: string | null
          resolution_notes: string | null
          resolved_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description: string
          id?: string
          lot_ref?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          lot_ref?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          message_type: string
          metadata: Json
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          message_type?: string
          metadata?: Json
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          message_type?: string
          metadata?: Json
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          session_type: string
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          session_type?: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          session_type?: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chatbot_feedback: {
        Row: {
          category: string | null
          created_at: string
          description: string
          feedback_type: string
          id: string
          metadata: Json
          priority: string
          session_id: string | null
          status: string
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description: string
          feedback_type: string
          id?: string
          metadata?: Json
          priority?: string
          session_id?: string | null
          status?: string
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string
          feedback_type?: string
          id?: string
          metadata?: Json
          priority?: string
          session_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      collection: {
        Row: {
          back_image_url: string | null
          category: string
          created_at: string
          current_estimated_value: number | null
          description: string
          estimation_tier: string | null
          front_image_url: string | null
          grading: string
          id: string
          image_urls: string[]
          item_id: string
          notes: string
          purchase_date: string
          purchase_price: number
          purchase_source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          back_image_url?: string | null
          category?: string
          created_at?: string
          current_estimated_value?: number | null
          description?: string
          estimation_tier?: string | null
          front_image_url?: string | null
          grading?: string
          id?: string
          image_urls?: string[]
          item_id: string
          notes?: string
          purchase_date: string
          purchase_price?: number
          purchase_source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          back_image_url?: string | null
          category?: string
          created_at?: string
          current_estimated_value?: number | null
          description?: string
          estimation_tier?: string | null
          front_image_url?: string | null
          grading?: string
          id?: string
          image_urls?: string[]
          item_id?: string
          notes?: string
          purchase_date?: string
          purchase_price?: number
          purchase_source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge_articles: {
        Row: {
          category: string
          confidence: string | null
          content_md: string
          created_at: string | null
          display_order: number | null
          id: string
          image_urls: string[] | null
          is_published: boolean | null
          last_researched: string | null
          slug: string
          source_urls: string[] | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          confidence?: string | null
          content_md?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_urls?: string[] | null
          is_published?: boolean | null
          last_researched?: string | null
          slug: string
          source_urls?: string[] | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          confidence?: string | null
          content_md?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_urls?: string[] | null
          is_published?: boolean | null
          last_researched?: string | null
          slug?: string
          source_urls?: string[] | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lots: {
        Row: {
          buyers_premium_gbp: number | null
          capture_date: string
          cardback_code: string
          condition_notes: string
          created_at: string
          era: Database["public"]["Enums"]["lot_era"]
          estimate_high_gbp: number | null
          estimate_low_gbp: number | null
          grade_subgrades: string
          grade_tier_code: Database["public"]["Enums"]["grade_tier_code"]
          hammer_price_gbp: number | null
          id: string
          image_urls: string[]
          lot_ref: string
          lot_url: string
          price_status: string
          sale_date: string
          source: Database["public"]["Enums"]["lot_source"]
          total_paid_gbp: number | null
          updated_at: string
          usd_to_gbp_rate: number
          variant_code: Database["public"]["Enums"]["variant_code"]
          variant_grade_key: string
        }
        Insert: {
          buyers_premium_gbp?: number | null
          capture_date: string
          cardback_code?: string
          condition_notes?: string
          created_at?: string
          era?: Database["public"]["Enums"]["lot_era"]
          estimate_high_gbp?: number | null
          estimate_low_gbp?: number | null
          grade_subgrades?: string
          grade_tier_code: Database["public"]["Enums"]["grade_tier_code"]
          hammer_price_gbp?: number | null
          id?: string
          image_urls?: string[]
          lot_ref?: string
          lot_url?: string
          price_status?: string
          sale_date: string
          source: Database["public"]["Enums"]["lot_source"]
          total_paid_gbp?: number | null
          updated_at?: string
          usd_to_gbp_rate?: number
          variant_code: Database["public"]["Enums"]["variant_code"]
          variant_grade_key?: string
        }
        Update: {
          buyers_premium_gbp?: number | null
          capture_date?: string
          cardback_code?: string
          condition_notes?: string
          created_at?: string
          era?: Database["public"]["Enums"]["lot_era"]
          estimate_high_gbp?: number | null
          estimate_low_gbp?: number | null
          grade_subgrades?: string
          grade_tier_code?: Database["public"]["Enums"]["grade_tier_code"]
          hammer_price_gbp?: number | null
          id?: string
          image_urls?: string[]
          lot_ref?: string
          lot_url?: string
          price_status?: string
          sale_date?: string
          source?: Database["public"]["Enums"]["lot_source"]
          total_paid_gbp?: number | null
          updated_at?: string
          usd_to_gbp_rate?: number
          variant_code?: Database["public"]["Enums"]["variant_code"]
          variant_grade_key?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          id: string
          page: string | null
          user_agent: string | null
          viewed_at: string | null
        }
        Insert: {
          id?: string
          page?: string | null
          user_agent?: string | null
          viewed_at?: string | null
        }
        Update: {
          id?: string
          page?: string | null
          user_agent?: string | null
          viewed_at?: string | null
        }
        Relationships: []
      }
      scraper_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          duration_seconds: number | null
          error_message: string | null
          id: string
          records_captured: number | null
          records_skipped: number | null
          source: string
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          records_captured?: number | null
          records_skipped?: number | null
          source: string
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          records_captured?: number | null
          records_skipped?: number | null
          source?: string
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string
          id: string
          last_sign_in_at: string | null
          rejected_at: string | null
          rejection_reason: string | null
          role: string
          status: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email: string
          id: string
          last_sign_in_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          role?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string
          id?: string
          last_sign_in_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          role?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { check_user_id: string }; Returns: boolean }
      repair_owner_account: { Args: never; Returns: undefined }
      verify_admin_pin: { Args: { pin_input: string }; Returns: boolean }
    }
    Enums: {
      grade_tier_code:
        | "RAW-NM"
        | "RAW-EX"
        | "RAW-VG"
        | "AFA-70"
        | "AFA-75"
        | "AFA-80"
        | "AFA-85"
        | "AFA-90+"
        | "UKG-80"
        | "UKG-85"
        | "CAS-80"
        | "UNKNOWN"
        | "UKG-90"
        | "UKG-70"
        | "GRADED-UNKNOWN"
        | "AFA-40"
        | "AFA-50"
        | "AFA-60"
        | "CAS-70"
        | "CAS-85"
        | "CAS-75"
        | "UKG-75"
      lot_era: "SW" | "ESB" | "ROTJ" | "POTF" | "UNKNOWN"
      lot_source:
        | "Heritage"
        | "Hakes"
        | "Vectis"
        | "LCG"
        | "CandT"
        | "eBay"
        | "Facebook"
        | "Other"
      variant_code:
        | "12A"
        | "12B"
        | "12C"
        | "12A-DT"
        | "12B-DT"
        | "CAN"
        | "PAL"
        | "MEX"
        | "VP"
        | "SW-12"
        | "SW-12A"
        | "SW-12A-DT"
        | "SW-12B"
        | "SW-12B-DT"
        | "SW-12C"
        | "SW-20"
        | "SW-21"
        | "ESB-31"
        | "ESB-32"
        | "ESB-41"
        | "ESB-45"
        | "ESB-47"
        | "ESB-48"
        | "ROTJ-48"
        | "ROTJ-65"
        | "ROTJ-65-VP"
        | "ROTJ-77"
        | "ROTJ-79"
        | "POTF-92"
        | "UNKNOWN"
        | "TAK"
        | "CLIP"
        | "ROTJ-65A"
        | "ROTJ-65B"
        | "ROTJ-65D"
        | "ROTJ-79A"
        | "ROTJ-79B"
        | "PAL-TL"
        | "PBP"
        | "SW-12-DT"
        | "TT"
        | "HAR"
        | "ROTJ-70"
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
      grade_tier_code: [
        "RAW-NM",
        "RAW-EX",
        "RAW-VG",
        "AFA-70",
        "AFA-75",
        "AFA-80",
        "AFA-85",
        "AFA-90+",
        "UKG-80",
        "UKG-85",
        "CAS-80",
        "UNKNOWN",
        "UKG-90",
        "UKG-70",
        "GRADED-UNKNOWN",
        "AFA-40",
        "AFA-50",
        "AFA-60",
        "CAS-70",
        "CAS-85",
        "CAS-75",
        "UKG-75",
      ],
      lot_era: ["SW", "ESB", "ROTJ", "POTF", "UNKNOWN"],
      lot_source: [
        "Heritage",
        "Hakes",
        "Vectis",
        "LCG",
        "CandT",
        "eBay",
        "Facebook",
        "Other",
      ],
      variant_code: [
        "12A",
        "12B",
        "12C",
        "12A-DT",
        "12B-DT",
        "CAN",
        "PAL",
        "MEX",
        "VP",
        "SW-12",
        "SW-12A",
        "SW-12A-DT",
        "SW-12B",
        "SW-12B-DT",
        "SW-12C",
        "SW-20",
        "SW-21",
        "ESB-31",
        "ESB-32",
        "ESB-41",
        "ESB-45",
        "ESB-47",
        "ESB-48",
        "ROTJ-48",
        "ROTJ-65",
        "ROTJ-65-VP",
        "ROTJ-77",
        "ROTJ-79",
        "POTF-92",
        "UNKNOWN",
        "TAK",
        "CLIP",
        "ROTJ-65A",
        "ROTJ-65B",
        "ROTJ-65D",
        "ROTJ-79A",
        "ROTJ-79B",
        "PAL-TL",
        "PBP",
        "SW-12-DT",
        "TT",
        "HAR",
        "ROTJ-70",
      ],
    },
  },
} as const
