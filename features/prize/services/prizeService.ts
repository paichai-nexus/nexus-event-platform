import "server-only";

import { z } from "zod";
import { DomainError } from "@/lib/errors/domainError";
import type { PrizeRepository } from "@/lib/repositories/prizeRepository";

export class PrizeService {
  constructor(private readonly repository: PrizeRepository) {}

  getHistory(eventId: string) {
    if (!z.string().uuid().safeParse(eventId).success) throw new DomainError("VALIDATION_ERROR", "행사 식별자가 올바르지 않습니다.", 422);
    return this.repository.getHistory(eventId);
  }

  draw(eventId: string, actorUserId: string) {
    if (!z.string().uuid().safeParse(eventId).success) throw new DomainError("VALIDATION_ERROR", "행사 식별자가 올바르지 않습니다.", 422);
    return this.repository.draw(eventId, actorUserId);
  }
}
