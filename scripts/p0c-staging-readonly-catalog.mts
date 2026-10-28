import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { evaluateStagingValidationPolicy, stagingDatabaseTargetsProject } from "../lib/config/stagingValidation.ts";

const policy = evaluateStagingValidationPolicy(process.env);
if (!policy.ok) {
  console.error(`BLOCKED: ${policy.errors.join(" ")}`);
  process.exit(2);
}

const databaseUrl = process.env.P0C_STAGING_DATABASE_URL;
if (!stagingDatabaseTargetsProject(databaseUrl, policy.projectRef)) {
  console.error("BLOCKED: P0C_STAGING_DATABASE_URL must prove the approved staging project ref and require SSL.");
  process.exit(2);
}

const psql = process.env.P0C_STAGING_PSQL_PATH?.trim() || "psql";
const result = spawnSync(
  psql,
  ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-f", resolve("scripts/p0c-staging-readonly-catalog.sql")],
  {
    encoding: "utf8",
    env: {
      ...process.env,
      PGDATABASE: databaseUrl,
      PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=15000",
    },
  },
);

if (result.error || result.status !== 0) {
  console.error("FAIL: staging catalog inspection failed; credentials and database output were suppressed.");
  process.exit(1);
}

type CatalogReport = {
  migrations: string[];
  rls: Record<string, boolean>;
  privileges: Record<string, boolean>;
};

let report: CatalogReport;
try {
  report = JSON.parse(result.stdout.trim()) as CatalogReport;
} catch {
  console.error("FAIL: staging catalog inspection returned an unexpected response.");
  process.exit(1);
}

const expectedMigrations = Array.from({ length: 14 }, (_, index) => String(index + 1).padStart(3, "0"));
const expectedRlsTables = [
  "events", "profiles", "participants", "teams", "check_ins",
  "audience_attendance_sessions", "audience_submissions", "audience_scores",
  "judge_assignments", "judge_submissions", "judge_scores",
  "judge_score_revisions", "result_snapshots", "audit_logs",
];
const missingMigrations = expectedMigrations.filter((version) => !report.migrations.includes(version));
const missingRls = expectedRlsTables.filter((table) => report.rls[table] !== true);
const expectedPrivileges: Record<string, boolean> = {
  anon_events_select: false,
  anon_teams_select: false,
  service_events_select: true,
  service_teams_select: true,
  anon_attendance_execute: false,
  authenticated_attendance_execute: false,
  service_attendance_execute: true,
  anon_vote_execute: false,
  authenticated_vote_execute: false,
  service_vote_execute: true,
  authenticated_vote_snapshot_execute: true,
  authenticated_judge_save_execute: true,
  authenticated_judge_submit_execute: true,
  authenticated_unlock_execute: true,
};
const privilegeMismatches = Object.entries(expectedPrivileges)
  .filter(([name, expected]) => report.privileges[name] !== expected)
  .map(([name]) => name);

if (missingMigrations.length || missingRls.length || privilegeMismatches.length) {
  if (missingMigrations.length) console.error(`FAIL: missing migrations: ${missingMigrations.join(", ")}`);
  if (missingRls.length) console.error(`FAIL: RLS disabled: ${missingRls.join(", ")}`);
  if (privilegeMismatches.length) console.error(`FAIL: privilege mismatch: ${privilegeMismatches.join(", ")}`);
  process.exit(1);
}

console.log("PASS: staging migrations 001-014, RLS, and RPC/table privileges match the read-only validation contract.");
