-- Add the independently locked 1부 attendance draw stage. This is isolated in
-- its own migration because PostgreSQL enum values become usable after commit.
alter type public.prize_draw_stage add value if not exists 'FIRST' before 'SECOND';
