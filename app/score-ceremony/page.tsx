import { getRuntimePolicy } from "@/lib/config/runtime";
import { DEMO_SCORES, type CeremonyTeam } from "./scoreMath";
import CeremonyClient from "./CeremonyClient";

// Server-only runtime selection: no rehearsal scores are passed to a live page.
export const dynamic = "force-dynamic";

export default function ScoreCeremonyPage() {
  const policy = getRuntimePolicy();
  const isDemo = policy.ok && policy.mode === "mock";
  const teams: CeremonyTeam[] = isDemo
    ? DEMO_SCORES
    : DEMO_SCORES.map((team) => ({ ...team, audience: 0, judges: [0, 0, 0] }));
  return <CeremonyClient initialTeams={teams} isDemo={isDemo} />;
}
