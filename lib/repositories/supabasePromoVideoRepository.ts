import "server-only";
import { DomainError } from "@/lib/errors/domainError";
import type { PromoVideoRepository } from "@/lib/repositories/promoVideoRepository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PromoVideo, PromoVideoInput } from "@/types/promo";
type Row = { id: string; video_url: string; thumbnail_url: string | null; title: string; active: boolean };
const toVideo = (row: Row): PromoVideo => ({ id: row.id, videoUrl: row.video_url, thumbnailUrl: row.thumbnail_url, title: row.title, active: row.active });
export class SupabasePromoVideoRepository implements PromoVideoRepository {
  private async client() { const client = await createSupabaseServerClient(); if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503); return client; }
  async get(eventId?: string) { const supabase = await this.client(); let query = supabase.from("promo_videos").select("id, video_url, thumbnail_url, title, active").eq("active", true); if (eventId) query = query.eq("event_id", eventId); const { data, error } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle(); if (error) throw new DomainError("DATABASE_ERROR", "홍보 영상을 조회하지 못했습니다.", 500); return data ? toVideo(data as Row) : null; }
  async save(eventId: string, input: PromoVideoInput) { const supabase = await this.client(); const { data, error } = await supabase.from("promo_videos").upsert({ event_id: eventId, video_url: input.videoUrl, thumbnail_url: input.thumbnailUrl, title: input.title, active: input.active }, { onConflict: "event_id" }).select("id, video_url, thumbnail_url, title, active").single(); if (error || !data) throw new DomainError("DATABASE_ERROR", "홍보 영상을 저장하지 못했습니다.", 500); return toVideo(data as Row); }
}
