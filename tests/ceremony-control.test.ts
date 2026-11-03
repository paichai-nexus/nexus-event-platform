import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CEREMONY_PHASES } from "@/types/ceremony-control";
const migration = readFileSync("supabase/migrations/023_ceremony_control_state.sql", "utf8");
const extension = readFileSync("supabase/migrations/029_part_attendance_and_prize_run_of_show.sql", "utf8");
describe("ceremony control", () => {
  it("preserves the confirmed ceremony sequence", () => expect(CEREMONY_PHASES).toEqual(["FIRST_DRAW", "AUDIENCE_CANDIDATES", "SECOND_DRAW", "JUDGE_REVIEW", "RESULTS", "BEST_REVIEWER", "THIRD_DRAW", "COMPLETE"]));
  it("persists only admin-controlled sequential transitions", () => { expect(migration).toContain("CEREMONY_INVALID_TRANSITION"); expect(migration).toContain("CEREMONY_PHASE_CHANGE"); expect(migration).toMatch(/current_app_role\(\) is distinct from 'ADMIN'/i); });
  it("starts the extended production sequence with the first draw", () => { expect(extension).toContain("p_phase <> 'FIRST_DRAW'"); expect(extension).toContain("'FIRST_DRAW','AUDIENCE_CANDIDATES','SECOND_DRAW'"); });
});
