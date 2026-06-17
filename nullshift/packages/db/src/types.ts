// Generated from the Supabase schema (Phase 1 multi-tenant core).
// Regenerate with the Supabase MCP `generate_typescript_types` or
// `supabase gen types typescript` after any migration.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor: string | null;
          created_at: string;
          id: string;
          metadata: Json | null;
          target: string | null;
          tenant_id: string | null;
        };
        Insert: {
          action: string;
          actor?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          target?: string | null;
          tenant_id?: string | null;
        };
        Update: {
          action?: string;
          actor?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          target?: string | null;
          tenant_id?: string | null;
        };
        Relationships: [];
      };
      change_requests: {
        Row: {
          approved_at: string | null;
          created_at: string;
          description: string;
          estimate_hours: number | null;
          id: string;
          project_id: string;
          quoted_price: number | null;
          status: Database["public"]["Enums"]["change_request_status"];
          submitted_by: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          created_at?: string;
          description: string;
          estimate_hours?: number | null;
          id?: string;
          project_id: string;
          quoted_price?: number | null;
          status?: Database["public"]["Enums"]["change_request_status"];
          submitted_by?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          created_at?: string;
          description?: string;
          estimate_hours?: number | null;
          id?: string;
          project_id?: string;
          quoted_price?: number | null;
          status?: Database["public"]["Enums"]["change_request_status"];
          submitted_by?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      compliance_records: {
        Row: {
          detail: Json | null;
          id: string;
          kind: Database["public"]["Enums"]["compliance_kind"];
          recorded_at: string;
          tenant_id: string;
        };
        Insert: {
          detail?: Json | null;
          id?: string;
          kind: Database["public"]["Enums"]["compliance_kind"];
          recorded_at?: string;
          tenant_id: string;
        };
        Update: {
          detail?: Json | null;
          id?: string;
          kind?: Database["public"]["Enums"]["compliance_kind"];
          recorded_at?: string;
          tenant_id?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["document_kind"];
          project_id: string | null;
          storage_path: string;
          tenant_id: string;
          uploaded_by: string | null;
          version: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["document_kind"];
          project_id?: string | null;
          storage_path: string;
          tenant_id: string;
          uploaded_by?: string | null;
          version?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["document_kind"];
          project_id?: string | null;
          storage_path?: string;
          tenant_id?: string;
          uploaded_by?: string | null;
          version?: number;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          amount: number;
          created_at: string;
          due_at: string | null;
          id: string;
          paid_at: string | null;
          project_id: string | null;
          status: Database["public"]["Enums"]["invoice_status"];
          stripe_invoice_id: string | null;
          tenant_id: string;
          type: Database["public"]["Enums"]["invoice_type"];
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          due_at?: string | null;
          id?: string;
          paid_at?: string | null;
          project_id?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          stripe_invoice_id?: string | null;
          tenant_id: string;
          type: Database["public"]["Enums"]["invoice_type"];
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          due_at?: string | null;
          id?: string;
          paid_at?: string | null;
          project_id?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          stripe_invoice_id?: string | null;
          tenant_id?: string;
          type?: Database["public"]["Enums"]["invoice_type"];
          updated_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
          lead_score: number | null;
          name: string | null;
          notes: string | null;
          quiz_answers: Json | null;
          source: string | null;
          status: Database["public"]["Enums"]["lead_status"];
          tenant_id: string;
          updated_at: string;
          vertical: string | null;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id?: string;
          lead_score?: number | null;
          name?: string | null;
          notes?: string | null;
          quiz_answers?: Json | null;
          source?: string | null;
          status?: Database["public"]["Enums"]["lead_status"];
          tenant_id: string;
          updated_at?: string;
          vertical?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: string;
          lead_score?: number | null;
          name?: string | null;
          notes?: string | null;
          quiz_answers?: Json | null;
          source?: string | null;
          status?: Database["public"]["Enums"]["lead_status"];
          tenant_id?: string;
          updated_at?: string;
          vertical?: string | null;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["membership_role"];
          tenant_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["membership_role"];
          tenant_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["membership_role"];
          tenant_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          build_fee: number | null;
          created_at: string;
          id: string;
          name: string;
          stage: Database["public"]["Enums"]["project_stage"];
          started_at: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          build_fee?: number | null;
          created_at?: string;
          id?: string;
          name: string;
          stage?: Database["public"]["Enums"]["project_stage"];
          started_at?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          build_fee?: number | null;
          created_at?: string;
          id?: string;
          name?: string;
          stage?: Database["public"]["Enums"]["project_stage"];
          started_at?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          created_at: string;
          id: string;
          mrr: number;
          plan: Database["public"]["Enums"]["subscription_plan"];
          started_at: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          stripe_subscription_id: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          mrr?: number;
          plan: Database["public"]["Enums"]["subscription_plan"];
          started_at?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          stripe_subscription_id?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          mrr?: number;
          plan?: Database["public"]["Enums"]["subscription_plan"];
          started_at?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          stripe_subscription_id?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          assignee: string | null;
          created_at: string;
          detail: string | null;
          estimate_hours: number | null;
          id: string;
          origin: Database["public"]["Enums"]["task_origin"];
          project_id: string;
          status: Database["public"]["Enums"]["task_status"];
          tenant_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          assignee?: string | null;
          created_at?: string;
          detail?: string | null;
          estimate_hours?: number | null;
          id?: string;
          origin?: Database["public"]["Enums"]["task_origin"];
          project_id: string;
          status?: Database["public"]["Enums"]["task_status"];
          tenant_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          assignee?: string | null;
          created_at?: string;
          detail?: string | null;
          estimate_hours?: number | null;
          id?: string;
          origin?: Database["public"]["Enums"]["task_origin"];
          project_id?: string;
          status?: Database["public"]["Enums"]["task_status"];
          tenant_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tenants: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          status: string;
          type: Database["public"]["Enums"]["tenant_type"];
          updated_at: string;
          vertical: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          status?: string;
          type?: Database["public"]["Enums"]["tenant_type"];
          updated_at?: string;
          vertical?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          status?: string;
          type?: Database["public"]["Enums"]["tenant_type"];
          updated_at?: string;
          vertical?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_internal_staff: { Args: Record<never, never>; Returns: boolean };
      is_member_of: { Args: { tid: string }; Returns: boolean };
      is_tenant_admin: { Args: { tid: string }; Returns: boolean };
    };
    Enums: {
      change_request_status:
        | "submitted"
        | "triaged"
        | "scoped"
        | "awaiting_approval"
        | "approved"
        | "rejected"
        | "shipped";
      compliance_kind: "dpa_signed" | "data_register" | "breach" | "sar" | "backup_check";
      document_kind: "asset" | "contract" | "dpa" | "consent" | "brief";
      invoice_status: "draft" | "open" | "paid" | "void" | "uncollectible";
      invoice_type: "build_milestone" | "one_off";
      lead_status: "new" | "qualified" | "call_booked" | "won" | "lost";
      membership_role: "owner" | "staff" | "client_admin" | "client_member";
      project_stage: "discovery" | "build" | "review" | "live" | "care";
      subscription_plan: "care_basic" | "care_pro" | "transaction";
      subscription_status: "trialing" | "active" | "past_due" | "canceled" | "incomplete";
      task_origin: "internal" | "client";
      task_status:
        | "backlog"
        | "scoped"
        | "approved"
        | "in_progress"
        | "review"
        | "shipped";
      tenant_type: "internal" | "client";
    };
    CompositeTypes: Record<never, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];

// Convenience row aliases for the multi-tenant core.
export type Tenant = Tables<"tenants">;
export type Membership = Tables<"memberships">;
export type Profile = Tables<"profiles">;
export type Lead = Tables<"leads">;
export type Project = Tables<"projects">;
export type Task = Tables<"tasks">;
export type ChangeRequest = Tables<"change_requests">;
export type DocumentRow = Tables<"documents">;
export type Invoice = Tables<"invoices">;
export type Subscription = Tables<"subscriptions">;
export type ComplianceRecord = Tables<"compliance_records">;
export type AuditLog = Tables<"audit_log">;

export type MembershipRole = Enums<"membership_role">;
export type ProjectStage = Enums<"project_stage">;
export type TaskStatus = Enums<"task_status">;
export type ChangeRequestStatus = Enums<"change_request_status">;
export type LeadStatus = Enums<"lead_status">;
