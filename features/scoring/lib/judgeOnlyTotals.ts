export type JudgeOnlyTeam = {
  id: string;
  name: string | null;
  category: "STARTUP" | "BUSINESS_ANALYSIS";
  order: number;
  active: boolean;
};

export type JudgeOnlyPaperScore = {
  teamId: string;
  judgeSlot: 1 | 2 | 3;
  documentScore: number;
  presentationScore: number;
  qnaScore: number;
  totalScore: number;
  status: "DRAFT" | "SUBMITTED";
};

export type JudgeOnlyRow = {
  id: string;
  name: string;
  category: JudgeOnlyTeam["category"];
  order: number;
  judgeSlots: Array<number | null>;
  submittedJudges: number;
  total: number | null;
  complete: boolean;
  rank: number | null;
};

export function calculateJudgeOnlyRows(teams: JudgeOnlyTeam[], scores: JudgeOnlyPaperScore[]): JudgeOnlyRow[] {
  const byTeam = new Map<string, JudgeOnlyPaperScore[]>();
  for (const score of scores) {
    const group = byTeam.get(score.teamId) ?? [];
    group.push(score);
    byTeam.set(score.teamId, group);
  }
  const rows: JudgeOnlyRow[] = teams.filter(team => team.active).map(team => {
    const slots: Array<number | null> = [null, null, null];
    const invalidSlots = new Set<number>();
    for (const score of byTeam.get(team.id) ?? []) {
      if (score.status !== "SUBMITTED") continue;
      const index = score.judgeSlot - 1;
      if (!Number.isInteger(index) || index < 0 || index >= 3) continue;
      const recomputed = score.documentScore + score.presentationScore + score.qnaScore;
      const valid = Number.isInteger(score.documentScore) && score.documentScore >= 0 && score.documentScore <= 50
        && Number.isInteger(score.presentationScore) && score.presentationScore >= 0 && score.presentationScore <= 100
        && Number.isInteger(score.qnaScore) && score.qnaScore >= 0 && score.qnaScore <= 50
        && recomputed === score.totalScore;
      if (!valid || slots[index] !== null) {
        invalidSlots.add(index);
        continue;
      }
      slots[index] = recomputed;
    }
    for (const index of invalidSlots) slots[index] = null;
    const submittedJudges = slots.filter(value => value !== null).length;
    const complete = submittedJudges === 3;
    return {
      id: team.id,
      name: team.name?.trim() || `${team.order}번 팀 · 팀명 미등록`,
      category: team.category,
      order: team.order,
      judgeSlots: slots,
      submittedJudges,
      total: complete ? slots.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null,
      complete,
      rank: null,
    };
  });
  for (const category of ["STARTUP", "BUSINESS_ANALYSIS"] as const) {
    const ranked = rows.filter(row => row.category === category && row.complete)
      .sort((a, b) => b.total! - a.total! || a.order - b.order);
    for (let i=0; i<ranked.length; i++) {
      ranked[i]!.rank = ranked.findIndex(row => row.total === ranked[i]!.total) + 1;
    }
  }
  return rows.sort((a,b) => a.order - b.order);
}
