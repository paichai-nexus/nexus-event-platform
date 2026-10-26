import type { EventControlSnapshot } from "@/lib/repositories/eventControlRepository";
import type { Team } from "@/types/team";

export type PublicEventSnapshot = {
  serverTime: string;
  version: number;
  event: {
    mode: EventControlSnapshot["mode"];
    status: EventControlSnapshot["status"];
    votingStatus: EventControlSnapshot["votingStatus"];
    displayMode: EventControlSnapshot["displayMode"];
    resultStatus: EventControlSnapshot["resultStatus"];
    revealStep: number;
  };
  activeTeam: null | Pick<Team, "id" | "name" | "topic" | "order" | "category" | "status">;
};

/** Explicit allow-list projection. Never spread an admin snapshot into a public response. */
export function toPublicEventSnapshot(
  event: EventControlSnapshot,
  teams: Team[],
  serverTime = new Date().toISOString(),
): PublicEventSnapshot {
  const active = teams.find((team) => team.id === event.activeTeamId && team.active && team.name) ?? null;
  return {
    serverTime,
    version: event.version,
    event: {
      mode: event.mode,
      status: event.status,
      votingStatus: event.votingStatus,
      displayMode: event.displayMode,
      resultStatus: event.resultStatus,
      revealStep: event.revealStep,
    },
    activeTeam: active
      ? { id: active.id, name: active.name, topic: active.topic, order: active.order, category: active.category, status: active.status }
      : null,
  };
}
