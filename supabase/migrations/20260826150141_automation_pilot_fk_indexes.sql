-- Cover user-reference foreign keys used by review and ownership lookups.
create index if not exists automation_definitions_created_by_user_idx
  on public.automation_definitions (created_by_user_id);

create index if not exists automation_runs_reviewed_by_user_idx
  on public.automation_runs (reviewed_by_user_id)
  where reviewed_by_user_id is not null;
