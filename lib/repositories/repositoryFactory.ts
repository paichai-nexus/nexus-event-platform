import "server-only";

import { isSupabaseConfigured } from "@/lib/config/runtime";
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
  return isSupabaseConfigured() ? new SupabaseCheckInRepository() : new MockCheckInRepository();
}

export function getEventControlRepository(): EventControlRepository {
  return isSupabaseConfigured() ? new SupabaseEventControlRepository() : new MockEventControlRepository();
}

export function getPrizeRepository(): PrizeRepository {
  return isSupabaseConfigured() ? new SupabasePrizeRepository() : new MockPrizeRepository();
}

export function getAttendanceRepository(): AttendanceRepository {
  return isSupabaseConfigured() ? new SupabaseAttendanceRepository() : new MockAttendanceRepository();
}

export function getTeamRepository(): TeamRepository {
  return isSupabaseConfigured() ? new SupabaseTeamRepository() : new MockTeamRepository();
}

export function getPrizeCatalogRepository(): PrizeCatalogRepository {
  return isSupabaseConfigured() ? new SupabasePrizeCatalogRepository() : new MockPrizeCatalogRepository();
}

export function getMissionRepository(): MissionRepository {
  return isSupabaseConfigured() ? new SupabaseMissionRepository() : new MockMissionRepository();
}

export function getPromoVideoRepository(): PromoVideoRepository {
  return isSupabaseConfigured() ? new SupabasePromoVideoRepository() : new MockPromoVideoRepository();
}

export function getVoteRepository(): VoteRepository {
  return isSupabaseConfigured() ? new SupabaseVoteRepository() : new MockVoteRepository();
}

export function getJudgeRepository(): JudgeRepository {
  return isSupabaseConfigured() ? new SupabaseJudgeRepository() : new MockJudgeRepository();
}
