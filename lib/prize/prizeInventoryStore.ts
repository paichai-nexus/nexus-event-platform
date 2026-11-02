import "server-only";

import { randomInt } from "node:crypto";
import { getMockAudienceJuryDrawPool } from "@/lib/audience-jury/mockAudienceJuryStore";
import { DomainError } from "@/lib/errors/domainError";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PrizeInventoryItem, PrizeItemDraw } from "@/types/prize-inventory";
import type { PrizeDrawStage } from "@/types/prize-stage";
import { getMockPrizeStageMembers } from "@/lib/prize/prizeStageStore";

const MOCK_EVENT_ID = "00000000-0000-4000-8000-000000000100";
const definitions = [
  { id: "AUDIENCE-OUTBACK", pool: "AUDIENCE_JURY", displayOrder: 1, name: "아웃백 상품권", unitAmount: 80000, quantity: 2, winnerCount: 2 },
  { id: "AUDIENCE-COFFEE", pool: "AUDIENCE_JURY", displayOrder: 2, name: "커피 쿠폰", unitAmount: 10000, quantity: 6, winnerCount: 6 },
  { id: "ALL-AIRPODS", pool: "ALL_PARTICIPANTS", displayOrder: 1, name: "에어팟", unitAmount: 250000, quantity: 1, winnerCount: 1 },
  { id: "ALL-COFFEE", pool: "ALL_PARTICIPANTS", displayOrder: 2, name: "커피 쿠폰", unitAmount: 10000, quantity: 14, winnerCount: 14 },
  { id: "ALL-OLIVE-30", pool: "ALL_PARTICIPANTS", displayOrder: 3, name: "올리브영 상품권", unitAmount: 30000, quantity: 6, winnerCount: 6 },
  { id: "ALL-OLIVE-20", pool: "ALL_PARTICIPANTS", displayOrder: 4, name: "올리브영 상품권", unitAmount: 20000, quantity: 6, winnerCount: 6 },
] as const;

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
  if (item.drawnCount >= item.winnerCount) throw new DomainError("INVALID_STATE", "이 경품의 추첨이 모두 완료되었습니다.", 409);
  const prior = new Set(mockState().draws.map((draw) => draw.participantCode));
  const jury = new Set(getMockAudienceJuryDrawPool(eventId).map((candidate) => candidate.participantCode));
  const stageMembers = getMockPrizeStageMembers(stage);
  if (!stageMembers.size) throw new DomainError("INVALID_STATE", "선택한 차수의 대상자 풀이 봉인되지 않았습니다.", 409);
  const eligible = [...stageMembers].filter((code) => (item.pool === "ALL_PARTICIPANTS" || jury.has(code)) && !prior.has(code));
  if (!eligible.length) throw new DomainError("NOT_FOUND", "추첨 가능한 참가자가 없습니다.", 409);
  const draw: PrizeItemDraw = {
    drawId: crypto.randomUUID(), prizeItemId: item.id, prizeName: item.name, pool: item.pool,
    round: item.drawnCount + 1, participantCode: eligible[randomInt(eligible.length)]!, drawnAt: new Date().toISOString(),
  };
  mockState().draws.push(draw);
  return structuredClone(draw);
}

type InventoryRow = {
  id: string; pool: PrizeInventoryItem["pool"]; display_order: number; name: string; unit_amount: number;
  quantity: number; winner_count: number; image_url: string | null; status: PrizeInventoryItem["status"];
  draw_status: PrizeInventoryItem["drawStatus"]; prize_item_draws: Array<{ count: number }>;
};

async function supabase() {
  const client = await createSupabaseServerClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
  return client;
}

export async function getSupabasePrizeInventory(eventId: string): Promise<PrizeInventoryItem[]> {
  const client = await supabase();
  const { data, error } = await client.from("prize_inventory")
    .select("id, pool, display_order, name, unit_amount, quantity, winner_count, image_url, status, draw_status, prize_item_draws(count)")
    .eq("event_id", eventId).order("pool").order("display_order");
  if (error) throw new DomainError("DATABASE_ERROR", "경품 목록을 조회하지 못했습니다.", 503);
  return (data as InventoryRow[]).map((row) => ({
    id: row.id, pool: row.pool, displayOrder: row.display_order, name: row.name, unitAmount: row.unit_amount,
    quantity: row.quantity, winnerCount: row.winner_count, drawnCount: row.prize_item_draws[0]?.count ?? 0,
    imageUrl: row.image_url, status: row.status, drawStatus: row.draw_status,
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
  return { drawId: row.draw_id, prizeItemId: row.prize_item_id, prizeName: row.prize_name, pool: row.pool, round: row.round, participantCode: row.participant_code, drawnAt: row.drawn_at };
}
