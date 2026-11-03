import "server-only";

import { randomInt } from "node:crypto";
import { getMockAudienceJuryDrawPool } from "@/lib/audience-jury/mockAudienceJuryStore";
import { getMockPartAttendanceIdentity } from "@/lib/attendance/mockPartAttendanceStore";
import { DomainError } from "@/lib/errors/domainError";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PrizeInventoryItem, PrizeItemDraw } from "@/types/prize-inventory";
import type { PrizeDrawStage } from "@/types/prize-stage";
import { getMockPrizeStageMembers } from "@/lib/prize/prizeStageStore";
import { maskStudentNumber, maskWinnerName } from "@/lib/prize/privacy";

const MOCK_EVENT_ID = "00000000-0000-4000-8000-000000000100";
const definitions: Array<Omit<PrizeInventoryItem, "drawnCount" | "imageUrl" | "status" | "drawStatus">> = [
  { id: "FIRST-COFFEE", pool: "ALL_PARTICIPANTS", displayOrder: 1, name: "커피 쿠폰", unitAmount: 10000, quantity: 15, winnerCount: 15, drawStage: "FIRST", awardOnly: false },
  { id: "SECOND-OLIVE-20", pool: "ALL_PARTICIPANTS", displayOrder: 2, name: "올리브영 상품권 2만원", unitAmount: 20000, quantity: 6, winnerCount: 6, drawStage: "SECOND", awardOnly: false },
  { id: "BEST-REVIEWER-OUTBACK", pool: "AUDIENCE_JURY", displayOrder: 1, name: "베스트 리뷰어상 · 아웃백 상품권", unitAmount: 80000, quantity: 2, winnerCount: 2, drawStage: null, awardOnly: true },
  { id: "THIRD-OLIVE-30", pool: "ALL_PARTICIPANTS", displayOrder: 3, name: "올리브영 상품권 3만원", unitAmount: 30000, quantity: 6, winnerCount: 6, drawStage: "THIRD", awardOnly: false },
  { id: "THIRD-AIRPODS", pool: "ALL_PARTICIPANTS", displayOrder: 4, name: "에어팟", unitAmount: 250000, quantity: 1, winnerCount: 1, drawStage: "THIRD", awardOnly: false },
  { id: "THIRD-COFFEE", pool: "ALL_PARTICIPANTS", displayOrder: 5, name: "커피 쿠폰", unitAmount: 10000, quantity: 5, winnerCount: 5, drawStage: "THIRD", awardOnly: false },
];

type MockState = { draws: PrizeItemDraw[] };
const globalStore = globalThis as typeof globalThis & { __mockPrizeInventory?: MockState };
function mockState() { return globalStore.__mockPrizeInventory ??= { draws: [] }; }

export function resetMockPrizeInventory() { globalStore.__mockPrizeInventory = { draws: [] }; }

export function getMockPrizeInventory(): PrizeInventoryItem[] {
  const draws = mockState().draws;
  return definitions.map((item) => {
    const drawnCount = draws.filter((draw) => draw.prizeItemId === item.id).length;
    return { ...item, pool: item.pool, drawnCount, imageUrl: null, status: "CONFIRMED", drawStatus: drawnCount === 0 ? "READY" : drawnCount >= item.winnerCount ? "COMPLETED" : "IN_PROGRESS" };
  });
}

export async function drawMockPrizeItem(eventId: string, prizeItemId: string, stage: PrizeDrawStage): Promise<PrizeItemDraw> {
  if (eventId !== MOCK_EVENT_ID) throw new DomainError("NOT_FOUND", "행사를 찾을 수 없습니다.", 404);
  const item = getMockPrizeInventory().find((candidate) => candidate.id === prizeItemId);
  if (!item) throw new DomainError("NOT_FOUND", "경품을 찾을 수 없습니다.", 404);
  if (item.awardOnly || item.drawStage !== stage) throw new DomainError("INVALID_STATE", "이 경품은 선택한 행사 단계에서 추첨할 수 없습니다.", 409);
  if (item.drawnCount >= item.winnerCount) throw new DomainError("INVALID_STATE", "이 경품의 추첨이 모두 완료되었습니다.", 409);
  const prior = new Set(mockState().draws.map((draw) => draw.participantCode));
  const jury = new Set(getMockAudienceJuryDrawPool(eventId).map((candidate) => candidate.participantCode));
  const stageMembers = getMockPrizeStageMembers(stage);
  if (!stageMembers.size) throw new DomainError("INVALID_STATE", "선택한 차수의 대상자 풀이 봉인되지 않았습니다.", 409);
  const eligible = [...stageMembers].filter((code) => (item.pool === "ALL_PARTICIPANTS" || jury.has(code)) && !prior.has(code));
  if (!eligible.length) throw new DomainError("NOT_FOUND", "추첨 가능한 참가자가 없습니다.", 409);
  const selectedCode = eligible[randomInt(eligible.length)]!;
  const identity = getMockPartAttendanceIdentity(eventId, selectedCode);
  if (!identity) throw new DomainError("INVALID_STATE", "당첨자 표시 정보를 확인할 수 없습니다.", 409);
  const draw: PrizeItemDraw = {
    drawId: crypto.randomUUID(), prizeItemId: item.id, prizeName: item.name, pool: item.pool,
    round: item.drawnCount + 1, participantCode: selectedCode, department: identity.department,
    maskedStudentNumber: maskStudentNumber(identity.studentNumber), maskedName: maskWinnerName(identity.name), drawnAt: new Date().toISOString(),
  };
  mockState().draws.push(draw);
  return structuredClone(draw);
}

export function getMockPrizeDraws(eventId: string): PrizeItemDraw[] {
  if (eventId !== MOCK_EVENT_ID) throw new DomainError("NOT_FOUND", "행사를 찾을 수 없습니다.", 404);
  return structuredClone(mockState().draws).reverse();
}

type InventoryRow = {
  id: string; pool: PrizeInventoryItem["pool"]; display_order: number; name: string; unit_amount: number;
  quantity: number; winner_count: number; image_url: string | null; status: PrizeInventoryItem["status"];
  draw_status: PrizeInventoryItem["drawStatus"]; draw_stage: PrizeInventoryItem["drawStage"];
  award_only: boolean; prize_item_draws: Array<{ count: number }>;
};

type PrizeDrawResultRow = {
  draw_id: string; prize_item_id: string; prize_name: string; pool: PrizeInventoryItem["pool"];
  round: number; participant_code: string; department: string; masked_student_number: string;
  masked_name: string; drawn_at: string;
};

async function supabase() {
  const client = await createSupabaseServerClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
  return client;
}

export async function getSupabasePrizeInventory(eventId: string): Promise<PrizeInventoryItem[]> {
  const client = await supabase();
  const { data, error } = await client.from("prize_inventory")
    .select("id, pool, display_order, name, unit_amount, quantity, winner_count, image_url, status, draw_status, draw_stage, award_only, prize_item_draws(count)")
    .eq("event_id", eventId).eq("status", "CONFIRMED").order("pool").order("display_order");
  if (error) throw new DomainError("DATABASE_ERROR", "경품 목록을 조회하지 못했습니다.", 503);
  return (data as InventoryRow[]).map((row) => ({
    id: row.id, pool: row.pool, displayOrder: row.display_order, name: row.name, unitAmount: row.unit_amount,
    quantity: row.quantity, winnerCount: row.winner_count, drawnCount: row.prize_item_draws[0]?.count ?? 0,
    imageUrl: row.image_url, status: row.status, drawStatus: row.draw_status, drawStage: row.draw_stage, awardOnly: row.award_only,
  }));
}

export async function drawSupabasePrizeItem(eventId: string, prizeItemId: string, stage: PrizeDrawStage): Promise<PrizeItemDraw> {
  const client = await supabase();
  const { data, error } = await client.rpc("draw_prize_item_winner_for_stage", { p_event_id: eventId, p_prize_item_id: prizeItemId, p_stage: stage });
  if (error) {
    if (error.message.includes("NO_ELIGIBLE_PARTICIPANT")) throw new DomainError("NOT_FOUND", "추첨 가능한 참가자가 없습니다.", 409);
    if (error.message.includes("PRIZE_DRAW_COMPLETED")) throw new DomainError("INVALID_STATE", "이 경품의 추첨이 모두 완료되었습니다.", 409);
    if (error.message.includes("PRIZE_STAGE_NOT_LOCKED")) throw new DomainError("INVALID_STATE", "선택한 차수의 대상자 풀이 봉인되지 않았습니다.", 409);
    throw new DomainError("DATABASE_ERROR", "경품 추첨을 완료하지 못했습니다.", 503);
  }
  const row = data?.[0];
  if (!row) throw new DomainError("DATABASE_ERROR", "경품 추첨 결과가 없습니다.", 503);
  const saved = (await getSupabasePrizeDraws(eventId)).find((draw) => draw.drawId === row.draw_id);
  if (!saved) throw new DomainError("DATABASE_ERROR", "당첨자 표시 정보를 확인하지 못했습니다.", 503);
  return saved;
}

export async function getSupabasePrizeDraws(eventId: string): Promise<PrizeItemDraw[]> {
  const client = await supabase();
  const { data, error } = await client.rpc("get_prize_draw_results", { p_event_id: eventId });
  if (error) throw new DomainError("DATABASE_ERROR", "당첨 결과를 조회하지 못했습니다.", 503);
  return ((data ?? []) as PrizeDrawResultRow[]).map((row) => ({
    drawId: row.draw_id, prizeItemId: row.prize_item_id, prizeName: row.prize_name, pool: row.pool,
    round: Number(row.round), participantCode: row.participant_code, department: row.department,
    maskedStudentNumber: row.masked_student_number, maskedName: row.masked_name, drawnAt: row.drawn_at,
  }));
}
