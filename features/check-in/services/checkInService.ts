import "server-only";

import { z } from "zod";
import { DomainError } from "@/lib/errors/domainError";
import type { CheckInRepository } from "@/lib/repositories/checkInRepository";

export const checkInInputSchema = z.object({
  eventId: z.string().uuid().optional(),
  participantCode: z.string().trim().min(1).max(64),
  source: z.enum(["QR", "MANUAL"]).default("MANUAL"),
});

export type CheckInInput = z.infer<typeof checkInInputSchema>;

export class CheckInService {
  constructor(private readonly repository: CheckInRepository) {}

  async checkIn(input: unknown, checkedInBy: string) {
    const parsed = checkInInputSchema.safeParse(input);
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "참가자 코드를 확인해주세요.", 422);

    return this.repository.checkIn({ ...parsed.data, checkedInBy });
  }

  async getSnapshot(eventId?: string) {
    if (eventId && !z.string().uuid().safeParse(eventId).success) {
      throw new DomainError("VALIDATION_ERROR", "행사 식별자가 올바르지 않습니다.", 422);
    }
    return this.repository.getSnapshot(eventId);
  }
}
