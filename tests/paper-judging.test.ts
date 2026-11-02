import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/019_paper_judge_score_entry.sql", "utf8");

describe("paper judge score entry", () => {
  it("enforces the 50 + 100 + 50 paper score structure", () => {
    expect(migration).toMatch(/document_score integer not null check \(document_score between 0 and 50\)/i);
    expect(migration).toMatch(/presentation_score integer not null check \(presentation_score between 0 and 100\)/i);
    expect(migration).toMatch(/qna_score integer not null check \(qna_score between 0 and 50\)/i);
    expect(migration).toMatch(/document_score \+ presentation_score \+ qna_score/i);
  });

  it("keeps submitted paper scores locked and blocks finalized events", () => {
    expect(migration).toContain("PAPER_SUBMISSION_LOCKED");
    expect(migration).toContain("RESULT_FINALIZED");
    expect(migration).toContain("paper_judge_score_revisions");
    expect(migration).not.toMatch(/result_snapshots\s*\(/i);
  });
});
