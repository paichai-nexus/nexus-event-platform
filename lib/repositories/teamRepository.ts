import type { Team, TeamUpdate } from "@/types/team";

export interface TeamRepository {
  getTeams(eventId: string): Promise<Team[]>;
  updateTeam(update: TeamUpdate): Promise<Team>;
}
