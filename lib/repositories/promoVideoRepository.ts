import type { PromoVideo, PromoVideoInput } from "@/types/promo";
export interface PromoVideoRepository { get(eventId?: string): Promise<PromoVideo | null>; save(eventId: string, input: PromoVideoInput): Promise<PromoVideo>; }
