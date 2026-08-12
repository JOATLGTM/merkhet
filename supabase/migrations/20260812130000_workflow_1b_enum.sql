-- Slice 1B part 1: add final_review to design_phase enum.
-- Must commit before the value is used (Postgres enum ADD VALUE rule).
-- Run this file alone in the SQL Editor before 20260812130100_workflow_1b.sql.

alter type public.design_phase add value if not exists 'final_review';
