import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const migration = readFileSync("supabase/migrations/021_prize_stage_eligibility_snapshots.sql", "utf8");
const extension = readFileSync("supabase/migrations/029_part_attendance_and_prize_run_of_show.sql", "utf8");
describe("prize stage eligibility snapshots", () => {
  it("separates second and third draw stages and freezes eligible participants", () => {
    expect(migration).toContain("'SECOND', 'THIRD'");
    expect(migration).toContain("unique (event_id, stage)");
    expect(migration).toContain("prize_stage_eligible_participants");
    expect(migration).toContain("PRIZE_STAGE_ELIGIBILITY_LOCK");
    expect(migration).toContain("draw_prize_item_winner_for_stage");
    expect(migration).toMatch(/eligible\.snapshot_id = selected_snapshot\.id/i);
  });
  it("adds a first draw and binds first/second attendance to immutable stage snapshots", () => {
    expect(extension).toContain("p_stage = 'FIRST'");
    expect(extension).toContain("entry.part = selected_part");
    expect(extension).toContain("PRIZE_STAGE_MISMATCH");
  });
  it("requires admin and excludes exited mobile attendees", () => {
    expect(migration).toMatch(/current_app_role\(\) is distinct from 'ADMIN'/i);
    expect(migration).toMatch(/exited_at is null/i);
    expect(migration).toContain("NO_ELIGIBLE_PARTICIPANT");
  });
});
