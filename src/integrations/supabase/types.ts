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
  public: {
    Tables: {
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          expense_date: string
          household_id: string
          id: string
          merchant: string
          profile_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          expense_date?: string
          household_id: string
          id?: string
          merchant: string
          profile_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          expense_date?: string
          household_id?: string
          id?: string
          merchant?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          household_id: string
          id: string
          name: string
          profile_id: string
          saved: number
          target: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          name: string
          profile_id: string
          saved?: number
          target: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          profile_id?: string
          saved?: number
          target?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          monthly_budget: number | null
          name: string
          owner_id: string
          savings_goal: number | null
          savings_goal_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code: string
          monthly_budget?: number | null
          name: string
          owner_id: string
          savings_goal?: number | null
          savings_goal_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          monthly_budget?: number | null
          name?: string
          owner_id?: string
          savings_goal?: number | null
          savings_goal_name?: string | null
        }
        Relationships: []
      }
      owner_passkeys: {
        Row: {
          counter: number
          created_at: string
          credential_id: string
          device_label: string | null
          id: string
          last_used_at: string | null
          public_key: string
          transports: string | null
          user_id: string
        }
        Insert: {
          counter?: number
          created_at?: string
          credential_id: string
          device_label?: string | null
          id?: string
          last_used_at?: string | null
          public_key: string
          transports?: string | null
          user_id: string
        }
        Update: {
          counter?: number
          created_at?: string
          credential_id?: string
          device_label?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string
          transports?: string | null
          user_id?: string
        }
        Relationships: []
      }
      passkey_challenges: {
        Row: {
          challenge: string
          created_at: string
          kind: string
          user_id: string
        }
        Insert: {
          challenge: string
          created_at?: string
          kind: string
          user_id: string
        }
        Update: {
          challenge?: string
          created_at?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_balance: number
          account_type: string
          avatar_url: string | null
          created_at: string
          full_name: string
          gender: string | null
          household_id: string
          id: string
          link_code: string
          member_role: string | null
          onboarded: boolean
          role: string
          username: string
        }
        Insert: {
          account_balance?: number
          account_type?: string
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          gender?: string | null
          household_id: string
          id: string
          link_code: string
          member_role?: string | null
          onboarded?: boolean
          role?: string
          username: string
        }
        Update: {
          account_balance?: number
          account_type?: string
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          gender?: string | null
          household_id?: string
          id?: string
          link_code?: string
          member_role?: string | null
          onboarded?: boolean
          role?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          household_id: string
          id: string
          meta: Json | null
          quest_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          household_id: string
          id?: string
          meta?: Json | null
          quest_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          household_id?: string
          id?: string
          meta?: Json | null
          quest_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_audit_log_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quest_audit_log_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_proofs: {
        Row: {
          created_at: string
          id: string
          image_path: string
          quest_id: string
          uploader_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_path: string
          quest_id: string
          uploader_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string
          quest_id?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_proofs_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      quests: {
        Row: {
          assignee_id: string
          completed_at: string | null
          created_at: string
          decided_at: string | null
          description: string | null
          due_date: string | null
          household_id: string
          id: string
          owner_id: string
          rejection_reason: string | null
          reward: number
          savings_split_pct: number | null
          status: Database["public"]["Enums"]["quest_status"]
          submitted_notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id: string
          completed_at?: string | null
          created_at?: string
          decided_at?: string | null
          description?: string | null
          due_date?: string | null
          household_id: string
          id?: string
          owner_id: string
          rejection_reason?: string | null
          reward: number
          savings_split_pct?: number | null
          status?: Database["public"]["Enums"]["quest_status"]
          submitted_notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string
          completed_at?: string | null
          created_at?: string
          decided_at?: string | null
          description?: string | null
          due_date?: string | null
          household_id?: string
          id?: string
          owner_id?: string
          rejection_reason?: string | null
          reward?: number
          savings_split_pct?: number | null
          status?: Database["public"]["Enums"]["quest_status"]
          submitted_notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quests_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          amount: number
          created_at: string
          from_profile_id: string
          household_id: string
          id: string
          note: string | null
          to_profile_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          from_profile_id: string
          household_id: string
          id?: string
          note?: string | null
          to_profile_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_profile_id?: string
          household_id?: string
          id?: string
          note?: string | null
          to_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_from_profile_id_fkey"
            columns: ["from_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_to_profile_id_fkey"
            columns: ["to_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      savings: {
        Row: {
          amount: number
          created_at: string
          household_id: string
          id: string
          note: string | null
          profile_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          household_id: string
          id?: string
          note?: string | null
          profile_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          household_id?: string
          id?: string
          note?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_payments: {
        Row: {
          amount: number
          category: string
          created_at: string
          frequency: string
          household_id: string
          icon: string | null
          id: string
          last_paid_at: string | null
          last_reminded_on: string | null
          name: string
          next_due_date: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          frequency?: string
          household_id: string
          icon?: string | null
          id?: string
          last_paid_at?: string | null
          last_reminded_on?: string | null
          name: string
          next_due_date: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          frequency?: string
          household_id?: string
          icon?: string | null
          id?: string
          last_paid_at?: string | null
          last_reminded_on?: string | null
          name?: string
          next_due_date?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_payments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_household_id: { Args: never; Returns: string }
      is_household_owner: { Args: never; Returns: boolean }
    }
    Enums: {
      quest_status:
        | "pending_acceptance"
        | "declined"
        | "accepted"
        | "submitted"
        | "approved"
        | "rejected"
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
      quest_status: [
        "pending_acceptance",
        "declined",
        "accepted",
        "submitted",
        "approved",
        "rejected",
      ],
    },
  },
} as const
