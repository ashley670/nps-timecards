-- =============================================================================
-- 0002_rls_policies.sql
-- NPS Timecards – Row Level Security policies
-- =============================================================================

-- -------------------------------------------------------------------------
-- Helper: return the role of the currently-authenticated user
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- -------------------------------------------------------------------------
-- Enable RLS on all tables
-- -------------------------------------------------------------------------
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_staff     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_signees   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pay_periods       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_pay_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timecards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timecard_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ntl_rates         ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- users
-- =============================================================================

-- Users can read their own row
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (id = auth.uid());

-- District admin can read all users
CREATE POLICY "users_select_admin"
  ON public.users FOR SELECT
  USING (public.current_user_role() = 'district_admin');

-- District admin can insert users
CREATE POLICY "users_insert_admin"
  ON public.users FOR INSERT
  WITH CHECK (public.current_user_role() = 'district_admin');

-- District admin can update any user; regular users can update their own row
CREATE POLICY "users_update_admin"
  ON public.users FOR UPDATE
  USING (public.current_user_role() = 'district_admin');

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (id = auth.uid());

-- District admin can delete users
CREATE POLICY "users_delete_admin"
  ON public.users FOR DELETE
  USING (public.current_user_role() = 'district_admin');

-- =============================================================================
-- programs
-- =============================================================================

-- All authenticated users can read programs they belong to (as staff or signee)
CREATE POLICY "programs_select_member"
  ON public.programs FOR SELECT
  USING (
    public.current_user_role() = 'district_admin'
    OR EXISTS (
      SELECT 1 FROM public.program_staff ps
      WHERE ps.program_id = programs.id
        AND ps.staff_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.program_signees psg
      WHERE psg.program_id = programs.id
        AND psg.signee_id = auth.uid()
    )
  );

-- District admin can insert programs
CREATE POLICY "programs_insert_admin"
  ON public.programs FOR INSERT
  WITH CHECK (public.current_user_role() = 'district_admin');

-- District admin can update programs
CREATE POLICY "programs_update_admin"
  ON public.programs FOR UPDATE
  USING (public.current_user_role() = 'district_admin');

-- District admin can delete programs
CREATE POLICY "programs_delete_admin"
  ON public.programs FOR DELETE
  USING (public.current_user_role() = 'district_admin');

-- =============================================================================
-- program_staff
-- =============================================================================

-- Staff can read their own program_staff rows
CREATE POLICY "program_staff_select_own"
  ON public.program_staff FOR SELECT
  USING (staff_id = auth.uid());

-- Signees can read program_staff rows for programs they are assigned to
CREATE POLICY "program_staff_select_signee"
  ON public.program_staff FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.program_signees psg
      WHERE psg.program_id = program_staff.program_id
        AND psg.signee_id  = auth.uid()
    )
  );

-- District admin has full access
CREATE POLICY "program_staff_select_admin"
  ON public.program_staff FOR SELECT
  USING (public.current_user_role() = 'district_admin');

CREATE POLICY "program_staff_insert_admin"
  ON public.program_staff FOR INSERT
  WITH CHECK (public.current_user_role() = 'district_admin');

CREATE POLICY "program_staff_update_admin"
  ON public.program_staff FOR UPDATE
  USING (public.current_user_role() = 'district_admin');

CREATE POLICY "program_staff_delete_admin"
  ON public.program_staff FOR DELETE
  USING (public.current_user_role() = 'district_admin');

-- =============================================================================
-- program_signees
-- =============================================================================

-- Signees can read their own assignments
CREATE POLICY "program_signees_select_own"
  ON public.program_signees FOR SELECT
  USING (signee_id = auth.uid());

-- District admin has full access
CREATE POLICY "program_signees_select_admin"
  ON public.program_signees FOR SELECT
  USING (public.current_user_role() = 'district_admin');

CREATE POLICY "program_signees_insert_admin"
  ON public.program_signees FOR INSERT
  WITH CHECK (public.current_user_role() = 'district_admin');

CREATE POLICY "program_signees_update_admin"
  ON public.program_signees FOR UPDATE
  USING (public.current_user_role() = 'district_admin');

CREATE POLICY "program_signees_delete_admin"
  ON public.program_signees FOR DELETE
  USING (public.current_user_role() = 'district_admin');

-- =============================================================================
-- pay_periods
-- =============================================================================

-- All authenticated users can read pay periods
CREATE POLICY "pay_periods_select_authenticated"
  ON public.pay_periods FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- District admin can write pay periods
CREATE POLICY "pay_periods_insert_admin"
  ON public.pay_periods FOR INSERT
  WITH CHECK (public.current_user_role() = 'district_admin');

CREATE POLICY "pay_periods_update_admin"
  ON public.pay_periods FOR UPDATE
  USING (public.current_user_role() = 'district_admin');

CREATE POLICY "pay_periods_delete_admin"
  ON public.pay_periods FOR DELETE
  USING (public.current_user_role() = 'district_admin');

-- =============================================================================
-- program_pay_periods
-- =============================================================================

-- All authenticated users can read program pay period configurations
CREATE POLICY "program_pay_periods_select_authenticated"
  ON public.program_pay_periods FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- District admin can write program pay periods
CREATE POLICY "program_pay_periods_insert_admin"
  ON public.program_pay_periods FOR INSERT
  WITH CHECK (public.current_user_role() = 'district_admin');

CREATE POLICY "program_pay_periods_update_admin"
  ON public.program_pay_periods FOR UPDATE
  USING (public.current_user_role() = 'district_admin');

CREATE POLICY "program_pay_periods_delete_admin"
  ON public.program_pay_periods FOR DELETE
  USING (public.current_user_role() = 'district_admin');

-- =============================================================================
-- timecards
-- =============================================================================

-- Staff can read their own timecards
CREATE POLICY "timecards_select_own_staff"
  ON public.timecards FOR SELECT
  USING (staff_id = auth.uid());

-- Signees can read timecards assigned to them (directly or via program-wide assignment)
CREATE POLICY "timecards_select_signee"
  ON public.timecards FOR SELECT
  USING (
    signee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.program_signees psg
      WHERE psg.program_id = timecards.program_id
        AND psg.signee_id  = auth.uid()
        AND (psg.staff_id IS NULL OR psg.staff_id = timecards.staff_id)
    )
  );

-- District admin can read all timecards
CREATE POLICY "timecards_select_admin"
  ON public.timecards FOR SELECT
  USING (public.current_user_role() = 'district_admin');

-- Staff can insert their own timecards
CREATE POLICY "timecards_insert_own_staff"
  ON public.timecards FOR INSERT
  WITH CHECK (staff_id = auth.uid());

-- Staff can update their own timecards (e.g. submit, sign)
CREATE POLICY "timecards_update_own_staff"
  ON public.timecards FOR UPDATE
  USING (staff_id = auth.uid());

-- Signees can update timecards they are assigned to (to sign them)
CREATE POLICY "timecards_update_signee"
  ON public.timecards FOR UPDATE
  USING (
    signee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.program_signees psg
      WHERE psg.program_id = timecards.program_id
        AND psg.signee_id  = auth.uid()
        AND (psg.staff_id IS NULL OR psg.staff_id = timecards.staff_id)
    )
  );

-- District admin can update all timecards
CREATE POLICY "timecards_update_admin"
  ON public.timecards FOR UPDATE
  USING (public.current_user_role() = 'district_admin');

-- District admin can delete timecards
CREATE POLICY "timecards_delete_admin"
  ON public.timecards FOR DELETE
  USING (public.current_user_role() = 'district_admin');

-- =============================================================================
-- timecard_entries
-- =============================================================================

-- Staff can read entries that belong to their own timecards
CREATE POLICY "timecard_entries_select_own_staff"
  ON public.timecard_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.timecards tc
      WHERE tc.id       = timecard_entries.timecard_id
        AND tc.staff_id = auth.uid()
    )
  );

-- Signees can read entries for timecards they are assigned to
CREATE POLICY "timecard_entries_select_signee"
  ON public.timecard_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.timecards tc
      WHERE tc.id = timecard_entries.timecard_id
        AND (
          tc.signee_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.program_signees psg
            WHERE psg.program_id = tc.program_id
              AND psg.signee_id  = auth.uid()
              AND (psg.staff_id IS NULL OR psg.staff_id = tc.staff_id)
          )
        )
    )
  );

-- District admin can read all entries
CREATE POLICY "timecard_entries_select_admin"
  ON public.timecard_entries FOR SELECT
  USING (public.current_user_role() = 'district_admin');

-- Staff can insert entries for their own timecards
CREATE POLICY "timecard_entries_insert_own_staff"
  ON public.timecard_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.timecards tc
      WHERE tc.id       = timecard_entries.timecard_id
        AND tc.staff_id = auth.uid()
    )
  );

-- Staff can update entries for their own timecards
CREATE POLICY "timecard_entries_update_own_staff"
  ON public.timecard_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.timecards tc
      WHERE tc.id       = timecard_entries.timecard_id
        AND tc.staff_id = auth.uid()
    )
  );

-- Staff can delete entries for their own timecards
CREATE POLICY "timecard_entries_delete_own_staff"
  ON public.timecard_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.timecards tc
      WHERE tc.id       = timecard_entries.timecard_id
        AND tc.staff_id = auth.uid()
    )
  );

-- District admin full access
CREATE POLICY "timecard_entries_insert_admin"
  ON public.timecard_entries FOR INSERT
  WITH CHECK (public.current_user_role() = 'district_admin');

CREATE POLICY "timecard_entries_update_admin"
  ON public.timecard_entries FOR UPDATE
  USING (public.current_user_role() = 'district_admin');

CREATE POLICY "timecard_entries_delete_admin"
  ON public.timecard_entries FOR DELETE
  USING (public.current_user_role() = 'district_admin');

-- =============================================================================
-- ntl_rates
-- =============================================================================

-- All authenticated users can read NTL rates
CREATE POLICY "ntl_rates_select_authenticated"
  ON public.ntl_rates FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only district admin can insert NTL rates
CREATE POLICY "ntl_rates_insert_admin"
  ON public.ntl_rates FOR INSERT
  WITH CHECK (public.current_user_role() = 'district_admin');

-- Only district admin can update NTL rates
CREATE POLICY "ntl_rates_update_admin"
  ON public.ntl_rates FOR UPDATE
  USING (public.current_user_role() = 'district_admin');

-- Only district admin can delete NTL rates
CREATE POLICY "ntl_rates_delete_admin"
  ON public.ntl_rates FOR DELETE
  USING (public.current_user_role() = 'district_admin');
