import "server-only";

import { DomainError } from "@/lib/errors/domainError";
import type { PrizeCatalogRepository } from "@/lib/repositories/prizeCatalogRepository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PrizeDefinition, PrizeDefinitionUpdate } from "@/types/prize";

type PrizeRow = {
  id: string;
  rank: number;
  name: string | null;
  image_url: string | null;
  quantity: number | null;
  winner_count: number | null;
  status: PrizeDefinition["status"];
  draw_status: PrizeDefinition["drawStatus"];
};

function toPrize(row: PrizeRow): PrizeDefinition {
  return { id: row.id, rank: row.rank, name: row.name, imageUrl: row.image_url, quantity: row.quantity, winnerCount: row.winner_count, status: row.status, drawStatus: row.draw_status };
}

export class SupabasePrizeCatalogRepository implements PrizeCatalogRepository {
  private async client() {
    const client = await createSupabaseServerClient();
    if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
    return client;
  }

  async getCatalog(eventId: string) {
    const supabase = await this.client();
    const { data, error } = await supabase.from("prize_catalog").select("id, rank, name, image_url, quantity, winner_count, status, draw_status").eq("event_id", eventId).order("rank");
    if (error) throw new DomainError("DATABASE_ERROR", "경품 목록을 조회하지 못했습니다.", 500);
    return (data as PrizeRow[]).map(toPrize);
  }

  async updatePrize(update: PrizeDefinitionUpdate) {
    const supabase = await this.client();
    const { data, error } = await supabase.from("prize_catalog").update({ name: update.name?.trim() || null, image_url: update.imageUrl?.trim() || null, quantity: update.quantity, winner_count: update.winnerCount, status: update.status, draw_status: update.drawStatus }).eq("id", update.id).eq("event_id", update.eventId).select("id, rank, name, image_url, quantity, winner_count, status, draw_status").single();
    if (error || !data) throw new DomainError("DATABASE_ERROR", "경품 정보를 저장하지 못했습니다.", 500);
    return toPrize(data as PrizeRow);
  }
}
