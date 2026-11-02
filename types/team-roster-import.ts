import type { TeamCategory } from "@/types/team";
export type TeamRosterImportRow = { order: number; category: TeamCategory; name: string; department: string; leaderName: string; memberNames: string[]; advisorName: string; topic: string; active: boolean };
export type TeamRosterParseResult = { rows: TeamRosterImportRow[]; errors: string[] };
