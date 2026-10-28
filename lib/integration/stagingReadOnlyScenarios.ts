export type StagingActor = "ANONYMOUS" | "ADMIN" | "STAFF" | "JUDGE";

export type StagingReadOnlyScenario = {
  actor: StagingActor;
  path: string;
  expectedStatus: number;
  label: string;
};

export const STAGING_READ_ONLY_SCENARIOS: readonly StagingReadOnlyScenario[] = [
  { actor: "ANONYMOUS", path: "/api/scoring/diagnostics?eventId=:eventId", expectedStatus: 401, label: "anonymous diagnostics denied" },
  { actor: "ANONYMOUS", path: "/api/event/snapshot?eventId=:eventId", expectedStatus: 401, label: "anonymous admin snapshot denied" },
  { actor: "ADMIN", path: "/api/scoring/diagnostics?eventId=:eventId", expectedStatus: 200, label: "admin diagnostics allowed" },
  { actor: "ADMIN", path: "/api/event/snapshot?eventId=:eventId", expectedStatus: 200, label: "admin snapshot allowed" },
  { actor: "ADMIN", path: "/api/judging?view=workspace&eventId=:eventId", expectedStatus: 403, label: "admin judge workspace denied" },
  { actor: "STAFF", path: "/api/scoring/diagnostics?eventId=:eventId", expectedStatus: 200, label: "staff diagnostics allowed" },
  { actor: "STAFF", path: "/api/event/snapshot?eventId=:eventId", expectedStatus: 200, label: "staff snapshot allowed" },
  { actor: "STAFF", path: "/api/judging?view=workspace&eventId=:eventId", expectedStatus: 403, label: "staff judge workspace denied" },
  { actor: "JUDGE", path: "/api/scoring/diagnostics?eventId=:eventId", expectedStatus: 403, label: "judge diagnostics denied" },
  { actor: "JUDGE", path: "/api/event/snapshot?eventId=:eventId", expectedStatus: 403, label: "judge admin snapshot denied" },
  { actor: "JUDGE", path: "/api/judging?view=workspace&eventId=:eventId", expectedStatus: 200, label: "judge workspace allowed" },
] as const;
