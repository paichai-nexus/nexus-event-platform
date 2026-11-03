import "server-only";
import { isMockRuntime } from "@/lib/config/runtime";
import { DomainError } from "@/lib/errors/domainError";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PrizeDrawStage, PrizeStageSnapshot } from "@/types/prize-stage";
import { getMockPartAttendancePool } from "@/lib/attendance/mockPartAttendanceStore";

const stageOrder = ["FIRST", "SECOND", "THIRD"] as const;
const labels: Record<PrizeDrawStage, string> = {
  FIRST: "1부 종료 · 커피 쿠폰 15명",
  SECOND: "3부 시작 · 올리브영 2만원 6명",
  THIRD: "피날레 · 3등·1등 경품",
};
const mock = globalThis as typeof globalThis & { __prizeStageSnapshots?: Map<PrizeDrawStage, PrizeStageSnapshot>; __prizeStageMembers?: Map<PrizeDrawStage, Set<string>> };
const mockStages = () => mock.__prizeStageSnapshots ??= new Map();
const mockMembers = () => mock.__prizeStageMembers ??= new Map();
export function resetMockPrizeStages() { mock.__prizeStageSnapshots = new Map(); mock.__prizeStageMembers = new Map(); }
export function getMockPrizeStageMembers(stage: PrizeDrawStage): Set<string> { return new Set<string>(mockMembers().get(stage) ?? []); }

export async function getPrizeStages(eventId: string): Promise<PrizeStageSnapshot[]> {
  if (isMockRuntime()) return stageOrder.map((stage) => structuredClone(mockStages().get(stage) ?? { stage, label: labels[stage], eligibleCount: 0, lockedAt: null, locked: false }));
  const client = await createSupabaseServerClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
  const { data, error } = await client.from("prize_stage_snapshots").select("stage,eligible_count,locked_at").eq("event_id", eventId);
  if (error) throw new DomainError("DATABASE_ERROR", "럭키드로우 대상자 Snapshot을 조회하지 못했습니다.", 503);
  return stageOrder.map((stage) => { const row = data?.find((item) => item.stage === stage); return { stage, label: labels[stage], eligibleCount: row?.eligible_count ?? 0, lockedAt: row?.locked_at ?? null, locked: Boolean(row) }; });
}

export async function lockPrizeStage(eventId: string, stage: PrizeDrawStage): Promise<PrizeStageSnapshot> {
  if (isMockRuntime()) {
    const existing = mockStages().get(stage); if (existing) return structuredClone(existing);
    const part = stage === "FIRST" ? 1 : 2;
    const members = new Set(getMockPartAttendancePool(eventId, part));
    if (!members.size) throw new DomainError("INVALID_STATE", "현재 체크인된 참가자가 없어 대상자를 봉인할 수 없습니다.", 409);
    const saved = { stage, label: labels[stage], eligibleCount: members.size, lockedAt: new Date().toISOString(), locked: true } satisfies PrizeStageSnapshot;
    mockMembers().set(stage, members);
    mockStages().set(stage, saved); return structuredClone(saved);
  }
  const client = await createSupabaseServerClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
  const { data, error } = await client.rpc("lock_prize_stage_eligibility", { p_event_id: eventId, p_stage: stage });
  if (error || !data) throw new DomainError("DATABASE_ERROR", "럭키드로우 대상자를 봉인하지 못했습니다.", 503);
  const row = Array.isArray(data) ? data[0] : data;
  return { stage, label: labels[stage], eligibleCount: Number(row.eligible_count), lockedAt: row.locked_at, locked: true };
}
