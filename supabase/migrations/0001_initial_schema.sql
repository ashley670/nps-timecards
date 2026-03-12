-- =============================================================================
-- 0001_initial_schema.sql
-- NPS Timecards – initial database schema
-- =============================================================================

-- -------------------------------------------------------------------------
-- Extensions
-- -------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------------------
-- Custom types / enums
-- -------------------------------------------------------------------------
CREATE TYPE public.user_role AS ENUM (
  'district_admin',
  'staff',
  'signee'
);

CREATE TYPE public.timecard_status AS ENUM (
  'draft',
  'submitted',
  'signed',
  'reopen_requested',
  'reopened'
);

-- -------------------------------------------------------------------------
-- users
-- -------------------------------------------------------------------------
CREATE TABLE public.users (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text        NOT NULL UNIQUE,
  full_name   text        NOT NULL,
  address     text,
  role        public.user_role NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------------------
-- programs
-- -------------------------------------------------------------------------
CREATE TABLE public.programs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  account_number text        NOT NULL,
  created_by     uuid        NOT NULL REFERENCES public.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  is_active      boolean     NOT NULL DEFAULT true
);

-- -------------------------------------------------------------------------
-- program_staff
-- -------------------------------------------------------------------------
CREATE TABLE public.program_staff (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  uuid        NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  staff_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school      text        NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, staff_id)
);

-- -------------------------------------------------------------------------
-- program_signees
-- -------------------------------------------------------------------------
CREATE TABLE public.program_signees (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  uuid        NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  signee_id   uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- NULL means the signee covers ALL staff in the program
  staff_id    uuid        REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------
-- pay_periods
-- -------------------------------------------------------------------------
CREATE TABLE public.pay_periods (
  id          uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text  NOT NULL,
  start_date  date  NOT NULL,
  end_date    date  NOT NULL,
  fiscal_year text  NOT NULL,
  created_by  uuid  NOT NULL REFERENCES public.users(id),
  CONSTRAINT chk_pay_period_dates CHECK (end_date >= start_date)
);

-- -------------------------------------------------------------------------
-- program_pay_periods
-- -------------------------------------------------------------------------
CREATE TABLE public.program_pay_periods (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id          uuid        NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  pay_period_id       uuid        NOT NULL REFERENCES public.pay_periods(id) ON DELETE CASCADE,
  submit_deadline     timestamptz NOT NULL,
  default_offset_days integer     NOT NULL DEFAULT 0,
  UNIQUE (program_id, pay_period_id)
);

-- -------------------------------------------------------------------------
-- timecards
-- -------------------------------------------------------------------------
CREATE TABLE public.timecards (
  id                  uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id          uuid                   NOT NULL REFERENCES public.programs(id),
  pay_period_id       uuid                   NOT NULL REFERENCES public.pay_periods(id),
  staff_id            uuid                   NOT NULL REFERENCES public.users(id),
  status              public.timecard_status NOT NULL DEFAULT 'draft',
  submitted_at        timestamptz,
  staff_signature     text,
  staff_signed_at     timestamptz,
  signee_id           uuid                   REFERENCES public.users(id),
  signee_signature    text,
  signee_signed_at    timestamptz,
  pdf_url             text,
  reopen_reason       text,
  reopen_approved_by  uuid                   REFERENCES public.users(id),
  reopen_approved_at  timestamptz,
  created_at          timestamptz            NOT NULL DEFAULT now(),
  updated_at          timestamptz            NOT NULL DEFAULT now(),
  UNIQUE (program_id, pay_period_id, staff_id)
);

CREATE TRIGGER trg_timecards_updated_at
  BEFORE UPDATE ON public.timecards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------------------
-- timecard_entries
-- -------------------------------------------------------------------------
CREATE TABLE public.timecard_entries (
  id           uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  timecard_id  uuid           NOT NULL REFERENCES public.timecards(id) ON DELETE CASCADE,
  work_date    date           NOT NULL,
  time_in      time           NOT NULL,
  time_out     time           NOT NULL,
  total_hours  numeric(4, 2)  NOT NULL,
  CONSTRAINT chk_entry_times   CHECK (time_out > time_in),
  CONSTRAINT chk_total_hours   CHECK (total_hours > 0 AND total_hours <= 24)
);

-- -------------------------------------------------------------------------
-- ntl_rates
-- -------------------------------------------------------------------------
CREATE TABLE public.ntl_rates (
  id          uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  rate        numeric(6, 2)  NOT NULL,
  fiscal_year text           NOT NULL,
  set_by      uuid           NOT NULL REFERENCES public.users(id),
  set_at      timestamptz    NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------
-- Indexes for common query patterns
-- -------------------------------------------------------------------------
CREATE INDEX idx_program_staff_program_id  ON public.program_staff(program_id);
CREATE INDEX idx_program_staff_staff_id    ON public.program_staff(staff_id);
CREATE INDEX idx_program_signees_program   ON public.program_signees(program_id);
CREATE INDEX idx_program_signees_signee    ON public.program_signees(signee_id);
CREATE INDEX idx_program_signees_staff     ON public.program_signees(staff_id);
CREATE INDEX idx_timecards_staff_id        ON public.timecards(staff_id);
CREATE INDEX idx_timecards_program_period  ON public.timecards(program_id, pay_period_id);
CREATE INDEX idx_timecards_signee_id       ON public.timecards(signee_id);
CREATE INDEX idx_timecard_entries_tc       ON public.timecard_entries(timecard_id);
CREATE INDEX idx_ntl_rates_fiscal_year     ON public.ntl_rates(fiscal_year);
