import "server-only";
import { isMockRuntime } from "@/lib/config/runtime";
import { DomainError } from "@/lib/errors/domainError";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CEREMONY_PHASES, type CeremonyControlState, type CeremonyPhase } from "@/types/ceremony-control";

const state = globalThis as typeof globalThis & { __ceremonyControl?: Map<string, CeremonyControlState> };
const mockStates = () => state.__ceremonyControl ??= new Map();
const initial = (eventId: string): CeremonyControlState => ({ eventId, phase: "AUDIENCE_CANDIDATES", phaseIndex: 0, updatedAt: null });
const map = (row: Record<string, unknown>): CeremonyControlState => ({ eventId: String(row.event_id), phase: row.phase as CeremonyPhase, phaseIndex: CEREMONY_PHASES.indexOf(row.phase as CeremonyPhase), updatedAt: String(row.updated_at) });

export async function getCeremonyControl(eventId: string) {
  if (isMockRuntime()) return structuredClone(mockStates().get(eventId) ?? initial(eventId));
  const client = await createSupabaseServerClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
  const { data, error } = await client.from("ceremony_control_states").select("event_id,phase,updated_at").eq("event_id", eventId).maybeSingle();
  if (error) throw new DomainError("DATABASE_ERROR", "행사 진행 상태를 조회하지 못했습니다.", 503);
  return data ? map(data) : initial(eventId);
}

export async function advanceCeremonyControl(eventId: string, phase: CeremonyPhase) {
  if (isMockRuntime()) {
    const current = mockStates().get(eventId) ?? initial(eventId);
    const nextIndex = CEREMONY_PHASES.indexOf(phase);
    if (nextIndex < current.phaseIndex || nextIndex > current.phaseIndex + 1) throw new DomainError("INVALID_STATE", "행사 순서는 한 단계씩만 진행할 수 있으며 되돌릴 수 없습니다.", 409);
    const saved = { eventId, phase, phaseIndex: nextIndex, updatedAt: new Date().toISOString() } satisfies CeremonyControlState;
    mockStates().set(eventId, saved); return structuredClone(saved);
  }
  const client = await createSupabaseServerClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
  const { data, error } = await client.rpc("advance_ceremony_phase", { p_event_id: eventId, p_phase: phase });
  if (error || !data) {
    if (error?.message.includes("CEREMONY_INVALID_TRANSITION")) throw new DomainError("INVALID_STATE", "행사 순서는 한 단계씩만 진행할 수 있으며 되돌릴 수 없습니다.", 409);
    throw new DomainError("DATABASE_ERROR", "행사 진행 상태를 저장하지 못했습니다.", 503);
  }
  return map((Array.isArray(data) ? data[0] : data) as Record<string, unknown>);
}
