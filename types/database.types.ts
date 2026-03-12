// =============================================================================
// database.types.ts
// Auto-maintained TypeScript types that mirror the Supabase database schema.
// =============================================================================

export type UserRole = 'district_admin' | 'staff' | 'signee';
export type TimecardStatus =
  | 'draft'
  | 'submitted'
  | 'signed'
  | 'reopen_requested'
  | 'reopened';

// ---------------------------------------------------------------------------
// Main Database interface consumed by the Supabase client:
//   createClient<Database>(url, key)
// ---------------------------------------------------------------------------
export interface Database {
  public: {
    Tables: {
      // -------------------------------------------------------------------
      // users
      // -------------------------------------------------------------------
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          address: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string; // must match auth.users.id
          email: string;
          full_name: string;
          address?: string | null;
          role: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          address?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
      };

      // -------------------------------------------------------------------
      // programs
      // -------------------------------------------------------------------
      programs: {
        Row: {
          id: string;
          name: string;
          account_number: string;
          created_by: string;
          created_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          account_number: string;
          created_by: string;
          created_at?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          account_number?: string;
          created_by?: string;
          created_at?: string;
          is_active?: boolean;
        };
      };

      // -------------------------------------------------------------------
      // program_staff
      // -------------------------------------------------------------------
      program_staff: {
        Row: {
          id: string;
          program_id: string;
          staff_id: string;
          school: string;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          staff_id: string;
          school: string;
          assigned_at?: string;
        };
        Update: {
          id?: string;
          program_id?: string;
          staff_id?: string;
          school?: string;
          assigned_at?: string;
        };
      };

      // -------------------------------------------------------------------
      // program_signees
      // -------------------------------------------------------------------
      program_signees: {
        Row: {
          id: string;
          program_id: string;
          signee_id: string;
          staff_id: string | null;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          signee_id: string;
          staff_id?: string | null;
          assigned_at?: string;
        };
        Update: {
          id?: string;
          program_id?: string;
          signee_id?: string;
          staff_id?: string | null;
          assigned_at?: string;
        };
      };

      // -------------------------------------------------------------------
      // pay_periods
      // -------------------------------------------------------------------
      pay_periods: {
        Row: {
          id: string;
          label: string;
          start_date: string; // ISO date string YYYY-MM-DD
          end_date: string;
          fiscal_year: string;
          created_by: string;
        };
        Insert: {
          id?: string;
          label: string;
          start_date: string;
          end_date: string;
          fiscal_year: string;
          created_by: string;
        };
        Update: {
          id?: string;
          label?: string;
          start_date?: string;
          end_date?: string;
          fiscal_year?: string;
          created_by?: string;
        };
      };

      // -------------------------------------------------------------------
      // program_pay_periods
      // -------------------------------------------------------------------
      program_pay_periods: {
        Row: {
          id: string;
          program_id: string;
          pay_period_id: string;
          submit_deadline: string;
          default_offset_days: number;
        };
        Insert: {
          id?: string;
          program_id: string;
          pay_period_id: string;
          submit_deadline: string;
          default_offset_days?: number;
        };
        Update: {
          id?: string;
          program_id?: string;
          pay_period_id?: string;
          submit_deadline?: string;
          default_offset_days?: number;
        };
      };

      // -------------------------------------------------------------------
      // timecards
      // -------------------------------------------------------------------
      timecards: {
        Row: {
          id: string;
          program_id: string;
          pay_period_id: string;
          staff_id: string;
          status: TimecardStatus;
          submitted_at: string | null;
          staff_signature: string | null;
          staff_signed_at: string | null;
          signee_id: string | null;
          signee_signature: string | null;
          signee_signed_at: string | null;
          pdf_url: string | null;
          reopen_reason: string | null;
          reopen_approved_by: string | null;
          reopen_approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          pay_period_id: string;
          staff_id: string;
          status?: TimecardStatus;
          submitted_at?: string | null;
          staff_signature?: string | null;
          staff_signed_at?: string | null;
          signee_id?: string | null;
          signee_signature?: string | null;
          signee_signed_at?: string | null;
          pdf_url?: string | null;
          reopen_reason?: string | null;
          reopen_approved_by?: string | null;
          reopen_approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          program_id?: string;
          pay_period_id?: string;
          staff_id?: string;
          status?: TimecardStatus;
          submitted_at?: string | null;
          staff_signature?: string | null;
          staff_signed_at?: string | null;
          signee_id?: string | null;
          signee_signature?: string | null;
          signee_signed_at?: string | null;
          pdf_url?: string | null;
          reopen_reason?: string | null;
          reopen_approved_by?: string | null;
          reopen_approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // -------------------------------------------------------------------
      // timecard_entries
      // -------------------------------------------------------------------
      timecard_entries: {
        Row: {
          id: string;
          timecard_id: string;
          work_date: string; // ISO date string YYYY-MM-DD
          time_in: string;   // HH:MM:SS
          time_out: string;  // HH:MM:SS
          total_hours: number;
        };
        Insert: {
          id?: string;
          timecard_id: string;
          work_date: string;
          time_in: string;
          time_out: string;
          total_hours: number;
        };
        Update: {
          id?: string;
          timecard_id?: string;
          work_date?: string;
          time_in?: string;
          time_out?: string;
          total_hours?: number;
        };
      };

      // -------------------------------------------------------------------
      // ntl_rates
      // -------------------------------------------------------------------
      ntl_rates: {
        Row: {
          id: string;
          rate: number;
          fiscal_year: string;
          set_by: string;
          set_at: string;
        };
        Insert: {
          id?: string;
          rate: number;
          fiscal_year: string;
          set_by: string;
          set_at?: string;
        };
        Update: {
          id?: string;
          rate?: number;
          fiscal_year?: string;
          set_by?: string;
          set_at?: string;
        };
      };
    };

    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      timecard_status: TimecardStatus;
    };
  };
}
