import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/020_approved_result_show.sql", "utf8");
const bestReviewerMigration = readFileSync("supabase/migrations/022_best_reviewer_result_show.sql", "utf8");
describe("approved result show", () => {
  it("requires admin approval before the result display mode can open", () => {
    expect(migration).toContain("SHOW_DECK_NOT_APPROVED");
    expect(migration).toMatch(/current_app_role\(\) is distinct from 'ADMIN'/i);
    expect(migration).toMatch(/status = 'APPROVED'/i);
  });
  it("does not unlock the official award reveal or create result snapshots", () => {
    expect(migration).toMatch(/p_display_mode = 'AWARD_REVEAL' and v_event\.result_status = 'LOCKED'/i);
    expect(migration).not.toMatch(/insert into public\.result_snapshots/i);
    expect(migration).not.toMatch(/result_status\s*=\s*'FINALIZED'/i);
  });
  it("only exposes a complete approved best reviewer record", () => {
    expect(bestReviewerMigration).toContain("BEST_REVIEWER_NOT_APPROVED");
    expect(bestReviewerMigration).toContain("result_show_best_reviewer_object");
    expect(bestReviewerMigration).toMatch(/current_app_role\(\) is distinct from 'ADMIN'/i);
    expect(bestReviewerMigration).not.toMatch(/insert into public\.result_snapshots/i);
  });
});
