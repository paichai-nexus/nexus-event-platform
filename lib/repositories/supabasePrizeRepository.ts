import "server-only";

import { DomainError } from "@/lib/errors/domainError";
import type { PrizeRepository } from "@/lib/repositories/prizeRepository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PrizeRecord } from "@/types/prize";

export class SupabasePrizeRepository implements PrizeRepository {
  private async client() {
    const client = await createSupabaseServerClient();
    if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
    return client;
  }

  async getHistory(eventId: string): Promise<PrizeRecord[]> {
    const supabase = await this.client();
    const { data, error } = await supabase
      .from("prize_draws")
      .select("round, drawn_at, participants(participant_code)")
      .eq("event_id", eventId)
      .eq("status", "ACTIVE")
      .order("round", { ascending: true });
    if (error) throw new DomainError("DATABASE_ERROR", "경품 추첨 이력을 조회하지 못했습니다.", 500);
    return (data ?? []).map((row) => {
      const participant = Array.isArray(row.participants) ? row.participants[0] : row.participants;
      return { round: row.round, participantId: participant?.participant_code ?? "UNKNOWN", drawnAt: row.drawn_at };
    });
  }

  async draw(eventId: string): Promise<PrizeRecord> {
    const supabase = await this.client();
    const { data, error } = await supabase.rpc("draw_prize_winner", { p_event_id: eventId });
    if (error) throw new DomainError("DATABASE_ERROR", "경품 추첨을 완료하지 못했습니다.", 500);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new DomainError("NOT_FOUND", "추첨 가능한 참가자가 없습니다.", 409);
    return { round: row.round, participantId: row.participant_code, drawnAt: row.drawn_at };
  }
}
