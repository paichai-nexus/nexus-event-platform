import "server-only";

import { isMockRuntime, isPostgresTestRuntime } from "@/lib/config/runtime";
import {
  PostgresTestAttendanceRepository,
  PostgresTestCheckInRepository,
  PostgresTestEventControlRepository,
  PostgresTestJudgeRepository,
  PostgresTestPrizeCatalogRepository,
  PostgresTestPrizeRepository,
  PostgresTestTeamRepository,
  PostgresTestVoteRepository,
} from "@/lib/repositories/postgresTestRepositories";
import type { CheckInRepository } from "@/lib/repositories/checkInRepository";
import { MockCheckInRepository } from "@/lib/repositories/mockCheckInRepository";
import { SupabaseCheckInRepository } from "@/lib/repositories/supabaseCheckInRepository";
import type { EventControlRepository } from "@/lib/repositories/eventControlRepository";
import { MockEventControlRepository } from "@/lib/repositories/mockEventControlRepository";
import { SupabaseEventControlRepository } from "@/lib/repositories/supabaseEventControlRepository";
import type { PrizeRepository } from "@/lib/repositories/prizeRepository";
import { MockPrizeRepository } from "@/lib/repositories/mockPrizeRepository";
import { SupabasePrizeRepository } from "@/lib/repositories/supabasePrizeRepository";
import type { AttendanceRepository } from "@/lib/repositories/attendanceRepository";
import { MockAttendanceRepository } from "@/lib/repositories/mockAttendanceRepository";
import { SupabaseAttendanceRepository } from "@/lib/repositories/supabaseAttendanceRepository";
import type { TeamRepository } from "@/lib/repositories/teamRepository";
import { MockTeamRepository } from "@/lib/repositories/mockTeamRepository";
import { SupabaseTeamRepository } from "@/lib/repositories/supabaseTeamRepository";
import type { PrizeCatalogRepository } from "@/lib/repositories/prizeCatalogRepository";
import { MockPrizeCatalogRepository } from "@/lib/repositories/mockPrizeCatalogRepository";
import { SupabasePrizeCatalogRepository } from "@/lib/repositories/supabasePrizeCatalogRepository";
import type { MissionRepository } from "@/lib/repositories/missionRepository";
import { MockMissionRepository } from "@/lib/repositories/mockMissionRepository";
import { SupabaseMissionRepository } from "@/lib/repositories/supabaseMissionRepository";
import type { PromoVideoRepository } from "@/lib/repositories/promoVideoRepository";
import { MockPromoVideoRepository } from "@/lib/repositories/mockPromoVideoRepository";
import { SupabasePromoVideoRepository } from "@/lib/repositories/supabasePromoVideoRepository";
import type { VoteRepository } from "@/lib/repositories/voteRepository";
import { MockVoteRepository } from "@/lib/repositories/mockVoteRepository";
import { SupabaseVoteRepository } from "@/lib/repositories/supabaseVoteRepository";
import type { JudgeRepository } from "@/lib/repositories/judgeRepository";
import { MockJudgeRepository } from "@/lib/repositories/mockJudgeRepository";
import { SupabaseJudgeRepository } from "@/lib/repositories/supabaseJudgeRepository";

export function getCheckInRepository(): CheckInRepository {
  if (isMockRuntime()) return new MockCheckInRepository();
  return isPostgresTestRuntime() ? new PostgresTestCheckInRepository() : new SupabaseCheckInRepository();
}

export function getEventControlRepository(): EventControlRepository {
  if (isMockRuntime()) return new MockEventControlRepository();
  return isPostgresTestRuntime() ? new PostgresTestEventControlRepository() : new SupabaseEventControlRepository();
}

export function getPrizeRepository(): PrizeRepository {
  if (isMockRuntime()) return new MockPrizeRepository();
  return isPostgresTestRuntime() ? new PostgresTestPrizeRepository() : new SupabasePrizeRepository();
}

export function getAttendanceRepository(): AttendanceRepository {
  if (isMockRuntime()) return new MockAttendanceRepository();
  return isPostgresTestRuntime() ? new PostgresTestAttendanceRepository() : new SupabaseAttendanceRepository();
}

export function getTeamRepository(): TeamRepository {
  if (isMockRuntime()) return new MockTeamRepository();
  return isPostgresTestRuntime() ? new PostgresTestTeamRepository() : new SupabaseTeamRepository();
}

export function getPrizeCatalogRepository(): PrizeCatalogRepository {
  if (isMockRuntime()) return new MockPrizeCatalogRepository();
  return isPostgresTestRuntime() ? new PostgresTestPrizeCatalogRepository() : new SupabasePrizeCatalogRepository();
}

export function getMissionRepository(): MissionRepository {
  return isMockRuntime() ? new MockMissionRepository() : new SupabaseMissionRepository();
}

export function getPromoVideoRepository(): PromoVideoRepository {
  return isMockRuntime() ? new MockPromoVideoRepository() : new SupabasePromoVideoRepository();
}

export function getVoteRepository(): VoteRepository {
  if (isMockRuntime()) return new MockVoteRepository();
  return isPostgresTestRuntime() ? new PostgresTestVoteRepository() : new SupabaseVoteRepository();
}

export function getJudgeRepository(): JudgeRepository {
  if (isMockRuntime()) return new MockJudgeRepository();
  return isPostgresTestRuntime() ? new PostgresTestJudgeRepository() : new SupabaseJudgeRepository();
}
