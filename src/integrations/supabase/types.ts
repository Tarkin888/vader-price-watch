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
      lots: {
        Row: {
          buyers_premium_gbp: number
          capture_date: string
          condition_notes: string
          created_at: string
          grade_subgrades: string
          grade_tier_code: Database["public"]["Enums"]["grade_tier_code"]
          hammer_price_gbp: number
          id: string
          image_urls: string[]
          lot_ref: string
          lot_url: string
          sale_date: string
          source: Database["public"]["Enums"]["lot_source"]
          total_paid_gbp: number
          updated_at: string
          usd_to_gbp_rate: number
          variant_code: Database["public"]["Enums"]["variant_code"]
          variant_grade_key: string
        }
        Insert: {
          buyers_premium_gbp?: number
          capture_date: string
          condition_notes?: string
          created_at?: string
          grade_subgrades?: string
          grade_tier_code: Database["public"]["Enums"]["grade_tier_code"]
          hammer_price_gbp?: number
          id?: string
          image_urls?: string[]
          lot_ref?: string
          lot_url?: string
          sale_date: string
          source: Database["public"]["Enums"]["lot_source"]
          total_paid_gbp?: number
          updated_at?: string
          usd_to_gbp_rate?: number
          variant_code: Database["public"]["Enums"]["variant_code"]
          variant_grade_key?: string
        }
        Update: {
          buyers_premium_gbp?: number
          capture_date?: string
          condition_notes?: string
          created_at?: string
          grade_subgrades?: string
          grade_tier_code?: Database["public"]["Enums"]["grade_tier_code"]
          hammer_price_gbp?: number
          id?: string
          image_urls?: string[]
          lot_ref?: string
          lot_url?: string
          sale_date?: string
          source?: Database["public"]["Enums"]["lot_source"]
          total_paid_gbp?: number
          updated_at?: string
          usd_to_gbp_rate?: number
          variant_code?: Database["public"]["Enums"]["variant_code"]
          variant_grade_key?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
      lot_source: "Heritage" | "Hakes" | "Vectis" | "LCG"
      variant_code: "12A" | "12B" | "12C" | "12A-DT" | "12B-DT" | "CAN" | "PAL"
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
      ],
      lot_source: ["Heritage", "Hakes", "Vectis", "LCG"],
      variant_code: ["12A", "12B", "12C", "12A-DT", "12B-DT", "CAN", "PAL"],
    },
  },
} as const
