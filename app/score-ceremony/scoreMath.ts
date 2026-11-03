export const SCORE_LIMIT = 840;
export type CeremonyTeam = {
  id: string;
  name: string;
  category: "STARTUP" | "BUSINESS_ANALYSIS";
  audience: number;
  judges: [number, number, number];
  color: string;
};

export function scorePercent(score: number) {
  return Math.max(0, Math.min(100, score / SCORE_LIMIT * 100));
}

export function scoreAtStep(team: CeremonyTeam, step: number) {
  return team.audience + team.judges.slice(0, Math.max(0, Math.min(3, step))).reduce((total, value) => total + value, 0);
}

// All scores below are illustrative rehearsal fixtures, not actual vote or judge results.
// Screenshot-grounded 2026.11.04 public finalist roster: 6 startup + 6 business-analysis.
// Scores are still MOCK only; they are not real judging or audience submissions.
export const DEMO_SCORES: CeremonyTeam[] = [
  { id:"S01", name:"관광ON", category:"STARTUP", audience:210, judges:[165,170,170], color:"#29d1a1" },
  { id:"S02", name:"TEA:MATE", category:"STARTUP", audience:218, judges:[172,170,173], color:"#f5d34e" },
  { id:"S03", name:"연애하자", category:"STARTUP", audience:220, judges:[185,178,183], color:"#fc376b" },
  { id:"S04", name:"EVER OASIS", category:"STARTUP", audience:215, judges:[173,179,179], color:"#9b7dff" },
  { id:"S05", name:"타겟", category:"STARTUP", audience:215, judges:[169,165,169], color:"#168ffc" },
  { id:"S06", name:"김성근", category:"STARTUP", audience:210, judges:[177,172,176], color:"#ff944b" },
  { id:"B01", name:"가치로", category:"BUSINESS_ANALYSIS", audience:211, judges:[175,182,179], color:"#ff9859" },
  { id:"B02", name:"조선제일주", category:"BUSINESS_ANALYSIS", audience:212, judges:[175,180,175], color:"#6e9bff" },
  { id:"B03", name:"어프로치", category:"BUSINESS_ANALYSIS", audience:210, judges:[176,175,177], color:"#f7d646" },
  { id:"B04", name:"분석할계룡", category:"BUSINESS_ANALYSIS", audience:205, judges:[165,168,174], color:"#f84a7e" },
  { id:"B05", name:"시너지", category:"BUSINESS_ANALYSIS", audience:213, judges:[168,173,169], color:"#178dff" },
  { id:"B06", name:"TOUCHPOINT", category:"BUSINESS_ANALYSIS", audience:209, judges:[170,175,175], color:"#a77aff" },
];
