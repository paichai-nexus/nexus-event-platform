import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMockRuntime } from "@/lib/config/runtime";
import { DomainError } from "@/lib/errors/domainError";
import type { BestReviewer, ResultShowAward, ResultShowDeck, ResultShowScene } from "@/types/result-show";

const mock = globalThis as typeof globalThis & { __resultShowDeck?: ResultShowDeck };
function mockDeck(eventId: string) { return mock.__resultShowDeck ??= { eventId, judgeComment: "", awards: [], bestReviewer: null, status: "DRAFT", currentScene: "REVIEW", approvedAt: null, updatedAt: new Date().toISOString() }; }
function map(row: Record<string, unknown>): ResultShowDeck { return { eventId: String(row.event_id), judgeComment: String(row.judge_comment ?? ""), awards: (row.awards ?? []) as ResultShowAward[], bestReviewer: (row.best_reviewer ?? null) as BestReviewer | null, status: row.status as ResultShowDeck["status"], currentScene: row.current_scene as ResultShowScene, approvedAt: row.approved_at ? String(row.approved_at) : null, updatedAt: String(row.updated_at) }; }

export async function getResultShowDeck(eventId: string) {
  if (isMockRuntime()) return structuredClone(mockDeck(eventId));
  const client = await createSupabaseServerClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
  const { data, error } = await client.from("result_show_decks").select("event_id,judge_comment,awards,best_reviewer,status,current_scene,approved_at,updated_at").eq("event_id", eventId).maybeSingle();
  if (error) throw new DomainError("DATABASE_ERROR", "결과 SHOW 자료를 조회하지 못했습니다.", 503);
  return data ? map(data) : { eventId, judgeComment: "", awards: [], bestReviewer: null, status: "DRAFT", currentScene: "REVIEW", approvedAt: null, updatedAt: new Date().toISOString() } satisfies ResultShowDeck;
}

export async function saveResultShowDraft(eventId: string, judgeComment: string, awards: ResultShowAward[], bestReviewer: BestReviewer | null) {
  if (isMockRuntime()) { const deck = mockDeck(eventId); if (deck.status === "APPROVED") throw new DomainError("EVENT_CLOSED", "승인된 SHOW 자료는 수정할 수 없습니다.", 409); Object.assign(deck, { judgeComment, awards, bestReviewer, updatedAt: new Date().toISOString() }); return structuredClone(deck); }
  const client = await createSupabaseServerClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
  const { data, error } = await client.from("result_show_decks").upsert({ event_id: eventId, judge_comment: judgeComment, awards, best_reviewer: bestReviewer }, { onConflict: "event_id" }).select("event_id,judge_comment,awards,best_reviewer,status,current_scene,approved_at,updated_at").single();
  if (error || !data) throw new DomainError("DATABASE_ERROR", "결과 SHOW 초안을 저장하지 못했습니다.", 503);
  return map(data);
}

export async function approveResultShow(eventId: string) {
  if (isMockRuntime()) { const deck = mockDeck(eventId); if (!deck.judgeComment || !deck.awards.length) throw new DomainError("VALIDATION_ERROR", "심사평과 수상 결과를 모두 입력해주세요.", 422); Object.assign(deck, { status: "APPROVED", approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); return structuredClone(deck); }
  const client = await createSupabaseServerClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
  const { data, error } = await client.rpc("approve_result_show_deck", { p_event_id: eventId });
  if (error || !data) throw new DomainError("DATABASE_ERROR", "결과 SHOW 자료를 승인하지 못했습니다.", 503);
  return map(Array.isArray(data) ? data[0] : data);
}

export async function setResultShowScene(eventId: string, scene: ResultShowScene) {
  if (isMockRuntime()) { const deck = mockDeck(eventId); if (deck.status !== "APPROVED") throw new DomainError("INVALID_STATE", "승인 전에는 장면을 전환할 수 없습니다.", 409); Object.assign(deck, { currentScene: scene, updatedAt: new Date().toISOString() }); return structuredClone(deck); }
  const client = await createSupabaseServerClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
  const { data, error } = await client.rpc("set_result_show_scene", { p_event_id: eventId, p_scene: scene });
  if (error || !data) throw new DomainError("DATABASE_ERROR", "결과 SHOW 장면을 전환하지 못했습니다.", 503);
  return map(Array.isArray(data) ? data[0] : data);
}

export async function getPublicResultShowDeck() {
  if (isMockRuntime()) { const deck = mock.__resultShowDeck; return deck?.status === "APPROVED" ? structuredClone(deck) : null; }
  const client = createSupabaseAdminClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "공개 결과 자료를 조회할 수 없습니다.", 503);
  const { data, error } = await client.from("result_show_decks").select("event_id,judge_comment,awards,best_reviewer,status,current_scene,approved_at,updated_at").eq("status", "APPROVED").order("approved_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new DomainError("DATABASE_ERROR", "공개 결과 자료를 조회할 수 없습니다.", 503);
  return data ? map(data) : null;
}
